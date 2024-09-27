import { defi_cfmm_lp, defi_stake } from "@prisma/client";
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

export const PROTOCOL = "AftermathFinance";

interface AddLiquidity {
  deposits: string[];
  issuer: string;
  lp_coins_minted: string;
  pool_id: string;
  types: string[];
}

const addTopics = [
  "0xefe170ec0be4d762196bedecd7a065816576198a6527c99282a2551aaa7da38c::events::DepositEvent",
];
const processAddLiquidity = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as AddLiquidity;
  const tokens = payload.types.map((item) => "0x" + item);
  // const tokenMetas = await Promise.all(
  //   tokens.map((tokenType) =>
  //     cacheFn(
  //       `${tokenType}_decimals`,
  //       () =>
  //         getTokenDecimals(tokenType, () =>
  //           suiClient.getCoinMetadata({ coinType: tokenType }).then((data) => {
  //             return {
  //               id: uuidv4(),
  //               token_address: tokenType,
  //               token_name: data?.name || "",
  //               token_decimals: data?.decimals || 9,
  //               token_symbol: data?.symbol || "",
  //               chain: "SUI",
  //             };
  //           })
  //         ),
  //       9
  //     )
  //   )
  // );

  const prices = await Promise.all(
    tokens.map((tokenType) =>
      getNimbusDBPrice(tokenType, "SUI", Number(event.timestampMs))
    )
  );

  const data: defi_cfmm_lp = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    pool: payload.pool_id,
    token_input: tokens.map((tokenType, index) => {
      const price = prices[index];
      const amount = Number(
        valueConvert(payload.deposits[index], price.decimals || 9)
      );
      return {
        amount,
        value: amount * price.price,
        token: price,
      };
    }),
    token_output: [], // TODO: Output LP token
    lp_amount: Number(payload.lp_coins_minted),
    action: "Add",
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    position: payload.pool_id,
    fee: gasObj.gasFee,
    native_price: gasObj.nativePrice,
  };

  const result = await prisma.defi_cfmm_lp.create({
    data,
  });

  return result;
};

interface RemoveLiquidity {
  withdrawn: string[];
  issuer: string;
  lp_coins_burned: string;
  pool_id: string;
  types: string[];
}
const removeTopics = [
  "0xefe170ec0be4d762196bedecd7a065816576198a6527c99282a2551aaa7da38c::events::WithdrawEvent",
];
const processRemoveLiquidity = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as RemoveLiquidity;

  const tokens = payload.types.map((item) => "0x" + item);
  const prices = await Promise.all(
    tokens.map((tokenType) =>
      getNimbusDBPrice(tokenType, "SUI", Number(event.timestampMs))
    )
  );

  const data: defi_cfmm_lp = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    pool: payload.pool_id,
    token_input: [], // TODO: Input LP token
    token_output: tokens.map((tokenType, index) => {
      const price = prices[index];
      const amount = Number(
        valueConvert(payload.withdrawn[index], price.decimals || 9)
      );
      return {
        amount,
        value: amount * price.price,
        token: price,
      };
    }),
    lp_amount: Number(valueConvert(payload.lp_coins_burned, 9)), // TODO: Mapp to correct decimal
    action: "Remove",
    timestamp: new Date(Number(event.timestampMs)),
    block: BigInt(event.checkpoint),
    protocol: PROTOCOL,
    chain: "SUI",
    position: payload.pool_id,
    fee: gasObj.gasFee,
    native_price: gasObj.nativePrice,
  };

  const result = await prisma.defi_cfmm_lp.create({
    data,
  });

  return result;
};

