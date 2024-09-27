import { defi_amm_lp, defi_stake } from "@prisma/client";
import { GasObj, SuiEvent } from "../../type";
import {
  cacheFn,
  getNimbusDBPrice,
  getPoolInfo,
  getTokenDecimals,
  parsePoolToken,
  tryCatchFn,
  valueConvert,
} from "../../utils";
import { suiClient } from "../../services/client";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../../services/db";

export const PROTOCOL = "Kriya";

const getPool = async (pool: string) => {
  return getPoolInfo(pool, async () => {
    const poolObject = await suiClient.getObject({
      id: pool,
      options: { showType: true, showOwner: true },
    });
    const [token0, token1] = parsePoolToken(poolObject.data?.type || "");
    const fee = Number(poolObject?.data?.content?.fields?.lp_fee_percent || 0);

    const [token0Decimal, token1Decimal] = await Promise.all([
      cacheFn(
        `${token0}_decimals`,
        () =>
          getTokenDecimals(token0, () =>
            suiClient.getCoinMetadata({ coinType: token0 }).then((data) => {
              return {
                id: uuidv4(),
                token_address: token0,
                token_name: data?.name || "",
                token_decimals: data?.decimals || 9,
                token_symbol: data?.symbol || "",
                chain: "SUI",
              };
            })
          ),
        9
      ),
      cacheFn(
        `${token1}_decimals`,
        () =>
          getTokenDecimals(token1, () =>
            suiClient.getCoinMetadata({ coinType: token1 }).then((data) => {
              return {
                id: uuidv4(),
                token_address: token1,
                token_name: data?.name || "",
                token_decimals: data?.decimals || 9,
                token_symbol: data?.symbol || "",
                chain: "SUI",
              };
            })
          ),
        9
      ),
    ]);

    return {
      id: uuidv4(),
      pool,
      token0: token0,
      token0Decimal: Number(token0Decimal),
      token1: token1,
      token1Decimal: Number(token1Decimal),
      fee,
      exchangeName: PROTOCOL,
      chain: "SUI",
    };
  });
};

interface AddLiquidity {
  amount_x: string;
  amount_y: string;
  liquidity_provider: string;
  lsp_minted: string;
  pool_id: string;
}

export const addTopics = [
  "0xa0eba10b173538c8fecca1dff298e488402cc9ff374f8a12ca7758eebe830b66::spot_dex::LiquidityAddedEvent",
];
export const processAddLiquidity = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as AddLiquidity;

  const poolData = await getPool(payload.pool_id);
  const [tokenAPrice, tokenBPrice] = await Promise.all([
    getNimbusDBPrice(poolData.token0, "SUI", Number(event.timestampMs)),
    getNimbusDBPrice(poolData.token1, "SUI", Number(event.timestampMs)),
  ]);

  const data: defi_amm_lp = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    pool: poolData.pool,
    token_a: poolData.token0,
    token_a_quality: Number(
      valueConvert(payload.amount_x, poolData.token0Decimal)
    ),
    token_a_price: tokenAPrice.price,
    token_b: poolData.token1,
    token_b_quality: Number(
      valueConvert(payload.amount_y, poolData.token1Decimal)
    ),
    token_b_price: tokenBPrice.price,
    lp_amount: Number(payload.lsp_minted),
    action: "Add",
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    position: poolData.pool,
    fee: gasObj.gasFee,
    native_price: gasObj.nativePrice,
  };

  const result = await prisma.defi_amm_lp.create({
    data,
  });

  return result;
};

