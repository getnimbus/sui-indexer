import { groupBy, sumBy } from "lodash";
import {
  AMM,
  Borrow,
  Lending,
  Position,
  SuiContext,
  Vest,
} from "../../interface";
import { suiClient } from "../../services/client";
import { prisma } from "../../services/db";
import { PROTOCOL } from "./indexer";
import {
  getAllOwnedObjects,
  getNimbusDBPrice,
  parsePoolToken,
  valueConvert,
} from "../../utils";
import { PACKAGE } from "./constants";
import { getOrSet } from "../../services/cache";
import { getUserContext } from "../context";

export const getUserLPPositions = async (
  owner: string,
  ctx: SuiContext
): Promise<AMM[]> => {
  const { ownedObj } = ctx;
  const lpHoldings = ownedObj.filter((item) =>
    item.data?.type?.startsWith(`${PACKAGE}::spot_dex::KriyaLPToken`)
  );

  const lpByType = groupBy(lpHoldings, (item) => item.data?.type);

  // const holdingData = await prisma.defi_amm_lp.findMany({
  //   where: {
  //     owner,
  //     chain: "SUI",
  //     protocol: PROTOCOL,
  //   },
  //   orderBy: {
  //     timestamp: "asc",
  //   },
  // });
  const holdingData = [];

  const result = await Promise.all(
    Object.keys(lpByType).map(async (lpType) => {
      const lpList = lpByType[lpType] || [];
      const lp = lpList[0];
      const poolId = lp.data?.content?.fields?.pool_id;
      const poolData = holdingData.filter((item) => item.position === poolId);
      const addData = poolData.filter((item) => item.action === "Add");
      const removeData = poolData.filter((item) => item.action === "Remove");
      const [token0, token1] = parsePoolToken(lp.data?.type || "");

      const [poolContent, tokenAPrice, tokenBPrice] = await Promise.all([
        suiClient.getObject({
          id: poolId,
          options: {
            showContent: true,
          },
        }),
        getNimbusDBPrice(token0, "SUI"),
        getNimbusDBPrice(token1, "SUI"),
      ]);

      const ownerShare = sumBy(lpList, (item) =>
        Number(valueConvert(item.data?.content?.fields.lsp?.fields?.balance, 9))
      );

      const poolSupply =
        poolContent.data?.content?.fields?.lsp_supply?.fields?.value;
      const poolShare = ownerShare / Number(valueConvert(poolSupply, 9));
      const tokenAShare =
        poolShare *
        Number(
          valueConvert(
            poolContent.data?.content?.fields?.token_x,
            tokenAPrice.decimals || 9
          )
        );
      const tokenBShare =
        poolShare *
        Number(
          valueConvert(
            poolContent.data?.content?.fields?.token_y,
            tokenBPrice.decimals || 9
          )
        );

      return {
        positionId: lp.data?.content?.fields?.pool_id,
        owner,
        input: [
          {
            amount:
              sumBy(addData, (item) => item.token_a_quality) -
              sumBy(removeData, (item) => item.token_a_quality),
            value:
              sumBy(
                addData,
                (item) => item.token_a_quality * item.token_a_price
              ) -
              sumBy(
                removeData,
                (item) => item.token_a_quality * item.token_a_price
              ),
            token: tokenAPrice,
          },
          {
            amount:
              sumBy(addData, (item) => item.token_b_quality) -
              sumBy(removeData, (item) => item.token_b_quality),
            value:
              sumBy(
                addData,
                (item) => item.token_b_quality * item.token_b_price
              ) -
              sumBy(
                removeData,
                (item) => item.token_b_quality * item.token_b_price
              ),
            token: tokenBPrice,
          },
        ],
        current: {
          tokens: [
            {
              amount: tokenAShare,
              value: tokenAShare * tokenAPrice.price,
              token: tokenAPrice,
            },
            {
              amount: tokenBShare,
              value: tokenBShare * tokenBPrice.price,
              token: tokenBPrice,
            },
          ],
          yield: [],
        },
        fee: {
          value: sumBy(poolData, (item) => item.fee),
        },
        chain: "SUI",
        type: "AMM",
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

const getUserStaking = async (owner: string, { ownedObj }: SuiContext) => {
  const lpStakings = ownedObj.filter((item) =>
    item.data?.type?.startsWith(
      "0x88701243d0445aa38c0a13f02a9af49a58092dfadb93af9754edb41c52f40085::farm::StakedPosition"
    )
  ); // TODO: Move to config

  // const stakeData = await prisma.defi_stake.findMany({
  //   where: {
  //     owner,
  //     action: {
  //       in: ["Stake", "Unstake"],
  //     },
  //     chain: "SUI",
  //     protocol: PROTOCOL,
  //   },
  //   orderBy: {
  //     timestamp: "asc",
  //   },
  // });
  const stakeData = [];

  const stakeDataById = groupBy(stakeData, (item) => item.position);

  const result = await Promise.all(
    lpStakings.map(async (lp) => {
      const rewardPool = await suiClient.getObject({
        id: lp.data?.content.fields?.farm_id,
        options: {
          showContent: true,
        },
      });
      console.log("rewardPool", rewardPool);

      const poolContent = await suiClient.getObject({
        id: rewardPool?.data?.content?.fields?.staked?.fields?.pool_id,
        options: {
          showContent: true,
        },
      });

      const [token0, token1] = parsePoolToken(
        poolContent?.data?.content?.type || ""
      );
      console.log("pool", poolContent, token0, token1);

      const [tokenAPrice, tokenBPrice, suiPrice] = await Promise.all([
        getNimbusDBPrice(token0, "SUI"),
        getNimbusDBPrice(token1, "SUI"),
        getNimbusDBPrice("0x2::sui::SUI", "SUI"),
      ]);

      const ownerShare = Number(
        valueConvert(lp.data?.content?.fields?.stake_amount, 9)
      );

      const poolSupply =
        poolContent.data?.content?.fields?.lsp_supply?.fields?.value;
      const poolShare = ownerShare / Number(valueConvert(poolSupply, 9));

      const tokenAShare =
        poolShare *
        Number(
          valueConvert(
            poolContent.data?.content?.fields?.token_x,
            tokenAPrice.decimals || 9
          )
        );
      const tokenBShare =
        poolShare *
        Number(
          valueConvert(
            poolContent.data?.content?.fields?.token_y,
            tokenBPrice.decimals || 9
          )
        );

      const dbData = stakeDataById[lp.data?.content.fields?.farm_id] || [];

      // reward = Stake weight | Stake unit | Cumulative unit | last_harvest_time | Reward Amount | Reward interval | Total weight
      // This is get from their FE code
      const rewardJct = (
        e: BigInt,
        t: BigInt,
        n: BigInt,
        r: BigInt,
        i: BigInt,
        s: BigInt,
        o: BigInt
      ) => {
        const c = (() => {
            const u = new Date().getTime(),
              d = BigInt(Math.round(u)) - r;
            return d < 0 ? BigInt(0) : (d * i) / s;
          })(),
          l = n + (c * BigInt("18446744073709551616")) / o;
        return (e * (l - t)) / BigInt("18446744073709551616");
      };

      const rewardAmount = Number(
        valueConvert(
          rewardJct(
            BigInt(lp.data?.content.fields?.stake_weight || 0),
            BigInt(lp.data?.content.fields?.start_unit || 0),
            BigInt(rewardPool.data?.content.fields?.cumulative_unit || 0),
            BigInt(rewardPool.data?.content.fields?.last_harvest_time || 0),
            BigInt(rewardPool.data?.content.fields?.reward_amount || 0),
            BigInt(rewardPool.data?.content.fields?.reward_interval || 0),
            BigInt(rewardPool.data?.content.fields?.total_weight || 0)
          ),
          suiPrice.decimals || 9
        )
      );

      const data: Vest = {
        positionId: rewardPool.data?.objectId || "",
        owner: owner,
        input: [
          {
            amount: 0,
            value: 0,
            token: tokenAPrice,
          },
          {
            amount: 0,
            value: 0,
            token: tokenBPrice,
          },
        ], // TODO:
        yieldCollected: [], // TODO: Get from db
        current: {
          tokens: [
            {
              amount: tokenAShare,
              value: tokenAShare * tokenAPrice.price,
              token: tokenAPrice,
            },
            {
              amount: tokenBShare,
              value: tokenBShare * tokenBPrice.price,
              token: tokenBPrice,
            },
          ],
          endDate: new Date(Number(lp.data?.content.fields?.lock_until)),
          yield: [
            {
              amount: rewardAmount,
              value: rewardAmount * suiPrice.price,
              token: suiPrice,
            },
          ],
        },
        fee: {
          value: sumBy(dbData, (row) => row.fee),
        },
        chain: "SUI",
        type: "Vest",
        meta: {
          protocol: {
            name: PROTOCOL,
            logo: "",
            url: "",
          },
        },
      };

      return data;
    })
  );

  return result;
};

export const getUserPositions = async (
  owner: string,
  ctx: SuiContext
): Promise<Position[]> => {
  const result = await Promise.all([
    getUserLPPositions(owner, ctx),
    getUserStaking(owner, ctx),
  ]);

  return result.flat();
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