interface Stake {
  lock_duration_ms: string;
  lock_multiplier: string;
  lock_start_timestamp_ms: string;
  multiplied_staked_amount: string;
  staked_amount: string;
  staked_position_id: string;
  staked_type: string;
  vault_id: string;
}
const stakeTopics = [
  "0x4f0a1a923dd063757fd37e04a9c2cee8980008e94433c9075c390065f98e9e4b::events::StakedEvent",
];
const processStake = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as Stake;

  const [prices] = await Promise.all([
    getNimbusDBPrice(payload.staked_type, "SUI", Number(event.timestampMs)),
  ]); // TODO: Maybe we need to get as lp price

  const amount = Number(valueConvert(payload.staked_amount, 9));

  const data: defi_stake = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: payload.staked_position_id,
    token_input: payload.staked_type,
    token_input_quality: amount,
    token_input_price: prices.price,
    input_type: "Token",
    token_output: "",
    token_output_quality: 0,
    token_output_price: 0,
    action: "Stake",
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

interface Unstake {
  amount: string;
  staked_type: string;
  staked_position_id: string;
  vault_id: string;
}
const unstakeTopics = [
  "0x4f0a1a923dd063757fd37e04a9c2cee8980008e94433c9075c390065f98e9e4b::events::WithdrewPrincipalEvent",
];
const processUnstake = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as Unstake;

  const [prices] = await Promise.all([
    getNimbusDBPrice(payload.staked_type, "SUI", Number(event.timestampMs)),
  ]); // TODO: Maybe we need to get as lp price

  const amount = Number(valueConvert(payload.amount, 9));

  const data: defi_stake = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: payload.staked_position_id,
    token_input: payload.staked_type,
    token_input_quality: amount,
    token_input_price: prices.price,
    input_type: "Token",
    token_output: "",
    token_output_quality: 0,
    token_output_price: 0,
    action: "Unstake",
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

interface Reward {
  afterburner_vault_id: string;
  reward_amounts: string[];
  reward_types: string[];
}
const rewardTopics = [
  "0x4f0a1a923dd063757fd37e04a9c2cee8980008e94433c9075c390065f98e9e4b::events::HarvestedRewardsEvent",
];
const processReward = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as Reward;

  const rewardTypes = payload.reward_types.map((item) => "0x" + item);

  const prices = await Promise.all(
    rewardTypes.map((type) =>
      getNimbusDBPrice(type, "SUI", Number(event.timestampMs))
    )
  );

  const txInfo = await suiClient.getTransactionBlock({
    digest: event.id.txDigest,
    options: {
      showEvents: true,
    },
  });

  const unlockEvent = txInfo.events?.find(
    (item) =>
      item.type ===
      "0x4f0a1a923dd063757fd37e04a9c2cee8980008e94433c9075c390065f98e9e4b::events::UnlockedEvent"
  );

  const positionId = unlockEvent?.parsedJson?.staked_position_id || "";

  const data: defi_stake[] = rewardTypes.map((type, index) => {
    const price = prices[index];
    const amount = Number(
      valueConvert(payload.reward_amounts[index], price.decimals || 9)
    );
    return {
      id: uuidv4(),
      tx_hash: event.id.txDigest,
      owner: event.sender,
      position: positionId,
      token_input: "",
      token_input_quality: amount,
      token_input_price: price.price,
      input_type: "Token",
      token_output: type,
      token_output_quality: 0,
      token_output_price: 0,
      action: "Reward",
      timestamp: new Date(Number(event.timestampMs)),
      block: BigInt(event.checkpoint),
      protocol: PROTOCOL,
      chain: "SUI",
      fee: gasObj.gasFee,
      native_price: gasObj.nativePrice,
    };
  });

  const result = await prisma.defi_stake.createMany({
    data,
    skipDuplicates: true,
  });

  return result;
};

const handles = [
  { topics: addTopics, process: tryCatchFn(processAddLiquidity, null) },
  { topics: removeTopics, process: tryCatchFn(processRemoveLiquidity, null) },
  { topics: stakeTopics, process: tryCatchFn(processStake, null) },
  { topics: unstakeTopics, process: tryCatchFn(processUnstake, null) },
  { topics: rewardTopics, process: tryCatchFn(processReward, null) },
];

export default handles;
