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

const PROTOCOL = "BlueMove";

interface AddLiquidity {
  fee_amount: string;
  lsp_balance: string;
  pool_id: string;
  token_x_amount_in: string;
  token_x_name: string;
  token_y_amount_in: string;
  token_y_name: string;
  user: string;
}

export const addTopics = [
  "0xb24b6789e088b876afabca733bed2299fbc9e2d6369be4d1acfa17d8145454d9::swap::Add_Liquidity_Pool",
];
export const processAddLiquidity = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as AddLiquidity;

  const [tokenAPrice, tokenBPrice] = await Promise.all([
    getNimbusDBPrice(payload.token_x_name, "SUI", Number(event.timestampMs)),
    getNimbusDBPrice(payload.token_y_name, "SUI", Number(event.timestampMs)),
  ]);

  const data: defi_amm_lp = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    pool: payload.pool_id,
    token_a: payload.token_x_name,
    token_a_quality: Number(
      valueConvert(payload.token_x_amount_in, tokenAPrice?.decimals || 9)
    ),
    token_a_price: tokenAPrice.price,
    token_b: payload.token_y_name,
    token_b_quality: Number(
      valueConvert(payload.token_y_amount_in, tokenBPrice?.decimals || 9)
    ),
    token_b_price: tokenBPrice.price,
    lp_amount: Number(payload.lsp_balance),
    action: "Add",
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    position: payload.pool_id,
    fee: gasObj.gasFee,
    native_price: gasObj.nativePrice,
  };

  const result = await prisma.defi_amm_lp.create({
    data,
  });

  return result;
};

interface RemoveLiquidity {
  fee_amount: string;
  pool_id: string;
  token_x_amount_out: string;
  token_x_name: string;
  token_y_amount_out: string;
  token_y_name: string;
  user: string;
}
export const removeTopics = [
  "0xb24b6789e088b876afabca733bed2299fbc9e2d6369be4d1acfa17d8145454d9::swap::Remove_Liqidity_Pool",
];
export const processRemoveLiquidity = async (
  event: SuiEvent,
  gasObj: GasObj
) => {
  const payload = event.parsedJson as RemoveLiquidity;

  const [tokenAPrice, tokenBPrice] = await Promise.all([
    getNimbusDBPrice(payload.token_x_name, "SUI", Number(event.timestampMs)),
    getNimbusDBPrice(payload.token_y_name, "SUI", Number(event.timestampMs)),
  ]);

  const data: defi_amm_lp = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    pool: payload.pool_id,
    token_a: payload.token_x_name,
    token_a_quality: Number(
      valueConvert(payload.token_x_amount_out, tokenAPrice.decimals || 9)
    ),
    token_a_price: tokenAPrice.price,
    token_b: payload.token_y_name,
    token_b_quality: Number(
      valueConvert(payload.token_y_amount_out, tokenBPrice.decimals || 9)
    ),
    token_b_price: tokenBPrice.price,
    lp_amount: 0, // TODO: Check how to get this
    action: "Remove",
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    position: payload.pool_id,
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

  // TODO: LP staked
];

export default handles;
