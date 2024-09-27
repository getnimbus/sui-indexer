import { getFullnodeUrl, SuiClient } from "@mysten/sui.js/client";

const rpcUrl = getFullnodeUrl("mainnet");
export const suiClient = new SuiClient({
  url: process.env.SUI_RPC_NODE || rpcUrl,
});
