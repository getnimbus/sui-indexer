import { getFullnodeUrl, SuiClient } from "@mysten/sui.js/client";
import { KioskClient, Network } from "@mysten/kiosk";

const rpcUrl = getFullnodeUrl("mainnet");
export const suiClient = new SuiClient({
  url: process.env.SUI_RPC_NODE || rpcUrl,
});

export const kioskClient = new KioskClient({
  client: suiClient,
  network: Network.MAINNET,
});
