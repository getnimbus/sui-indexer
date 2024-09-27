import { trade } from "@prisma/client";
import { SuiEvent } from "../type";
import {
  cacheFn,
  getPoolInfo,
  getTokenDecimals,
  getTradeValue,
  parsePoolToken,
  parseWrapperObj,
  tryCatchFn,
  valueConvert,
} from "../utils";
import { suiClient } from "../services/client";
import { v4 as uuidv4 } from "uuid";

interface SwapPayload {
  a_to_b: boolean;
  amount_a: string;
  amount_b: string;
  fee_amount: string;
  is_exact_in: boolean;
  liquidity: string;
  pool: string;
  protocol_fee: string;
  recipient: string;
  sqrt_price: string;
}

const PROTOCOL = "TurbosFinance";

export const topic =
  "0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1::pool::SwapEvent";
export const process = async (event: SuiEvent): Promise<trade> => {
  const payload = event.parsedJson as SwapPayload;

  const poolInfo = await getPoolInfo(payload.pool, async () => {
    const poolObject = await suiClient.getObject({
      id: payload.pool,
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
      pool: payload.pool,
      token0: token0,
      token0Decimal: Number(token0Decimal),
      token1: token1,
      token1Decimal: Number(token1Decimal),
      fee,
      exchangeName: PROTOCOL,
      chain: "SUI",
    };
  });

  const isFromA = payload.a_to_b;
  const quanlityIn = Number(
    valueConvert(
      isFromA ? payload.amount_a : payload.amount_b,
      isFromA ? poolInfo.token0Decimal : poolInfo.token1Decimal
    )
  );
  const quanlityOut = Number(
    valueConvert(
      isFromA ? payload.amount_b : payload.amount_a,
      isFromA ? poolInfo.token1Decimal : poolInfo.token0Decimal
    )
  );

  const fromAddress = isFromA ? poolInfo.token0 : poolInfo.token1;
  const toAddress = isFromA ? poolInfo.token1 : poolInfo.token0;

  const amountUsd: number = await getTradeValue({
    fromAddress,
    fromAmount: quanlityIn,
    toAddress,
    toAmount: quanlityOut,
    header: {
      height: Number(event.checkpoint),
      timestamp: Number(event.timestampMs),
    },
  });

  return {
    id: uuidv4(),
    block: Number(event.checkpoint),
    tx_hash: event.id.txDigest,
    from_token_address: fromAddress,
    to_token_address: toAddress,
    sender_address: "",
    origin_sender_address: event.sender,
    quanlity_in: quanlityIn,
    quanlity_out: quanlityOut,
    log_index: Number(event.id.eventSeq),
    exchange_name: PROTOCOL,
    timestamp: new Date(Number(event.timestampMs)),
    pool_address: payload.pool,
    amount_usd: amountUsd,
    chain: "SUI",
    fee: 0, // TODO:
    native_price: 0, // TODO:
  };
};

const handles = [{ topic, process: tryCatchFn(process, null) }];

export default handles;
