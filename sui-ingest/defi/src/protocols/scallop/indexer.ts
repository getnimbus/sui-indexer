import { defi_lending, defi_stake } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../../services/db";
import { GasObj, SuiEvent } from "../../type";
import { getNimbusDBPrice, tryCatchFn, valueConvert } from "../../utils";
import { PACKAGE, SPOOL, scaAddress } from "./constants";

export const PROTOCOL = "Scallop";

interface AccountStake {
  previous_amount: string;
  sender: string;
  spool_account_id: string;
  spool_id: string;
  stake_amount: string;
  staking_type: {
    name: string;
  };
  timestamp: string;
}
export const stakeTopics = [`${SPOOL}::user::SpoolAccountStakeEvent`];
export const processStakeSCoin = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as AccountStake;

  // const [tokenAPrice, tokenBPrice] = await Promise.all([
  //   getNimbusDBPrice(poolData.token0, "SUI", Number(event.timestampMs)),
  //   getNimbusDBPrice(poolData.token1, "SUI", Number(event.timestampMs)),
  // ]);

  // TODO: Get the price of the token staking

  const data: defi_stake = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: payload.spool_account_id,
    token_input: payload.staking_type.name,
    token_input_quality: Number(valueConvert(payload.stake_amount, 9)), // TODO: Map the right decimals
    token_input_price: 0, // TODO:
    input_type: "Collateral",
    token_output: "",
    token_output_quality: 0, // TODO: Map the right decimals
    token_output_price: 0, // TODO:
    action: "Add",
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    fee: gasObj.gasFee,
    native_price: gasObj.nativePrice,
  };

  const result = await prisma.defi_stake.create({
    data,
  });

  return result;
};

interface AccountUnstake {
  remaining_amount: string;
  spool_account_id: string;
  spool_id: string;
  unstake_amount: string;
  staking_type: {
    name: string;
  };
  timestamp: string;
}
export const unstakeTopics = [`${SPOOL}::user::SpoolAccountUnstakeEvent`];
export const processUnstakeSCoin = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as AccountUnstake;

  // const [tokenAPrice, tokenBPrice] = await Promise.all([
  //   getNimbusDBPrice(poolData.token0, "SUI", Number(event.timestampMs)),
  //   getNimbusDBPrice(poolData.token1, "SUI", Number(event.timestampMs)),
  // ]);

  // TODO: Get the price of the token staking

  const data: defi_stake = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: payload.spool_account_id,
    token_input: "",
    token_input_quality: 0, // TODO: Map the right decimals
    token_input_price: 0, // TODO:
    input_type: "Collateral",
    action: "Remove",
    token_output: payload.staking_type.name,
    token_output_quality: Number(valueConvert(payload.unstake_amount, 9)), // TODO: Map the right decimals
    token_output_price: 0, // TODO:
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    fee: gasObj.gasFee,
    native_price: gasObj.nativePrice,
  };

  const result = await prisma.defi_stake.create({
    data,
  });

  return result;
};

interface Mint {
  deposit_amount: string;
  deposit_asset: { name: string };
  mint_amount: string;
  mint_asset: { name: string };
  minter: string;
  time: string;
}
export const mintTopics = [`${PACKAGE}::mint::MintEvent`];
export const processMintSCoin = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as Mint;

  const tokenInput = "0x" + payload.deposit_asset.name;

  const [tokenPrice] = await Promise.all([
    getNimbusDBPrice(tokenInput, "SUI", Number(event.timestampMs)),
  ]);

  const data: defi_lending = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: "0x" + payload.mint_asset.name,
    token_input: tokenInput,
    token_input_quality: Number(
      valueConvert(payload.deposit_amount, tokenPrice.decimals || 9)
    ),
    token_input_price: tokenPrice.price,
    action: "Add",
    token_output: "0x" + payload.mint_asset.name,
    token_output_quality: Number(
      valueConvert(payload.mint_amount, tokenPrice.decimals || 9)
    ),
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

