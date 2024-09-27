import { trade } from "@prisma/client";
import { SuiEvent } from "../type";
import {
  cacheFn,
  getPoolInfo,
  getTokenDecimals,
  getTradeValue,
  parsePoolToken,
  tryCatchFn,
  valueConvert,
} from "../utils";
import { suiClient } from "../services/client";
import { v4 as uuidv4 } from "uuid";

interface SwapPayload {
  amount_in: string;
  amount_out: string;
  after_sqrt_price: string;
  before_sqrt_price: string;
  atob: boolean;
  fee_amount: string;
  partner: string;
  pool: string;
  ref_amount: string;
  vault_a_amount: string;
  vault_b_amount: string;
}

const PROTOCOL = "CETUS";

export const topic =
  "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb::pool::SwapEvent";
export const process = async (event: SuiEvent): Promise<trade> => {
  const payload = event.parsedJson as SwapPayload;

  const poolInfo = await getPoolInfo(payload.pool, async () => {
    const poolObject = await suiClient.getObject({
      id: payload.pool,
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

  const isFromA = payload.atob;
  const quanlityIn = Number(
    valueConvert(
      payload.amount_in,
      isFromA ? poolInfo.token0Decimal : poolInfo.token1Decimal
    )
  );
  const quanlityOut = Number(
    valueConvert(
      payload.amount_out,
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
