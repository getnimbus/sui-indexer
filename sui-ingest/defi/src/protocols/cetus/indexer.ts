import { defi_clmm_lp, defi_stake } from "@prisma/client";
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
import { groupBy } from "lodash";
import { ClmmPoolUtil } from "@cetusprotocol/cetus-sui-clmm-sdk";

export const PROTOCOL = "CETUS";

const getPool = async (pool: string) => {
  return getPoolInfo(pool, async () => {
    const poolObject = await suiClient.getObject({
      id: pool,
      options: { showType: true, showOwner: true },
    });
    const [token0, token1] = parsePoolToken(poolObject.data?.type || "");
    const fee = Number(poolObject?.data?.content?.fields?.fee_rate || 0);

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
        18
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
        18
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

interface OpenPosition {
  pool: string;
  position: string;
  tick_lower: {
    bits: number;
  };
  tick_upper: {
    bits: number;
  };
}
export const openPositionsTopics = [
  "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb::pool::OpenPositionEvent",
];
export const processOpenPosition = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as OpenPosition;

  const poolData = await getPool(payload.pool);
  // const [tokenAPrice, tokenBPrice] = await Promise.all([
  //   getNimbusDBPrice(poolData.token0, "SUI", Number(event.timestampMs)),
  //   getNimbusDBPrice(poolData.token1, "SUI", Number(event.timestampMs)),
  // ]);

  const data: defi_clmm_lp = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    pool: payload.pool,
    token_a: poolData.token0,
    token_a_quality: 0,
    token_a_price: 0,
    token_b: poolData.token1,
    token_b_quality: 0,
    token_b_price: 0,
    tickLower: Number(payload.tick_lower.bits),
    tickUpper: Number(payload.tick_upper.bits),
    action: "Mint",
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    position: payload.position,
    fee: gasObj.gasFee,
    native_price: gasObj.nativePrice,
  };

  const result = await prisma.defi_clmm_lp.create({
    data,
  });

  return result;
};

interface AddLiquidity {
  amount_a: string;
  amount_b: string;
  liquidity: string;
  after_liquidity: string;
  pool: string;
  position: string;
  tick_lower: {
    bits: number;
  };
  tick_upper: {
    bits: number;
  };
}
export const addTopics = [
  "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb::pool::AddLiquidityEvent",
];
export const processAddLiquidity = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as AddLiquidity;

  console.log(payload);

  const poolData = await getPool(payload.pool);
  const [tokenAPrice, tokenBPrice] = await Promise.all([
    getNimbusDBPrice(poolData.token0, "SUI", Number(event.timestampMs)),
    getNimbusDBPrice(poolData.token1, "SUI", Number(event.timestampMs)),
  ]);

  const data: defi_clmm_lp = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    pool: payload.pool,
    token_a: poolData.token0,
    token_a_quality: Number(
      valueConvert(payload.amount_a, poolData.token0Decimal)
    ),
    token_a_price: tokenAPrice.price,
    token_b: poolData.token1,
    token_b_quality: Number(
      valueConvert(payload.amount_b, poolData.token1Decimal)
    ),
    token_b_price: tokenBPrice.price,
    tickLower: Number(payload.tick_lower.bits),
    tickUpper: Number(payload.tick_upper.bits),
    action: "Add",
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    position: payload.position,
    fee: gasObj.gasFee,
    native_price: gasObj.nativePrice,
  };

  const result = await prisma.defi_clmm_lp.create({
    data,
  });

  return result;
};

interface RemoveLiquidity {
  amount_a: string;
  amount_b: string;
  liquidity: string;
  after_liquidity: string;
  pool: string;
  position: string;
  tick_lower: {
    bits: number;
  };
  tick_upper: {
    bits: number;
  };
}
export const removeTopics = [
  "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb::pool::RemoveLiquidityEvent",
];
export const processRemoveLiquidity = async (
  event: SuiEvent,
  gasObj: GasObj
) => {
  const payload = event.parsedJson as RemoveLiquidity;

  const poolData = await getPool(payload.pool);
  const [tokenAPrice, tokenBPrice] = await Promise.all([
    getNimbusDBPrice(poolData.token0, "SUI", Number(event.timestampMs)),
    getNimbusDBPrice(poolData.token1, "SUI", Number(event.timestampMs)),
  ]);

  const data: defi_clmm_lp = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    pool: payload.pool,
    token_a: poolData.token0,
    token_a_quality: Number(
      valueConvert(payload.amount_a, poolData.token0Decimal)
    ),
    token_a_price: tokenAPrice.price,
    token_b: poolData.token1,
    token_b_quality: Number(
      valueConvert(payload.amount_b, poolData.token1Decimal)
    ),
    token_b_price: tokenBPrice.price,
    tickLower: Number(payload.tick_lower.bits),
    tickUpper: Number(payload.tick_upper.bits),
    action: "Remove",
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    position: payload.position,
    fee: gasObj.gasFee,
    native_price: gasObj.nativePrice,
  };

  const result = await prisma.defi_clmm_lp.create({
    data,
  });

  return result;
};

