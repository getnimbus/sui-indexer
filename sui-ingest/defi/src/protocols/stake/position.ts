import { groupBy, sumBy } from "lodash";
import { PROTOCOL } from "./indexer";
import { Stake, SuiContext } from "../../interface";
import { suiClient } from "../../services/client";
import { prisma } from "../../services/db";
import { getNimbusDBPrice, valueConvert } from "../../utils";
import { getUserContext } from "../context";

export const getUserPositions = async (
  owner: string,
  ctx: SuiContext
): Promise<Stake[]> => {
  const stakeData = await suiClient.getStakes({ owner });
  // const historicalData = await prisma.defi_stake.findMany({
  //   where: {
  //     owner,
  //     chain: "SUI",
  //     protocol: PROTOCOL,
  //   },
  //   orderBy: {
  //     timestamp: "asc",
  //   },
  // });
  const historicalData = [];
  const historicalDataByPosition = groupBy(
    historicalData,
    (item) => item.position
  );

  const [tokenPrice] = await Promise.all([
    getNimbusDBPrice("0x2::sui::SUI", "SUI"),
    // getNimbusDBPrice(poolData.token1, "SUI", Number(event.timestampMs)),
  ]);

  const result = await Promise.all(
    stakeData.map((item) => {
      const data = historicalDataByPosition[item.validatorAddress] || [];
      const dataIn = data.filter((row) => row.action === "Add");
      const dataOut = data.filter((row) => row.action === "Remove");

      const totalPrincipal = item.stakes.reduce(
        (prev, cur) => prev + BigInt(cur.principal),
        0n
      );
      const totalReward = item.stakes.reduce(
        (prev, cur) => prev + BigInt(cur?.estimatedReward || 0),
        0n
      );

      return {
        positionId: item.validatorAddress,
        owner,
        input: [
          {
            amount: valueConvert(totalPrincipal, tokenPrice.decimals || 9),
            value:
              Number(valueConvert(totalPrincipal, tokenPrice.decimals || 9)) *
              tokenPrice.price,
            token: tokenPrice,
          },
        ],
        yieldCollected: [
          {
            amount:
              sumBy(dataIn, (row) => row.token_input_quality) -
              sumBy(dataOut, (row) => row.token_output_quality),
            value:
              sumBy(
                dataIn,
                (row) => row.token_input_quality * row.token_input_price
              ) -
              sumBy(
                dataOut,
                (row) => row.token_output_quality * row.token_output_price
              ),
            token: tokenPrice,
          },
        ],
        current: {
          tokens: [
            {
              amount: valueConvert(totalPrincipal, tokenPrice.decimals || 9),
              value:
                Number(valueConvert(totalPrincipal, tokenPrice.decimals || 9)) *
                tokenPrice.price,
              token: tokenPrice,
            },
          ],
          yield: [
            {
              amount: valueConvert(totalReward, tokenPrice.decimals || 9),
              value:
                Number(valueConvert(totalReward, tokenPrice.decimals || 9)) *
                tokenPrice.price,
              token: tokenPrice,
              claimable: false,
            },
          ],
        },
        fee: sumBy(data, (row) => row.fee),
        chain: "SUI",
        type: "Staking",
        meta: {
          protocol: {
            name: PROTOCOL,
            logo: "",
            url: "",
          },
        },
      };
    })
  );

  return result;
};

const test = async () => {
  if (!process.env.TEST) {
    return;
  }

  const address =
    "0x692853c81afc8f847147c8a8b4368dc894697fc12b929ef3071482d27339815e";
  console.time("getContext");
  const context = await getUserContext(address);
  console.timeEnd("getContext");

  console.time("getUserPositions");
  const result = await getUserPositions(address, context);
  console.log(JSON.stringify(result));
  console.timeEnd("getUserPositions");
};

test();
