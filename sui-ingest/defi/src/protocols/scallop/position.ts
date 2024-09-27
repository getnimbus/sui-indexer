import { groupBy, sumBy } from "lodash";
import { PROTOCOL } from "./indexer";
import { prisma } from "../../services/db";
import { suiClient } from "../../services/client";
import {
  Borrow,
  CLMM,
  Lending,
  Stake,
  SuiContext,
  TokenState,
  Vest,
} from "../../interface";
import BN from "bn.js";
import {
  INimbusTokenPrice,
  getNimbusDBPrice,
  parseWrapperObj,
  valueConvert,
} from "../../utils";
import {
  Scallop,
  StakeAccount,
  Lending as ScallopLending,
} from "@scallop-io/sui-scallop-sdk";
import { PACKAGE, scaAddress } from "./constants";
import { getUserContext } from "../context";
import { defi_lending } from "@prisma/client";
const scallopSDK = new Scallop({
  networkType: "mainnet",
  fullnodeUrls: [process.env.SUI_RPC_NODE as string],
});

const getUserPositionsLending = async (
  owner: string,
  { balances }: SuiContext,
  lendings: Record<string, ScallopLending>
): Promise<Lending[]> => {
  console.time("Lending prepare");
  const scallopUtils = await scallopSDK.createScallopUtils();
  await scallopUtils.init();
  const scallopQuery = await scallopSDK.createScallopQuery();
  console.timeEnd("Lending prepare");

  const marketCoins = balances.filter((item) =>
    item.coinType.startsWith(`${PACKAGE}::reserve::MarketCoin`)
  );

  const poolInfo = await scallopQuery.getMarketPools(
    marketCoins.map((item) =>
      scallopUtils.parseCoinName(
        scallopUtils.parseCoinNameFromType(item.coinType)
      )
    )
  );

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

  const lendingByToken = groupBy(allLending, (item) => item.position);

  const result = await Promise.all(
    marketCoins
      .filter((coin) => BigInt(coin.totalBalance) > 0n)
      .map(async (coin) => {
        const lendingData = lendingByToken[coin.coinType] || [];
        const lendingIn = lendingData.filter((item) => item.action === "Add");
        const lendingOut = lendingData.filter(
          (item) => item.action === "Remove"
        );

        const tokenType = parseWrapperObj(coin.coinType);
        const scallopTokenName = scallopUtils.parseCoinName(
          scallopUtils.parseCoinNameFromType(coin.coinType)
        );
        const marketData = poolInfo[scallopTokenName];

        const [tokenPrice] = await Promise.all([
          getNimbusDBPrice(tokenType, "SUI"),
        ]);

        const inputAmount =
          sumBy(lendingIn, (item) => item.token_input_quality) -
          sumBy(lendingOut, (item) => item.token_input_quality);
        const outputAmount =
          Number(valueConvert(coin.totalBalance, tokenPrice.decimals || 9)) *
          Number(marketData?.conversionRate || 1);

        // const currentAmount = Number(valueConvert(coin.totalBalance, 9));

        return {
          positionId: coin.coinType,
          owner,
          input: [
            {
              amount: inputAmount,
              value:
                sumBy(
                  lendingIn,
                  (item) => item.token_input_quality * item.token_input_price
                ) -
                sumBy(
                  lendingOut,
                  (item) => item.token_input_quality * item.token_input_price
                ),
              token: tokenPrice,
            },
          ],
          yieldCollected: [], // TODO: Query from sql
          current: {
            tokens: [
              {
                amount: outputAmount,
                value: outputAmount * tokenPrice.price,
                token: tokenPrice, // TODO:
              },
            ],
            yield: [
              {
                amount: outputAmount - inputAmount, // TODO: What if our data is in-correct and it is wrong?
                value: (outputAmount - inputAmount) * tokenPrice.price,
                token: tokenPrice,
              },
            ],
          },
          fee: {
            value: sumBy(lendingData, (item) => item.fee),
          },
          chain: "SUI",
          type: "Lending",
          meta: {
            txs: lendingData.map((item) => item.tx_hash),
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

const getUserPositionsStaking = async (
  owner: string,
  context: SuiContext,
  allLendings: Record<string, ScallopLending>
): Promise<Stake[]> => {
  console.time("Prepare staking");
  const scallopUtils = await scallopSDK.createScallopUtils();
  await scallopUtils.init();
  const scallopQuery = await scallopSDK.createScallopQuery();
  // const lendings = await scallopQuery.getLendings(["sui", "usdc"], owner);

  console.timeEnd("Prepare staking");

  // const allStakesData = await prisma.defi_stake.findMany({
  //   where: {
  //     owner,
  //     chain: "SUI",
  //     protocol: PROTOCOL,
  //   },
  //   orderBy: {
  //     timestamp: "asc",
  //   },
  // });
  const allStakesData = [];

  const stakeByInput = groupBy(allStakesData, (item) => item.token_input);

  const result = await Promise.all(
    Object.keys(allLendings)
      .filter(
        (poolName) =>
          (allLendings[poolName] as ScallopLending).suppliedAmount > 0
      )
      .map(async (poolName) => {
        const dataBySPool = allLendings[poolName as any] as ScallopLending;
        const rewardCoinName = scallopUtils.getSpoolRewardCoinName(
          scallopUtils.parseMarketCoinName(poolName)
        ); // SUI
        const rewardCoinType = scallopUtils.parseCoinType(rewardCoinName);

        const [tokenPrice, rewardPrice] = await Promise.all([
          getNimbusDBPrice(dataBySPool.coinType, "SUI"),
          getNimbusDBPrice(rewardCoinType, "SUI"),
        ]);

        const dbData = stakeByInput[dataBySPool.marketCoinType] || [];

        const dbDataIn = dbData.filter((item) => item.action === "Add");
        const dbDataOut = dbData.filter((item) => item.action === "Remove");

        return {
          positionId: dataBySPool.coinType,
          owner: owner,
          input: [
            {
              amount:
                sumBy(dbDataIn, (row) => row.token_input_quality) -
                sumBy(dbDataOut, (row) => row.token_input_quality),
              value:
                sumBy(
                  dbDataIn,
                  (item) => item.token_input_quality * item.token_input_price
                ) -
                sumBy(
                  dbDataOut,
                  (item) => item.token_input_quality * item.token_input_price
                ),
              token: tokenPrice,
            },
          ],
          yieldCollected: [], // TODO: Get from DB
          current: {
            tokens: [
              {
                amount: dataBySPool.stakedCoin,
                value: dataBySPool.stakedCoin * tokenPrice.price,
                token: tokenPrice,
              },
            ],
            yield: [
              {
                amount: dataBySPool.availableClaimCoin,
                value: dataBySPool.availableClaimCoin * rewardPrice.price,
                token: rewardPrice,
                claimable: true,
              },
            ],
          },
          fee: sumBy(dbData, (row) => row.fee),
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

const getUserPositionsObligation = async (owner: string, ctx: SuiContext) => {
  const scallopUtils = await scallopSDK.createScallopUtils();
  await scallopUtils.init();
  const scallopQuery = await scallopSDK.createScallopQuery();
  // const lendings = await scallopQuery.getLendings(["sui", "usdc"], owner);
  const [obligations] = await Promise.all([
    scallopQuery
      .getObligationAccounts(owner, false)
      .then((data) => Object.values(data)),
  ]);

  // const allBorrowData = await prisma.defi_lending.findMany({
  //   where: {
  //     owner,
  //     chain: "SUI",
  //     protocol: PROTOCOL,
  //     action: {
  //       in: ["Collateral", "CollateralWithdrawl", "Borrow", "Repay"],
  //     },
  //   },
  //   orderBy: {
  //     timestamp: "asc",
  //   },
  // });
  const allBorrowData = [];

  const borrowById = groupBy(allBorrowData, (item) => item.position);

  const result = await Promise.all(
    obligations.map(async (obligationData) => {
      const collaterals = Object.values(obligationData?.collaterals).filter(
        (item) => item.depositedAmount > 0
      );
      const debts = Object.values(obligationData?.debts).filter(
        (item) => item.borrowedCoin > 0
      );
      const [collateralsPrice, debtsPrice] = await Promise.all([
        Promise.all(
          collaterals.map((item) => getNimbusDBPrice(item.coinType, "SUI"))
        ),
        Promise.all(
          debts.map((item) => getNimbusDBPrice(item.coinType, "SUI"))
        ),
      ]);

      const input = collaterals.map((item, index) => {
        const price = collateralsPrice[index];
        return {
          amount: item.depositedCoin,
          value: item.depositedCoin * price.price,
          token: price,
        };
      });

      const debtTokens = debts.map((item, index) => {
        const price = debtsPrice[index];
        return {
          amount: item.borrowedCoin,
          value: item.borrowedCoin * price.price,
          token: price,
        };
      });

      const dbData = borrowById[obligationData?.obligationId] || [];

      const data: Borrow = {
        positionId: obligationData?.obligationId as any,
        owner: owner,
        input: input,
        yieldCollected: [], // TODO: Get from incentives pool
        current: {
          tokens: debtTokens,
          yield: [],
          healthy: obligationData.totalRiskLevel,
        },
        fee: {
          value: sumBy(dbData, (row) => row.fee),
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
      };

      return data;
    })
  );

  return result;
};

interface VeSca {
  id: {
    id: string;
  };
  name: string;
  value: {
    type: string;
    fields: { locked_sca_amount: string; unlock_at: string };
  };
}

const getUserPositionsVeStaking = async (
  owner: string,
  { ownedObj }: SuiContext
) => {
  const veObjs = ownedObj.filter((item) =>
    item.data?.type?.startsWith(
      "0xcfe2d87aa5712b67cad2732edb6a2201bfdf592377e5c0968b7cb02099bd8e21::ve_sca::VeScaKey"
    )
  );

  // const allStakeData = await prisma.defi_stake.findMany({
  //   where: {
  //     owner,
  //     chain: "SUI",
  //     protocol: PROTOCOL,
  //     action: {
  //       in: ["VeStake"],
  //     },
  //   },
  //   orderBy: {
  //     timestamp: "asc",
  //   },
  // });
  const allStakeData = [];

  const allStakeDataById = groupBy(allStakeData, (item) => item.position);

  const objectIds = veObjs
    .map((r) => r.data?.objectId)
    .filter((i) => i !== undefined) as string[];
  const veScaObjects: VeSca[] = await Promise.all(
    objectIds.map((item) =>
      suiClient
        .getDynamicFieldObject({
          parentId:
            "0x0a0b7f749baeb61e3dfee2b42245e32d0e6b484063f0a536b33e771d573d7246",
          name: {
            type: "0x2::object::ID",
            value: item,
          },
        })
        .then((data) => data.data?.content.fields)
    )
  );

  const [scaPrice] = await Promise.all([getNimbusDBPrice(scaAddress, "SUI")]);

  const result = await Promise.all(
    veScaObjects.map(async (item) => {
      const scaAmountRaw = item.value?.fields?.locked_sca_amount;
      const amount = Number(valueConvert(scaAmountRaw, 9));
      const lockedUntil =
        Number(item.value?.fields?.unlock_at || 0) * 1000 || undefined;

      const dbData = allStakeDataById[item.name] || [];

      const data: Vest = {
        positionId: item.name,
        owner: owner,
        input: [
          {
            amount: sumBy(dbData, (item) => item.token_input_quality),
            value: sumBy(
              dbData,
              (item) => item.token_input_quality * item.token_input_price
            ),
            token: scaPrice,
          },
        ],
        yieldCollected: [],
        current: {
          tokens: [
            {
              amount,
              value: amount * scaPrice.price,
              token: scaPrice,
            },
          ],
          endDate: new Date(lockedUntil),
          yield: [],
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
  context: SuiContext
): Promise<(Lending | Borrow | Stake)[]> => {
  const scallopQuery = await scallopSDK.createScallopQuery();
  // const lendings = await scallopQuery.getLendings(["sui", "usdc"], owner);
  const [allLendings] = await Promise.all([
    // scallopQuery.getAllStakeAccounts(owner),
    scallopQuery.getLendings(undefined, owner),
  ]);

  const result = await Promise.all([
    getUserPositionsLending(owner, context, allLendings),
    getUserPositionsStaking(owner, context, allLendings),
    getUserPositionsObligation(owner, context), // Collateral
    getUserPositionsVeStaking(owner, context),
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
