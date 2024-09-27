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

const PROTOCOL = "SuiSwap";

interface AddLiquidity {
  is_added: boolean;
  lsp_amount: string;
  lsp_id: string;
  pool_index: string;
  x_amount: string;
  y_amount: string;
}

export const addTopics = [
  "0x361dd589b98e8fcda9a7ee53b85efabef3569d00416640d2faa516e3801d7ffc::pool::LiquidityEvent",
];
export const processAddLiquidity = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as AddLiquidity;

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
  const [tokenAPrice, tokenBPrice] = await Promise.all([
    getNimbusDBPrice(token0, "SUI", Number(event.timestampMs)),
    getNimbusDBPrice(token1, "SUI", Number(event.timestampMs)),
  ]);

  const data: defi_amm_lp = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    pool: PROTOCOL,
    token_a: token0,
    token_a_quality: Number(valueConvert(payload.x_amount, token0Decimal)),
    token_a_price: tokenAPrice.price,
    token_b: token1,
    token_b_quality: Number(valueConvert(payload.y_amount, token1Decimal)),
    token_b_price: tokenBPrice.price,
    lp_amount: Number(payload.lsp_amount),
    action: payload.is_added ? "Add" : "Remove",
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    position: PROTOCOL,
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

  // TODO: LP staked
];

export default handles;
