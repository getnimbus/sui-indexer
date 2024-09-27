import { defi_lending } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../../services/db";
import { GasObj, SuiEvent } from "../../type";
import { getNimbusDBPrice, tryCatchFn, valueConvert } from "../../utils";
import { suiClient } from "../../services/client";

export const PROTOCOL = "Navi";

interface Mint {
  amount: string;
  reserve: string;
  sender: string;
}
export const mintTopics = [
  "0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::lending::DepositEvent",
];
export const processMintCoin = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as Mint;
  const txData = await suiClient.getTransactionBlock({
    digest: event.id.txDigest,
    options: {
      showEvents: true,
    },
  });

  const poolDepositEvent = txData.events?.find(
    (item) =>
      item.type ===
      "0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::pool::PoolDeposit"
  );
  const depositData = poolDepositEvent?.parsedJson as PoolDeposit;

  const tokenInput = "0x" + depositData.pool;

  const [tokenAPrice] = await Promise.all([
    getNimbusDBPrice(tokenInput, "SUI", Number(event.timestampMs)),
  ]);

  const data: defi_lending = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: tokenInput,
    token_input: tokenInput,
    token_input_quality: Number(
      valueConvert(payload.amount, tokenAPrice.decimals || 9)
    ),
    token_input_price: tokenAPrice.price,
    action: "Add",
    token_output: "",
    token_output_quality: 0,
    token_output_price: 0,
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    fee: gasObj.gasFee,
    native_price: gasObj.nativePrice,
  };

  const result = await prisma.defi_lending.create({
    data,
  });

  return result;
};

interface Withdraw {
  amount: string;
  reserve: string;
  sender: string;
  to: string;
}
export const withdrawTopics = [
  "0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::lending::WithdrawEvent",
];
export const processWithdrawCoin = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as Withdraw;
  const txData = await suiClient.getTransactionBlock({
    digest: event.id.txDigest,
    options: {
      showEvents: true,
    },
  });

  const poolWithdrawEvent = txData.events?.find(
    (item) =>
      item.type ===
      "0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::pool::PoolWithdraw"
  );
  const withdrawData = poolWithdrawEvent?.parsedJson as PoolWithdraw;

  const tokenOutput = "0x" + withdrawData.pool;

  const [tokenAPrice] = await Promise.all([
    getNimbusDBPrice(tokenOutput, "SUI", Number(event.timestampMs)),
  ]);

  const data: defi_lending = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: tokenOutput,
    token_input: "",
    token_input_quality: 0,
    token_input_price: 0,
    action: "Remove",
    token_output: tokenOutput,
    token_output_quality: Number(
      valueConvert(payload.amount, tokenAPrice.decimals || 9)
    ),
    token_output_price: tokenAPrice.price,
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    fee: gasObj.gasFee,
    native_price: gasObj.nativePrice,
  };

  const result = await prisma.defi_lending.create({
    data,
  });

  return result;
};

interface Borrow {
  amount: string;
  reserve: string;
  sender: string;
}
interface PoolWithdraw {
  amount: string;
  pool: string;
  recipient: string;
  sender: string;
}
export const borrowTopics = [
  "0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::lending::BorrowEvent",
];
export const processBorrowCoin = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as Borrow;
  const txData = await suiClient.getTransactionBlock({
    digest: event.id.txDigest,
    options: {
      showEvents: true,
    },
  });

  const poolWithdrawEvent = txData.events?.find(
    (item) =>
      item.type ===
      "0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::pool::PoolWithdraw"
  );
  const withdrawData = poolWithdrawEvent?.parsedJson as PoolWithdraw;
  const tokenOutput = "0x" + withdrawData.pool; // TODO: Map me to token

  // const tokenInput = "0x" + payload.pool;

  const [tokenOutPrice] = await Promise.all([
    getNimbusDBPrice(tokenOutput, "SUI", Number(event.timestampMs)),
  ]);

  const data: defi_lending = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: tokenOutput,
    token_input: "",
    token_input_quality: 0,
    token_input_price: 0,
    token_output: tokenOutput,
    token_output_quality: Number(
      valueConvert(payload.amount, tokenOutPrice.decimals || 9)
    ),
    token_output_price: tokenOutPrice.price,
    action: "Borrow",
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    fee: gasObj.gasFee,
    native_price: gasObj.nativePrice,
  };

  const result = await prisma.defi_lending.create({
    data,
  });

  return result;
};

interface Repay {
  amount: string;
  reserve: string;
  sender: string;
}
interface PoolDeposit {
  amount: string;
  pool: string;
  sender: string;
}
export const repayTopics = [
  "0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::lending::RepayEvent",
];
export const processRepayCoin = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as Repay;
  const txData = await suiClient.getTransactionBlock({
    digest: event.id.txDigest,
    options: {
      showEvents: true,
    },
  });

  const poolDepositEvent = txData.events?.find(
    (item) =>
      item.type ===
      "0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::pool::PoolDeposit"
  );
  const depositData = poolDepositEvent?.parsedJson as PoolDeposit;
  const tokenOutput = "0x" + depositData.pool; // TODO: Map me to token

  // const tokenInput = "0x" + payload.pool;

  const [tokenOutPrice] = await Promise.all([
    getNimbusDBPrice(tokenOutput, "SUI", Number(event.timestampMs)),
  ]);

  const data: defi_lending = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: tokenOutput,
    token_input: tokenOutput,
    token_input_quality: Number(
      valueConvert(payload.amount, tokenOutPrice.decimals || 9)
    ),
    token_input_price: tokenOutPrice.price,
    token_output: "",
    token_output_quality: 0,
    token_output_price: 0,
    action: "Repay",
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    fee: gasObj.gasFee,
    native_price: gasObj.nativePrice,
  };

  const result = await prisma.defi_lending.create({
    data,
  });

  return result;
};

const handles = [
  {
    topics: mintTopics,
    process: tryCatchFn(processMintCoin, null),
  },
  {
    topics: withdrawTopics,
    process: tryCatchFn(processWithdrawCoin, null),
  },
  {
    topics: borrowTopics,
    process: tryCatchFn(processBorrowCoin, null),
  },
  {
    topics: repayTopics,
    process: tryCatchFn(processRepayCoin, null),
  },
];

export default handles;
