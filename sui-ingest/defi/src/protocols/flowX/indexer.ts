import { defi_amm_lp } from "@prisma/client";
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
import { getPools } from "@flowx-pkg/ts-sdk";

const PROTOCOL = "FlowX";

const getPoolByPair = async (coinXType: string, coinYType: string) => {
  // TODO: Make this one onchain
  // TODO: Check the case when the list update
  const poolList = await cacheFn(
    "flowX_pools",
    () => {
      return getPools();
    },
    { poolInfos: [], pairs: [] }
  );

  const { poolInfos, pairs } = poolList;
  const poolData = pairs.find(
    (item) => item.coinXType === coinXType && item.coinYType === coinYType
  );

  const [token0Decimal, token1Decimal] = await Promise.all([
    cacheFn(
      `${coinXType}_decimals`,
      () =>
        getTokenDecimals(coinXType, () =>
          suiClient.getCoinMetadata({ coinType: coinXType }).then((data) => {
            return {
              id: uuidv4(),
              token_address: coinXType,
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
      `${coinYType}_decimals`,
      () =>
        getTokenDecimals(coinYType, () =>
          suiClient.getCoinMetadata({ coinType: coinYType }).then((data) => {
            return {
              id: uuidv4(),
              token_address: coinYType,
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
    pool: poolData?.lpObjectId || ("" as any as string),
    lpType: poolData?.lpType || ("" as any as string),
    token0: coinXType,
    token0Decimal: Number(token0Decimal),
    token1: coinYType,
    token1Decimal: Number(token1Decimal),
    fee: Number(poolData?.feeRate || 0),
    exchangeName: PROTOCOL,
    chain: "SUI",
  };
};

interface AddLiquidity {
  amount_x: string;
  amount_y: string;
  coin_x: string;
  coin_y: string;
  fee: string;
  liquidity: string;
  user: string;
}

export const addTopics = [
  "0xba153169476e8c3114962261d1edc70de5ad9781b83cc617ecc8c1923191cae0::pair::LiquidityAdded",
];
export const processAddLiquidity = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as AddLiquidity;

  const token0 = "0x" + payload.coin_x;
  const token1 = "0x" + payload.coin_y;

  const poolData = await getPoolByPair(token0, token1);
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
    lp_amount: Number(payload.liquidity),
    action: "Add",
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    position: poolData.lpType,
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
  coin_x: string;
  coin_y: string;
  fee: string;
  liquidity: string;
  user: string;
}
export const removeTopics = [
  "0xba153169476e8c3114962261d1edc70de5ad9781b83cc617ecc8c1923191cae0::pair::LiquidityRemoved",
];
export const processRemoveLiquidity = async (
  event: SuiEvent,
  gasObj: GasObj
) => {
  const payload = event.parsedJson as RemoveLiquidity;

  const token0 = "0x" + payload.coin_x;
  const token1 = "0x" + payload.coin_y;

  const poolData = await getPoolByPair(token0, token1);
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
    lp_amount: Number(payload.liquidity),
    action: "Remove",
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    position: poolData.lpType,
    fee: gasObj.gasFee,
    native_price: gasObj.nativePrice,
  };

  const result = await prisma.defi_amm_lp.create({
    data,
  });

  return result;
};

const handles = [
  { topics: addTopics, process: tryCatchFn(processAddLiquidity, null) },
  { topics: removeTopics, process: tryCatchFn(processRemoveLiquidity, null) },
];

export default handles;