interface Redeem {
  burn_amount: string;
  burn_asset: { name: string };
  redeemer: string;
  withdraw_amount: string;
  withdraw_asset: { name: string };
  minter: string;
  time: string;
}
export const redeemTopics = [`${PACKAGE}::redeem::RedeemEvent`];
export const processRedeemSCoin = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as Redeem;

  const tokenInput = "0x" + payload.burn_asset.name;
  const tokenOutput = "0x" + payload.withdraw_asset.name;

  const [tokenPrice] = await Promise.all([
    getNimbusDBPrice(tokenOutput, "SUI", Number(event.timestampMs)),
  ]);

  const data: defi_lending = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: tokenInput,
    token_input: tokenInput,
    token_input_quality: Number(
      valueConvert(payload.burn_amount, tokenPrice.decimals || 9)
    ),
    token_input_price: 0,
    action: "Remove",
    token_output: tokenOutput,
    token_output_quality: Number(
      valueConvert(payload.withdraw_amount, tokenPrice.decimals || 9)
    ),
    token_output_price: tokenPrice.price,
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

interface Collateral {
  deposit_amount: string;
  deposit_asset: { name: string };
  obligation: string;
  provider: string;
}
export const collateralTopics = [
  `${PACKAGE}::deposit_collateral::CollateralDepositEvent`,
];
export const processCollateral = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as Collateral;

  const tokenInput = "0x" + payload.deposit_asset.name;

  const [tokenPrice] = await Promise.all([
    getNimbusDBPrice(tokenInput, "SUI", Number(event.timestampMs)),
  ]);

  const data: defi_lending = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: payload.obligation,
    token_input: tokenInput,
    token_input_quality: Number(
      valueConvert(payload.deposit_amount, tokenPrice.decimals || 9)
    ),
    token_input_price: tokenPrice.price,
    action: "Collateral",
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

interface CollateralWithdraw {
  obligation: string;
  withdraw_amount: string;
  withdraw_asset: { name: string };
  taker: string;
}
const collateralWithdrawlTopics = [
  `0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fddf::withdraw_collateral::CollateralWithdrawEvent`,
];
const collateralWithdrawlProcess = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as CollateralWithdraw;
  const tokenOutput = "0x" + payload.withdraw_asset.name;

  const [tokenPrice] = await Promise.all([
    getNimbusDBPrice(tokenOutput, "SUI", Number(event.timestampMs)),
  ]);

  const data: defi_lending = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: payload.obligation,
    token_input: "",
    token_input_quality: 0,
    token_input_price: 0,
    action: "CollateralWithdrawl",
    token_output: tokenOutput,
    token_output_quality: Number(
      valueConvert(payload.withdraw_amount, tokenPrice.decimals || 9)
    ),
    token_output_price: tokenPrice.price,
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
  asset: { name: string };
  borrow_fee: string;
  borrower: string;
  obligation: string;
}
const borrowTopics = [
  `0xc38f849e81cfe46d4e4320f508ea7dda42934a329d5a6571bb4c3cb6ea63f5da::borrow::BorrowEventV2`,
];
const borrowCollateral = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as Borrow;
  const tokenOutput = "0x" + payload.asset.name;

  const [tokenPrice] = await Promise.all([
    getNimbusDBPrice(tokenOutput, "SUI", Number(event.timestampMs)),
  ]);

  const data: defi_lending = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: payload.obligation,
    token_input: "0x2::sui::SUI", // Fee charge in SUI
    token_input_quality: Number(valueConvert(payload.borrow_fee, 9)),
    token_input_price: gasObj.nativePrice,
    action: "Borrow",
    token_output: tokenOutput,
    token_output_quality: Number(
      valueConvert(tokenOutput, tokenPrice.decimals || 9)
    ),
    token_output_price: tokenPrice.price,
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
  asset: { name: string };
  obligation: string;
  repayer: string;
}
const repayTopics = [
  `0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fddf::repay::RepayEvent`,
];
const repayProcess = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as Repay;
  const tokenInput = "0x" + payload.asset.name;

  const [tokenPrice] = await Promise.all([
    getNimbusDBPrice(tokenInput, "SUI", Number(event.timestampMs)),
  ]);

  const data: defi_lending = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: payload.obligation,
    token_input: tokenInput,
    token_input_quality: Number(
      valueConvert(payload.amount, tokenPrice.decimals || 9)
    ),
    token_input_price: tokenPrice.price,
    action: "Repay",
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