interface RemoveLiquidity {
  amount_x: string;
  amount_y: string;
  liquidity_provider: string;
  lsp_burned: string;
  pool_id: string;
}
export const removeTopics = [
  "0xa0eba10b173538c8fecca1dff298e488402cc9ff374f8a12ca7758eebe830b66::spot_dex::LiquidityRemovedEvent",
];
export const processRemoveLiquidity = async (
  event: SuiEvent,
  gasObj: GasObj
) => {
  const payload = event.parsedJson as RemoveLiquidity;

  const poolData = await getPool(payload.pool_id);
  const [tokenAPrice, tokenBPrice] = await Promise.all([
    getNimbusDBPrice(poolData.token0, "SUI", Number(event.timestampMs)),
    getNimbusDBPrice(poolData.token1, "SUI", Number(event.timestampMs)),
  ]);

  const data: defi_amm_lp = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    pool: poolData.pool,
    token_a: poolData.token0,
    token_a_quality: Number(
      valueConvert(payload.amount_x, poolData.token0Decimal)
    ),
    token_a_price: tokenAPrice.price,
    token_b: poolData.token1,
    token_b_quality: Number(
      valueConvert(payload.amount_y, poolData.token1Decimal)
    ),
    token_b_price: tokenBPrice.price,
    lp_amount: Number(payload.lsp_burned),
    action: "Remove",
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    position: poolData.pool,
    fee: gasObj.gasFee,
    native_price: gasObj.nativePrice,
  };

  const result = await prisma.defi_amm_lp.create({
    data,
  });

  return result;
};

interface StakeLiquidity {
  farm_id: string;
  lock_time: string;
  stake_amount: string;
  stake_weight: string;
  start_time: string;
}
export const stakeTopics = [
  "0x88701243d0445aa38c0a13f02a9af49a58092dfadb93af9754edb41c52f40085::farm::StakeEvent",
];

export const processStakeLiquidity = async (
  event: SuiEvent,
  gasObj: GasObj
) => {
  const payload = event.parsedJson as StakeLiquidity;

  const data: defi_stake = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: payload.farm_id,
    token_input: payload.farm_id, // TODO:
    token_input_quality: 0,
    token_input_price: 0,
    input_type: "LP",
    token_output: "", // TODO:
    token_output_quality: 0,
    token_output_price: 0,
    action: "Stake",
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    fee: gasObj.gasFee,
    native_price: gasObj.nativePrice,
  };

  const result = await prisma.defi_stake.create({
    data,
  });

  return result;
};

interface UnstakeLiquidity {
  end_time: string;
  farm_id: string;
  unstake_amount: string;
  unstake_weight: string;
}
export const unstakeTopics = [
  "0x88701243d0445aa38c0a13f02a9af49a58092dfadb93af9754edb41c52f40085::farm::UnstakeEvent",
];

export const processUnstakeLiquidity = async (
  event: SuiEvent,
  gasObj: GasObj
) => {
  const payload = event.parsedJson as UnstakeLiquidity;

  const data: defi_stake = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: payload.farm_id,
    token_input: payload.farm_id, // TODO:
    token_input_quality: 0,
    token_input_price: 0,
    input_type: "LP",
    token_output: "", // TODO:
    token_output_quality: 0,
    token_output_price: 0,
    action: "Unstake",
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    fee: gasObj.gasFee,
    native_price: gasObj.nativePrice,
  };

  const result = await prisma.defi_stake.create({
    data,
  });

  return result;
};

interface Claim {
  claim_time: string;
  farm_id: string;
  reward_amount: string;
}
export const claimTopics = [
  "0x88701243d0445aa38c0a13f02a9af49a58092dfadb93af9754edb41c52f40085::farm::ClaimEvent",
];

export const processClaim = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as Claim;

  // TODO: Get reward token type

  const data: defi_stake = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: payload.farm_id,
    token_input: payload.farm_id, // TODO:
    token_input_quality: 0,
    token_input_price: 0,
    input_type: "Claim",
    token_output: "", // TODO:
    token_output_quality: 0,
    token_output_price: 0,
    action: "Reward",
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    fee: gasObj.gasFee,
    native_price: gasObj.nativePrice,
  };

  const result = await prisma.defi_stake.create({
    data,
  });

  return result;
};

const handles = [
  { topics: addTopics, process: tryCatchFn(processAddLiquidity, null) },
  { topics: removeTopics, process: tryCatchFn(processRemoveLiquidity, null) },
  { topics: stakeTopics, process: tryCatchFn(processStakeLiquidity, null) },
  { topics: unstakeTopics, process: tryCatchFn(processUnstakeLiquidity, null) },
  { topics: claimTopics, process: tryCatchFn(processClaim, null) },
];

export default handles;