interface CollectFee {
  amount_a: string;
  amount_b: string;
  pool: string;
  position: string;
}
export const collectFeeTopics = [
  "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb::pool::CollectFeeEvent",
];
export const processCollectFee = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as CollectFee;

  const poolData = await getPool(payload.pool);
  const [tokenAPrice, tokenBPrice] = await Promise.all([
    getNimbusDBPrice(poolData.token0, "SUI", Number(event.timestampMs)),
    getNimbusDBPrice(poolData.token1, "SUI", Number(event.timestampMs)),
  ]);

  const data: defi_clmm_lp = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    pool: payload.pool,
    token_a: poolData.token0,
    token_a_quality: Number(
      valueConvert(payload.amount_a, poolData.token0Decimal)
    ),
    token_a_price: tokenAPrice.price,
    token_b: poolData.token1,
    token_b_quality: Number(
      valueConvert(payload.amount_b, poolData.token1Decimal)
    ),
    token_b_price: tokenBPrice.price,
    tickLower: 0,
    tickUpper: 0,
    action: "Fee",
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    position: payload.position,
    fee: gasObj.gasFee,
    native_price: gasObj.nativePrice,
  };

  const result = await prisma.defi_clmm_lp.create({
    data,
  });

  return result;
};

interface CloseLiquidity {
  pool: string;
  position: string;
}

export const closeTopics = [
  "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb::pool::ClosePositionEvent",
];
export const closeLiquidity = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as CloseLiquidity;

  const poolData = await getPool(payload.pool);
  // const [tokenAPrice, tokenBPrice] = await Promise.all([
  //   getNimbusDBPrice(poolData.token0, "SUI", Number(event.timestampMs)),
  //   getNimbusDBPrice(poolData.token1, "SUI", Number(event.timestampMs)),
  // ]);

  const data: defi_clmm_lp = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    pool: payload.pool,
    token_a: poolData.token0,
    token_a_quality: 0,
    token_a_price: 0,
    token_b: poolData.token1,
    token_b_quality: 0,
    token_b_price: 0,
    tickLower: 0,
    tickUpper: 0,
    action: "Close",
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    position: payload.position,
    fee: gasObj.gasFee,
    native_price: gasObj.nativePrice,
  };

  const result = await prisma.defi_clmm_lp.create({
    data,
  });

  return result;
};

interface MintXCetus {
  amount: string;
  lock_manager: string;
  venft_id: string;
}

export const mintXCetusTopics = [
  "0x9e69acc50ca03bc943c4f7c5304c2a6002d507b51c11913b247159c60422c606::locking::ConvertEvent",
];
export const mintXCetus = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as MintXCetus;

  const nativeToken =
    "0x6864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS";
  const [tokenAPrice] = await Promise.all([
    getNimbusDBPrice(nativeToken, "SUI", Number(event.timestampMs)),
  ]);

  const xToken =
    "0x9e69acc50ca03bc943c4f7c5304c2a6002d507b51c11913b247159c60422c606::xcetus::XCETUS";

  const data: defi_stake = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: xToken,
    token_input: nativeToken,
    token_input_quality: 0, // TODO:
    token_input_price: tokenAPrice.price,
    input_type: "Token",
    token_output: xToken,
    token_output_quality: Number(valueConvert(payload.amount, 9)),
    token_output_price: 0, // TODO:
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

interface RedeemCetus {
  amount: string;
  cetus_amount: string;
  lock_day: string;
  lock_manager: string;
  venft_id: string;
}

export const redeemTopics = [
  "0x9e69acc50ca03bc943c4f7c5304c2a6002d507b51c11913b247159c60422c606::locking::RedeemLockEvent",
];
export const redeemCetus = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as RedeemCetus;

  const nativeToken =
    "0x6864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS";
  const [tokenAPrice] = await Promise.all([
    getNimbusDBPrice(nativeToken, "SUI", Number(event.timestampMs)),
  ]);

  const xToken =
    "0x9e69acc50ca03bc943c4f7c5304c2a6002d507b51c11913b247159c60422c606::xcetus::XCETUS";

  const inputAmount = Number(valueConvert(payload.amount, 9));

  const data: defi_stake = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: xToken,
    token_input: xToken,
    token_input_quality: inputAmount,
    token_input_price: 0, // TODO:
    input_type: "Token",
    token_output: nativeToken,
    token_output_quality: Number(valueConvert(payload.cetus_amount, 9)),
    token_output_price: tokenAPrice.price,
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

