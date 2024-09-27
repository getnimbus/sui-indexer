import { groupBy, sumBy } from "lodash";
import {
  AMM,
  Borrow,
  Lending,
  Position,
  Stake,
  SuiContext,
  TokenState,
  Vest,
} from "../../interface";
import { suiClient } from "../../services/client";
import { prisma } from "../../services/db";
import { PROTOCOL } from "./indexer";
import {
  INimbusTokenPrice,
  getNimbusDBPrice,
  parsePoolToken,
  toTokenState,
  valueConvert,
} from "../../utils";
import { Aftermath, Pool } from "aftermath-ts-sdk";
import { getUserContext } from "../context";
import { getOrSet } from "../../services/cache";
const afSdk = new Aftermath("MAINNET"); // "MAINNET" | "TESTNET" | "DEVNET"

export const getUserLPPositions = async (
  owner: string,
  { balances }: SuiContext
): Promise<AMM[]> => {
  await afSdk.init(
    process.env.SUI_RPC_NODE
      ? { fullnodeUrl: process.env.SUI_RPC_NODE }
      : undefined
  ); // initialize provider
  const pools = afSdk.Pools();
  const allPools = await pools.getAllPools();
  const lpCoinTypes = allPools.map((item) => item.pool.lpCoinType);

  // const holdingData = await prisma.defi_cfmm_lp.findMany({
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

  const lpHoldings = balances.filter(
    (item) =>
      lpCoinTypes.includes(item.coinType) && BigInt(item.totalBalance) > 0
  );

  const result = await Promise.all(
    lpHoldings.map(async (lp) => {
      const pool = allPools.find(
        (item) => item.pool.lpCoinType === lp.coinType
      );
      const poolData = holdingData.filter(
        (item) => item.position === pool?.pool.objectId
      );
      const addData = poolData.filter((item) => item.action === "Add");
      const removeData = poolData.filter((item) => item.action === "Remove");

      const lpRatio =
        Number(valueConvert(lp.totalBalance, 18)) /
        Number(valueConvert(pool?.pool.lpCoinSupply, 18));
      const tokensOut = pool?.getAllCoinWithdrawAmountsOut({ lpRatio }) || {};

      const prices = await Promise.all(
        Object.keys(tokensOut).map((coinType) =>
          getNimbusDBPrice(coinType, "SUI")
        )
      );

      return {
        positionId: pool?.pool.objectId,
        owner,
        input: Object.keys(tokensOut).map((coinType, index) => {
          const price = prices[index];
          const addTokens = addData
            .map((item) => item.token_input)
            .flat()
            .filter((item) => item.token.contract_address === coinType);
          const removeTokens = addData
            .map((item) => item.token_input)
            .flat()
            .filter((item) => item.token.contract_address === coinType);
          const amount =
            sumBy(addTokens, (item) => item.amount) -
            sumBy(removeTokens, (item) => item.amount);
          const value =
            sumBy(addTokens, (item) => item.amount * item.value) -
            sumBy(removeTokens, (item) => item.amount * item.value);
          return {
            amount,
            value: value,
            token: price,
          };
        }),
        current: {
          tokens: Object.keys(tokensOut).map((coinType, index) => {
            const price = prices[index];
            return toTokenState(tokensOut[coinType], price);
          }),
          yield: [], // TODO
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

const getUserFarm = async (owner: string, ctx: SuiContext) => {
  const farms = afSdk.Farms();
  const pools = afSdk.Pools();
  const positions = await farms.getOwnedStakedPositions({
    walletAddress: owner,
  });

  const allPools = await pools.getAllPools(); // TODO: Cache me

  // const dbData = await prisma.defi_stake.findMany({
  //   where: {
  //     owner,
  //     chain: "SUI",
  //     action: {
  //       in: ["Stake", "Unstake"],
  //     },
  //     protocol: PROTOCOL,
  //   },
  //   orderBy: {
  //     timestamp: "asc",
  //   },
  // });
  const dbData = [];

  const dbDataById = groupBy(dbData, (item) => item.position);

  const result = await Promise.all(
    positions.map(async (position) => {
      const stakingPool = await farms.getStakingPool({
        objectId: position.stakedPosition.stakingPoolObjectId,
      });

      const yieldRewards = position.rewardCoinsToClaimableBalance({
        stakingPool,
      });

      const pool = allPools.find(
        (item) => item.pool.lpCoinType === position.stakedPosition.stakeCoinType
      );

      const outAmounts =
        pool?.getAllCoinWithdrawAmountsOut({
          lpRatio: Number(
            Number(valueConvert(position.stakedPosition.stakedAmount, 9)) /
              Number(valueConvert(pool.pool.lpCoinSupply, 9))
          ),
        }) || {};

      const [tokenPrices, yieldPrices] = await Promise.all([
        Promise.all(
          Object.keys(outAmounts).map((token) => getNimbusDBPrice(token, "SUI"))
        ),
        Promise.all(
          Object.keys(yieldRewards).map((token) =>
            getNimbusDBPrice(token, "SUI")
          )
        ),
      ]);

      const currentTokens = Object.keys(outAmounts).map((type, index) => {
        const price = tokenPrices[index];
        const amount = Number(
          valueConvert(outAmounts[type], price.decimals || 9)
        );

        return {
          amount,
          value: amount * price.price,
          token: price,
        };
      });

      const yieldTokens = Object.keys(yieldRewards).map((type, index) => {
        const price = yieldPrices[index];
        const amount = Number(
          valueConvert(yieldRewards[type], price.decimals || 9)
        );

        return {
          amount,
          value: amount * price.price,
          token: price,
        };
      });

      const yieldCollected = Object.keys(yieldRewards).map((type) =>
        position.rewardsEarned({ coinType: type, stakingPool })
      );

      const historicalData = dbDataById[position.stakedPosition.objectId] || [];

      const data: AMM = {
        positionId: position.stakedPosition.stakeCoinType,
        owner: owner,
        input: Object.keys(outAmounts).map((type, index) => {
          // TODO: Get from db
          return {
            amount: 0,
            value: 0,
            token: tokenPrices[index],
          };
        }),
        yieldCollected: Object.keys(yieldRewards).map((type, index) => {
          const price = yieldPrices[index]; // TODO: Get from price historical
          const amount = Number(
            valueConvert(yieldCollected[index], price.decimals || 9)
          );
          return {
            amount: amount,
            value: amount * price.price,
            token: price,
          };
        }),
        current: {
          tokens: currentTokens,
          yield: yieldTokens,
          endDate: new Date(
            position.stakedPosition.lockStartTimestamp +
              position.stakedPosition.lockDurationMs
          ),
        },
        fee: {
          value: sumBy(historicalData, (item) => item.fee),
        },
        tags: ["Staking"],
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

      return data;
    })
  );

  return result;
};

export const getUserPositions = async (
  owner: string,
  context: SuiContext
): Promise<Position[]> => {
  const result = await Promise.all([
    getUserLPPositions(owner, context),
    getUserFarm(owner, context),
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
