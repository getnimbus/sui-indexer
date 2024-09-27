import { SuiEvent } from "./type";
import { processingConfig } from "./main";
import { suiClient } from "./services/client";

const events: SuiEvent[] = [
  {
    id: {
      txDigest: "5yY69PPqjKw9NXBFsxPKmdVA3CHNokp76ow5BDRiSRHd",
      eventSeq: "0",
    },
    packageId:
      "0x996c4d9480708fb8b92aa7acf819fb0497b5ec8e65ba06601cae2fb6db3312c3",
    transactionModule: "pool_script_v2",
    sender:
      "0x692853c81afc8f847147c8a8b4368dc894697fc12b929ef3071482d27339815e",
    type: "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb::pool::OpenPositionEvent",
    parsedJson: {
      pool: "0xc8d7a1503dc2f9f5b05449a87d8733593e2f0f3e7bffd90541252782e4d2ca20",
      position:
        "0x1b3e0c4b02fc0102fae1d710b24b7e5d9a7219d3f3c393e4e7a11fc05d727923",
      tick_lower: {
        bits: 2,
      },
      tick_upper: {
        bits: 10,
      },
    },
    timestampMs: "1709796895373",
    checkpoint: "28116044",
    dateKey: "",
    gasUsed: {},
  },
  {
    id: {
      txDigest: "5yY69PPqjKw9NXBFsxPKmdVA3CHNokp76ow5BDRiSRHd",
      eventSeq: "1",
    },
    packageId:
      "0x996c4d9480708fb8b92aa7acf819fb0497b5ec8e65ba06601cae2fb6db3312c3",
    transactionModule: "pool_script_v2",
    sender:
      "0x692853c81afc8f847147c8a8b4368dc894697fc12b929ef3071482d27339815e",
    type: "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb::pool::AddLiquidityEvent",
    parsedJson: {
      after_liquidity: "3735093977",
      amount_a: "493983",
      amount_b: "1000000",
      liquidity: "0",
      pool: "0xc8d7a1503dc2f9f5b05449a87d8733593e2f0f3e7bffd90541252782e4d2ca20",
      position:
        "0x1b3e0c4b02fc0102fae1d710b24b7e5d9a7219d3f3c393e4e7a11fc05d727923",
      tick_lower: {
        bits: 2,
      },
      tick_upper: {
        bits: 10,
      },
    },
    timestampMs: "1709796895373",
    checkpoint: "28116044",
    dateKey: "",
    gasUsed: {},
  },
];

const txs = ["8AuckC1CXrpCGHLgJBTkuEy2McaKZTu87iZPeD3WvNdA"]; // TODO: This position address is deleted

const test = async () => {
  const txsEvent = await suiClient.multiGetTransactionBlocks({
    digests: txs,
    options: {
      showEvents: true,
    },
  });

  console.log(txsEvent);

  const events = txsEvent.map((item) => {
    return (item?.events || []).map((event) => {
      return {
        ...event,
        timestampMs: event.timestampMs || "1709796895373",
        checkpoint: item.checkpoint,
        dateKey: "",
        gasUsed: {},
      };
    });
  });

  console.log(events);

  processingConfig.handler(events.flat());
};

test();