interface StakeLP {
  clmm_pool_id: string;
  clmm_position_id: string;
  liquidity: string;
  pool_id: string;
  pool_total_share: string;
  share: string;
  sqrt_price: string;
  wrapped_position_id: string;
}

export const stakeLPTopics = [
  "0x11ea791d82b5742cc8cab0bf7946035c97d9001d7c3803a93f119753da66f526::pool::DepositEvent",
];
export const stakeLP = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as StakeLP;

  // const nativeToken =
  //   "0x6864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS";
  // const [tokenAPrice] = await Promise.all([
  //   getNimbusDBPrice(nativeToken, "SUI", Number(event.timestampMs)),
  // ]);

  // const xToken =
  //   "0x9e69acc50ca03bc943c4f7c5304c2a6002d507b51c11913b247159c60422c606::xcetus::XCETUS";

  const data: defi_stake = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: payload.pool_id,
    token_input: payload.clmm_position_id,
    token_input_quality: Number(valueConvert(payload.liquidity, 9)),
    token_input_price: 0,
    input_type: "LP",
    token_output: "",
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

interface UnstakeLP {
  clmm_pool_id: string;
  clmm_position_id: string;
  pool_id: string;
  share: string;
  wrapped_position_id: string;
}

export const unstakeLPTopics = [
  "0x11ea791d82b5742cc8cab0bf7946035c97d9001d7c3803a93f119753da66f526::pool::WithdrawEvent",
];
export const unstakeLP = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as UnstakeLP;

  // const nativeToken =
  //   "0x6864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS";
  // const [tokenAPrice] = await Promise.all([
  //   getNimbusDBPrice(nativeToken, "SUI", Number(event.timestampMs)),
  // ]);

  // const xToken =
  //   "0x9e69acc50ca03bc943c4f7c5304c2a6002d507b51c11913b247159c60422c606::xcetus::XCETUS";

  const data: defi_stake = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: payload.pool_id,
    token_input: payload.clmm_position_id,
    token_input_quality: Number(valueConvert(payload.share, 9)),
    token_input_price: 0,
    input_type: "LP",
    token_output: "", // TODO: Map to correct output
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

interface GetReward {
  amount: string;
  clmm_pool_id: string;
  clmm_position_id: string;
  pool_id: string;
  rewarder_type: {
    name: string;
  };
  wrapped_position_id: string;
}

export const getRewardTopics = [
  "0x11ea791d82b5742cc8cab0bf7946035c97d9001d7c3803a93f119753da66f526::pool::HarvestEvent",
];
export const getReward = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as GetReward;

  // const nativeToken =
  //   "0x6864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS";
  const [tokenPrice] = await Promise.all([
    getNimbusDBPrice(
      payload.rewarder_type.name,
      "SUI",
      Number(event.timestampMs)
    ),
  ]);

  // const xToken =
  //   "0x9e69acc50ca03bc943c4f7c5304c2a6002d507b51c11913b247159c60422c606::xcetus::XCETUS";

  const data: defi_stake = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: payload.pool_id,
    token_input: "",
    token_input_quality: 0,
    token_input_price: 0,
    input_type: "LP",
    token_output: payload.rewarder_type.name,
    token_output_quality: Number(
      valueConvert(payload.amount, tokenPrice?.decimals || 9)
    ),
    token_output_price: tokenPrice.price,
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
  {
    topics: openPositionsTopics,
    process: tryCatchFn(processOpenPosition, null),
  },
  { topics: addTopics, process: tryCatchFn(processAddLiquidity, null) },
  { topics: removeTopics, process: tryCatchFn(processRemoveLiquidity, null) },
  { topics: collectFeeTopics, process: tryCatchFn(processCollectFee, null) },
  { topics: closeTopics, process: tryCatchFn(closeLiquidity, null) },
  { topics: mintXCetusTopics, process: tryCatchFn(mintXCetus, null) },
  { topics: redeemTopics, process: tryCatchFn(redeemCetus, null) },
  { topics: stakeLPTopics, process: tryCatchFn(stakeLP, null) },
  { topics: unstakeLPTopics, process: tryCatchFn(unstakeLP, null) },
  { topics: getRewardTopics, process: tryCatchFn(getReward, null) },
];

export default handles;
