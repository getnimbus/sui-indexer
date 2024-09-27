import { sumBy } from "lodash";
import { PROTOCOL } from "./indexer";
import { Borrow, Lending, SuiContext, TokenState } from "../../interface";
import { suiClient } from "../../services/client";
import { prisma } from "../../services/db";
import { INimbusTokenPrice, getNimbusDBPrice, valueConvert } from "../../utils";
import { ReserveData } from "./types";
import { getOrSet } from "../../services/cache";
import { getUserContext } from "../context";

export const config = {
  ProtocolPackage:
    "0xd92d9db3ae5e2e932eda336b15f97e02255d152201d0cf29a29ca0c4fb0205f3",
  StorageId:
    "0xbb4e2f4b6205c2e2a2db47aeb4f830796ec7c005f88537ee775986639bc442fe",
  Incentive:
    "0xaaf735bf83ff564e1b219a0d644de894ef5bdc4b2250b126b2a46dd002331821",
  IncentiveV2:
    "0xf87a8acb8b81d14307894d12595541a73f19933f88e1326d5be349c7a6f7559c", // The new incentive version: V2

  PriceOracle:
    "0x1568865ed9a0b5ec414220e8f79b3d04c77acc82358f6e5ae4635687392ffbef",
  ReserveParentId:
    "0xe6d4c6610b86ce7735ea754596d71d72d10c7980b5052fc3c8cdf8d09fea9b4b", // get it from storage object id. storage.reserves
};

export const getUserPositions = async (
  owner: string,
  ctx: SuiContext
): Promise<(Borrow | Lending)[]> => {
  // const reservesDatas: ReserveData[] = [];
  // const allLending = await prisma.defi_lending.findMany({
  //   where: {
  //     owner,
  //     chain: "SUI",
  //     protocol: PROTOCOL,
  //   },
  //   orderBy: {
  //     timestamp: "asc",
  //   },
  // });

  const allLending = [];

  const reservesDatas: ReserveData[] = await getOrSet(
    {
      protocol: PROTOCOL,
      key: "reservesDatas",
      ttl: 15 * 60, // 15 mins
    },
    async () => {
      const poolIndex = Array.from({ length: 25 }, (_, index) => index); // NOTICE: This is hard code assump that we have 25 pools available, current 8 only
      const allData = await Promise.all(
        poolIndex.map(async (index) => {
          const reserve = await suiClient.getDynamicFieldObject({
            parentId: config.ReserveParentId,
            name: { type: "u8", value: index },
          });

          return reserve?.data?.content?.fields;
        })
      );

      return allData.filter((_) => _);
    }
  );

  const result = await Promise.all(
    reservesDatas.map(async (rData) => {
      const lendings: Lending[] = [];
      const borrows: Borrow[] = [];
      const borrowBalancePromise = suiClient.getDynamicFieldObject({
        parentId:
          rData.value.fields.borrow_balance.fields.user_state.fields.id.id,
        name: { type: "address", value: owner },
      });
      const supplyBalancePromise = suiClient.getDynamicFieldObject({
        parentId:
          rData.value.fields.supply_balance.fields.user_state.fields.id.id,
        name: { type: "address", value: owner },
      });
      const [borrowBalance, supplyBalance, tokenPrice] = await Promise.all([
        borrowBalancePromise,
        supplyBalancePromise,
        getNimbusDBPrice("0x" + rData.value.fields.coin_type, "SUI"),
      ]);

      if (!supplyBalance.error && supplyBalance.data?.content?.fields) {
        const supplyInfo = supplyBalance.data.content.fields;
        if (supplyInfo.value) {
          const lendingList = allLending.filter(
            (item) =>
              item.position === "0x" + rData.value.fields.coin_type &&
              ["Add", "Remove"].includes(item.action)
          );

          const lendingAmount = valueConvert(
            BigInt(supplyInfo.value) *
              BigInt(rData.value.fields.current_supply_index),
            36
          );

          lendings.push({
            positionId: "0x" + rData.value.fields.coin_type,
            owner: owner,
            input: [
              {
                amount: sumBy(
                  lendingList,
                  (item) => item.token_input_quality - item.token_output_quality
                ),
                value: sumBy(
                  lendingList,
                  (item) =>
                    item.token_input_quality * item.token_input_price -
                    item.token_output_quality * item.token_output_price
                ),
                token: tokenPrice,
              },
            ],
            yieldCollected: [], // TODO:
            current: {
              tokens: [
                {
                  amount: Number(lendingAmount),
                  value: Number(lendingAmount) * tokenPrice.price,
                  token: tokenPrice,
                },
              ],
              yield: [], // TODO:
            },
            fee: { value: sumBy(lendingList, (item) => item.fee) },
            chain: "SUI",
            type: "Lending",
            meta: {
              protocol: {
                name: PROTOCOL,
                logo: "",
                url: "",
              },
            },
          });
        }
      }

      if (!borrowBalance.error && borrowBalance.data?.content) {
        const borrowInfo = borrowBalance.data.content?.fields;
        if (borrowInfo.value) {
          const borrowList = allLending.filter(
            (item) =>
              item.position === "0x" + rData.value.fields.coin_type &&
              ["Borrow", "Repay"].includes(item.action)
          );

          const borrowAmount = valueConvert(
            BigInt(borrowInfo.value) *
              BigInt(rData.value.fields.current_borrow_index),
            36
          );

          borrows.push({
            positionId: "0x" + rData.value.fields.coin_type,
            owner: owner,
            input: [],
            yieldCollected: [],
            current: {
              tokens: [
                {
                  amount: Number(borrowAmount),
                  value: Number(borrowAmount) * tokenPrice.price,
                  token: tokenPrice,
                },
              ],
              yield: [], // TODO:
              healthy: 10, // TODO
            },
            fee: {
              value:
                sumBy(borrowList, (item) => item.fee) +
                sumBy(lendings, (item) => item.fee.value),
            },
            chain: "SUI",
            type: "Borrow",
            meta: {
              protocol: {
                name: PROTOCOL,
                logo: "",
                url: "",
              },
            },
          });
        }
      }

      return [lendings, borrows];
    })
  );

  const lendings = result.map((item) => item[0]).flat();
  const borrows = result
    .map((item) => item[1])
    .flat()
    .map((item) => {
      item.input = lendings;

      return item;
    });

  if (borrows.length) {
    return borrows;
  }

  return lendings;
};

const test = async () => {
  if (!process.env.TEST) {
    return;
  }

  const address =
    "0x48d1f71dcab365bd1884ac7b1e3d2a5186cb1b4a602b976bc9a8b2b5f6ae8b2c";
  console.time("getContext");
  const context = await getUserContext(address);
  console.timeEnd("getContext");

  console.time("getUserPositions");
  const result = await getUserPositions(address, context);
  console.log(JSON.stringify(result));
  console.timeEnd("getUserPositions");
};

test();
