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
  referrer: string;
  router_fee: string;
  router_fee_recipient: string;
  swapper: string;
  type_in: string;
  type_out: string;
}

const PROTOCOL = "AftermathFinance";

export const topic =
  "0xdc15721baa82ba64822d585a7349a1508f76d94ae80e899b06e48369c257750e::swap_cap::SwapCompletedEvent";
export const process = async (event: SuiEvent): Promise<trade> => {
  const payload = event.parsedJson as SwapPayload;

  const [tokenIn, tokenOut] = ["0x" + payload.type_in, "0x" + payload.type_out];

  const [token0Decimal, token1Decimal] = await Promise.all([
    cacheFn(
      `${tokenIn}_decimals`,
      () =>
        getTokenDecimals(tokenIn, () =>
          suiClient.getCoinMetadata({ coinType: tokenIn }).then((data) => {
            return {
              id: uuidv4(),
              token_address: tokenIn,
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
      `${tokenOut}_decimals`,
      () =>
        getTokenDecimals(tokenOut, () =>
          suiClient.getCoinMetadata({ coinType: tokenOut }).then((data) => {
            return {
              id: uuidv4(),
              token_address: tokenOut,
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

  // const isFromA = payload.atob;
  const quanlityIn = Number(valueConvert(payload.amount_in, token0Decimal));
  const quanlityOut = Number(valueConvert(payload.amount_out, token1Decimal));

  const fromAddress = tokenIn;
  const toAddress = tokenOut;

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
    origin_sender_address: payload.swapper,
    quanlity_in: quanlityIn,
    quanlity_out: quanlityOut,
    log_index: Number(event.id.eventSeq),
    exchange_name: PROTOCOL,
    timestamp: new Date(Number(event.timestampMs)),
    pool_address: PROTOCOL, // TODO
    amount_usd: amountUsd,
    chain: "SUI",
    fee: 0, // TODO:
    native_price: 0, // TODO:
  };
};

interface SwapPayloadV2 {
  amounts_in: string[];
  amounts_out: string[];
  issuer: string;
  pool_id: string;
  types_in: string[];
  types_out: string[];
}
export const topicV2 =
  "0xefe170ec0be4d762196bedecd7a065816576198a6527c99282a2551aaa7da38c::events::SwapEvent";
export const processV2 = async (event: SuiEvent): Promise<trade> => {
  const payload = event.parsedJson as SwapPayloadV2;

  const [tokenIn, tokenOut] = [
    "0x" + payload.types_in[0],
    "0x" + payload.types_out[0],
  ];

  const [token0Decimal, token1Decimal] = await Promise.all([
    cacheFn(
      `${tokenIn}_decimals`,
      () =>
        getTokenDecimals(tokenIn, () =>
          suiClient.getCoinMetadata({ coinType: tokenIn }).then((data) => {
            return {
              id: uuidv4(),
              token_address: tokenIn,
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
      `${tokenOut}_decimals`,
      () =>
        getTokenDecimals(tokenOut, () =>
          suiClient.getCoinMetadata({ coinType: tokenOut }).then((data) => {
            return {
              id: uuidv4(),
              token_address: tokenOut,
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

  // const isFromA = payload.atob;
  const quanlityIn = Number(valueConvert(payload.amounts_in[0], token0Decimal));
  const quanlityOut = Number(
    valueConvert(payload.amounts_out[0], token1Decimal)
  );

  const fromAddress = tokenIn;
  const toAddress = tokenOut;

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
    origin_sender_address: payload.issuer,
    quanlity_in: quanlityIn,
    quanlity_out: quanlityOut,
    log_index: Number(event.id.eventSeq),
    exchange_name: PROTOCOL,
    timestamp: new Date(Number(event.timestampMs)),
    pool_address: payload.pool_id,
    amount_usd: amountUsd,
    chain: "SUI",
    fee: 0, // TODO:
    native_price: 0, // TODO:
  };
};

const handles = [
  { topic, process: tryCatchFn(process, null) },
  { topic: topicV2, process: tryCatchFn(processV2, null) },
];

export default handles;
