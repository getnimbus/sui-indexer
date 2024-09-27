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
  in_amount: string;
  out_amount: string;
  pool_index: string;
  x_to_y: boolean;
}

const PROTOCOL = "SuiSwap";

export const topic =
  "0x361dd589b98e8fcda9a7ee53b85efabef3569d00416640d2faa516e3801d7ffc::pool::SwapTokenEvent";
export const process = async (event: SuiEvent): Promise<trade> => {
  const payload = event.parsedJson as SwapPayload;

  const [token0, token1] = parsePoolToken(event.type);

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
  const isFromA = payload.x_to_y;
  const quanlityIn = Number(
    valueConvert(payload.in_amount, isFromA ? token0Decimal : token1Decimal)
  );
  const quanlityOut = Number(
    valueConvert(payload.out_amount, isFromA ? token1Decimal : token0Decimal)
  );

  const fromAddress = isFromA ? token0 : token1;
  const toAddress = isFromA ? token1 : token0;

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
    pool_address: PROTOCOL, // TODO:
    amount_usd: amountUsd,
    chain: "SUI",
    fee: 0, // TODO:
    native_price: 0, // TODO:
  };
};

const handles = [{ topic, process: tryCatchFn(process, null) }];

export default handles;
