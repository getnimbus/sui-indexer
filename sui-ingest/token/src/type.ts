import {
  SuiObjectChange,
  TransactionEffects,
} from "@mysten/sui.js/dist/cjs/client";

export type Chain = "SUI";

export interface BaseContext {
  chain: Chain;
  adapterId: string;
  blockHeight?: number;
}

export type Category =
  | "wallet"
  | "lend"
  | "borrow"
  | "stake"
  | "vest"
  | "lock"
  | "lp"
  | "farm"
  | "reward";

type ContractStandard = "token" | "nft" | "object";

export interface SuiEvent {
  id: {
    txDigest: string;
    eventSeq: string;
  };
  packageId: string;
  transactionModule: string;
  sender: string;
  type: string;
  parsedJson: any;
  timestampMs: string;
  dateKey: string;
  checkpoint: string;
  gasUsed: Record<string, string>;
}

export interface SuiTx {
  digest: string;
  checkpoint: string;
  timestampMs?: string | null;
  effects?: TransactionEffects | null;
  objectChanges?: SuiObjectChange[] | null;
  events?: SuiEvent[] | null;
}

export interface BaseIndexerConfig {
  fromSnapshot: number;
  getLatestIndexed(): Promise<number | null>;
  getBackfillRange(): Promise<[number, number]>;
}

export type EventHandler = (events: SuiEvent[]) => Promise<any>;
export interface EventIndexerConfig extends BaseIndexerConfig {
  type: "event";
  eventTypes: string[];
  handler: EventHandler;
}

export type TxHandler = (txs: SuiTx[]) => Promise<any>;
export interface TxIndexerConfig extends BaseIndexerConfig {
  type: "tx";
  objectTypes: string[];
  handler: TxHandler;
}

export type IndexerConfig = EventIndexerConfig | TxIndexerConfig;
export type IndexerHandler = EventHandler | TxHandler;
