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
  amount_x_in: string;
  amount_x_out: string;
  amount_y_in: string;
  amount_y_out: string;
  pool_id: string;
  token_x_in: string;
  token_x_out: string;
  token_y_in: string;
  token_y_out: string;
  user: string;
}

const PROTOCOL = "BlueMove";

export const topic =
  "0xb24b6789e088b876afabca733bed2299fbc9e2d6369be4d1acfa17d8145454d9::swap::Swap_Event";

// https://suiscan.xyz/mainnet/tx/Em4Ya3pbJ8G4SmyEoRrUbeumARbNvufNXBaE3GKPGCFA
export const process = async (event: SuiEvent): Promise<trade> => {
  const payload = event.parsedJson as SwapPayload;

  const [token0, token1] = parsePoolToken(event.type);
  const isFromA = BigInt(payload.amount_x_in) > 0;
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

  const quanlityIn = Number(
    valueConvert(
      isFromA ? payload.amount_x_in : payload.amount_y_in,
      isFromA ? token0Decimal : token1Decimal
    )
  );
  const quanlityOut = Number(
    valueConvert(
      isFromA ? payload.amount_y_out : payload.amount_x_out,
      isFromA ? token1Decimal : token0Decimal
    )
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
    sender_address: payload.user,
    origin_sender_address: event.sender,
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

const handles = [{ topic, process: tryCatchFn(process, null) }];

export default handles;
