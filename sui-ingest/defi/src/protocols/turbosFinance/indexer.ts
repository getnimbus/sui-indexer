import { defi_clmm_lp } from "@prisma/client";
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

const PROTOCOL = "TurbosFinance";

const getPool = async (pool: string) => {
  return getPoolInfo(pool, async () => {
    const poolObject = await suiClient.getObject({
      id: pool,
      options: { showType: true, showOwner: true },
    });

    const wrappedObj = parseWrapperObj(poolObject.data?.type || "");
    const [token0, token1] = wrappedObj.split(", ");
    const fee = Number(poolObject?.data?.content?.fields?.fee || 0);

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
      pool: pool,
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

interface MintLiquidity {
  amount_a: string;
  amount_b: string;
  liquidity_delta: string;
  owner: string;
  pool: string;
  tick_lower_index: {
    bits: number;
  };
  tick_upper_index: {
    bits: number;
  };
}
export const mintTopics = [
  "0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1::pool::MintEvent",
];
export const processMintLiquidity = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as MintLiquidity;

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
    tickLower: Number(payload.tick_lower_index.bits),
    tickUpper: Number(payload.tick_upper_index.bits),
    action: "Mint",
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    position: payload.pool, // TODO:
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
  pool: string;
}
export const addTopics = [
  "0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1::position_manager::IncreaseLiquidityEvent",
];
export const processAddLiquidity = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as AddLiquidity;

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
    tickLower: 0, // TODO:
    tickUpper: 0, // TODO:
    action: "Add",
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    position: payload.pool,
    fee: gasObj.gasFee,
    native_price: gasObj.nativePrice,
  };

  const result = await prisma.defi_clmm_lp.create({
    data,
  });

  return result;
};

interface BurnLiquidity {
  amount_a: string;
  amount_b: string;
  liquidity: string;
  pool: string;
}
export const burnTopics = [
  "0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1::position_manager::DecreaseLiquidityEvent",
];
// https://suiscan.xyz/mainnet/tx/9LfZsEMiWroSTCwEyFZWYAFsiRRzUMWYWrswrXhYmRtj
export const processBurnLiquidity = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as BurnLiquidity;

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
    tickLower: 0, // TODO:
    tickUpper: 0, // TODO:
    action: "Remove",
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    position: payload.pool,
    fee: gasObj.gasFee,
    native_price: gasObj.nativePrice,
  };

  const result = await prisma.defi_clmm_lp.create({
    data,
  });

  return result;
};

interface CollectFee {
  amount: string;
  pool: string;
  recipient: string;
  reward_index: string;
  vault: string;
}
export const collectFeeTopics = [
  "0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1::position_manager::CollectRewardEvent",
];
export const processCollectFee = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as CollectFee;

  const poolData = await getPool(payload.pool);
  const [tokenAPrice, tokenBPrice] = await Promise.all([
    getNimbusDBPrice(poolData.token0, "SUI", Number(event.timestampMs)),
    getNimbusDBPrice(poolData.token1, "SUI", Number(event.timestampMs)),
  ]);

  const isTokenA = payload.reward_index === "0";
  // const token = isTokenA ? poolData.token0 : poolData.token1;
  const quality = Number(
    valueConvert(
      payload.amount,
      isTokenA ? poolData.token0Decimal : poolData.token1Decimal
    )
  );

  const data: defi_clmm_lp = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    pool: payload.pool,
    token_a: poolData.token0,
    token_a_quality: isTokenA ? quality : 0,
    token_a_price: tokenAPrice.price,
    token_b: poolData.token1,
    token_b_quality: isTokenA ? 0 : quality,
    token_b_price: tokenBPrice.price,
    tickLower: 0,
    tickUpper: 0,
    action: "Fee",
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    position: payload.pool,
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

const handles = [
  { topics: mintTopics, process: tryCatchFn(processMintLiquidity, null) },
  // { topics: addTopics, process: tryCatchFn(processAddLiquidity, null) },
  {
    topics: burnTopics,
    process: tryCatchFn(processBurnLiquidity, null),
  },
  // { topics: removeTopics, process: tryCatchFn(processRemoveLiquidity, null) },
  { topics: collectFeeTopics, process: tryCatchFn(processCollectFee, null) },
  // { topics: closeTopics, process: tryCatchFn(closeLiquidity, null) },
];

export default handles;
