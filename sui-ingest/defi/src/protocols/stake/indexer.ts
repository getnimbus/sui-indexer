import { defi_stake } from "@prisma/client";
import { prisma } from "../../services/db";
import { GasObj, SuiEvent } from "../../type";
import { getNimbusDBPrice, tryCatchFn, valueConvert } from "../../utils";
import { v4 as uuidv4 } from "uuid";

export const PROTOCOL = "Native Staking";

interface AccountStake {
  amount: string;
  epoch: string;
  pool_id: string;
  stake_address: string;
  validator_address: string;
}
export const stakeTopics = [`0x3::validator::StakingRequestEvent`];
export const processStakeSCoin = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as AccountStake;

  const [tokenPrice] = await Promise.all([
    getNimbusDBPrice("0x2::sui::SUI", "SUI", Number(event.timestampMs)),
    // getNimbusDBPrice(poolData.token1, "SUI", Number(event.timestampMs)),
  ]);

  const data: defi_stake = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: payload.validator_address,
    token_input: "0x2::sui::SUI",
    token_input_quality: Number(
      valueConvert(payload.amount, tokenPrice.decimals || 9)
    ),
    token_input_price: tokenPrice.price,
    input_type: "Stake",
    token_output: "",
    token_output_quality: 0,
    token_output_price: 0,
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
  pool_id: string;
  principal_amount: string;
  reward_amount: string;
  stake_activation_epoch: string;
  staker_address: string;
  unstaking_epoch: string;
  validator_address: string;
}
export const unstakeTopics = [`0x3::validator::UnstakingRequestEvent`];
export const processUnstakeSCoin = async (event: SuiEvent, gasObj: GasObj) => {
  const payload = event.parsedJson as AccountUnstake;

  const [tokenPrice] = await Promise.all([
    getNimbusDBPrice("0x2::sui::SUI", "SUI", Number(event.timestampMs)),
    // getNimbusDBPrice(poolData.token1, "SUI", Number(event.timestampMs)),
  ]);

  const data: defi_stake = {
    id: uuidv4(),
    tx_hash: event.id.txDigest,
    owner: event.sender,
    position: payload.validator_address,
    token_input: "",
    token_input_quality: 0,
    token_input_price: 0,
    input_type: "Stake",
    token_output: "0x2::sui::SUI",
    token_output_quality: Number(
      valueConvert(
        BigInt(payload.principal_amount) + BigInt(payload.reward_amount),
        tokenPrice.decimals || 9
      )
    ),
    token_output_price: tokenPrice.price,

    action: "Remove",
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
];

export default handles;