interface RedeemRewardV2 {
  previous_points: string;
  redeemed_points: string;
  rewards: string;
  rewards_fee: string;
  rewards_pool_id: string;
  rewards_type: { name: string };
  spool_account_id: string;
  spool_id: string;
  staking_type: { name: string };
  timestamp: string;
  total_claimed_rewards: string;
  total_user_points: string;
}
const redeemRewardV2Topics = [
  `0xec1ac7f4d01c5bf178ff4e62e523e7df7721453d81d4904a42a0ffc2686c843d::user::SpoolAccountRedeemRewardsEventV2`, // TODO: Map to package
];
const processRedeemRewardV2 = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as RedeemRewardV2;

  const tokenOutput = "0x" + payload.rewards_type.name;

  const [tokenPrice] = await Promise.all([
    getNimbusDBPrice(tokenOutput, "SUI", Number(event.timestampMs)),
  ]);

  const data: defi_lending = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: payload.spool_account_id,
    token_input: "",
    token_input_quality: 0,
    token_input_price: 0,
    action: "Reward",
    token_output: tokenOutput,
    token_output_quality: Number(
      valueConvert(payload.rewards, tokenPrice.decimals || 9)
    ),
    token_output_price: tokenPrice.price,
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

interface IncentiveRedeemRewardV2 {
  rewards: string;
  rewards_fee: string;
  rewards_type: { name: string };
  sender: string;
}
const redeemIncentiveRewardV2Topics = [
  `0xc63072e7f5f4983a2efaf5bdba1480d5e7d74d57948e1c7cc436f8e22cbeb410::user::IncentiveAccountRedeemRewardsEventV2`, // TODO: Map to package
];
const processIncentiveRewardV2 = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as IncentiveRedeemRewardV2;

  const tokenOutput = "0x" + payload.rewards_type.name;

  const [tokenPrice] = await Promise.all([
    getNimbusDBPrice(tokenOutput, "SUI", Number(event.timestampMs)),
  ]);

  const data: defi_lending = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: event.sender, // TODO: How to mapping to correct reward?
    token_input: "",
    token_input_quality: 0,
    token_input_price: 0,
    action: "Reward",
    token_output: tokenOutput,
    token_output_quality: Number(
      valueConvert(payload.rewards, tokenPrice.decimals || 9)
    ),
    token_output_price: tokenPrice.price,
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

interface VeStake {
  locked_sca_amount: string;
  unlock_at: string;
  ve_sca_key: string;
}
const veStakeTopics = [
  `0xcfe2d87aa5712b67cad2732edb6a2201bfdf592377e5c0968b7cb02099bd8e21::ve_sca::VeScaMintedEvent`, // TODO: Map to package
];
const processVeStake = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as VeStake;

  const tokenInput = scaAddress;

  const [tokenPrice] = await Promise.all([
    getNimbusDBPrice(tokenInput, "SUI", Number(event.timestampMs)),
  ]);

  const data: defi_stake = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: payload.ve_sca_key,
    input_type: "Token",
    token_input: tokenInput,
    token_input_quality: Number(
      valueConvert(payload.locked_sca_amount, tokenPrice.decimals || 9)
    ),
    token_input_price: tokenPrice.price,
    action: "VeStake",
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

  const result = await prisma.defi_stake.create({
    data,
  });

  return result;
};

const handles = [
  {
    topics: stakeTopics,
    process: tryCatchFn(processStakeSCoin, null),
  },
  {
    topics: unstakeTopics,
    process: tryCatchFn(processUnstakeSCoin, null),
  },
  {
    topics: mintTopics,
    process: tryCatchFn(processMintSCoin, null),
  },
  {
    topics: redeemTopics,
    process: tryCatchFn(processRedeemSCoin, null),
  },
  {
    topics: collateralTopics,
    process: tryCatchFn(processCollateral, null),
  },
  {
    topics: collateralWithdrawlTopics,
    process: tryCatchFn(collateralWithdrawlProcess, null),
  },
  {
    topics: borrowTopics,
    process: tryCatchFn(borrowCollateral, null),
  },
  {
    topics: repayTopics,
    process: tryCatchFn(repayProcess, null),
  },
  {
    topics: redeemRewardV2Topics,
    process: tryCatchFn(processRedeemRewardV2, null),
  },
  {
    topics: redeemIncentiveRewardV2Topics,
    process: tryCatchFn(processIncentiveRewardV2, null),
  },
  {
    topics: veStakeTopics,
    process: tryCatchFn(processVeStake, null),
  },
];

export default handles;
