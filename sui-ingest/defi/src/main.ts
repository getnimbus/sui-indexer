import { indexers } from "./protocols";
import { suiClient } from "./services/client";
import { prisma } from "./services/db";
import {
  EventIndexerConfig,
  TxIndexerConfig,
  SuiEvent,
  SuiTx,
  GasObj,
} from "./type";
import {
  getNativeTokenPrice,
  getTotalGasFee,
  preloadPool,
  preparePrices,
  prepareTokens,
  getTokenMetadata,
  valueConvert,
  normalizedTokenAddress,
} from "./utils";
import { v4 as uuidv4 } from "uuid";

export const processingConfig: EventIndexerConfig = {
  type: "event",
  eventTypes: indexers.map((item) => item.topics).flat(),
  async handler(events: SuiEvent[]) {
    console.log(`Start process ${events.length} events`);
    if (!events.length) {
      return true;
    }

    await Promise.all([prepareTokens(), preloadPool()]);
    console.log(`Done prepare`);

    const timerange = events.map((item) => Number(item.timestampMs));
    const [fromTime, toTime] = [Math.min(...timerange), Math.max(...timerange)];
    await preparePrices(fromTime, toTime);
    // const processData = [];
    const parallelProcess: Promise<any>[] = [];
    const gasPrice: Map<string, { gasFee: number; nativePrice: number }> =
      new Map();

    for (let event of events) {
      const nativePrice = await getNativeTokenPrice({
        timestamp: Number(event.timestampMs),
      });

      const gasObj: GasObj = {
        gasFee:
          Number(
            valueConvert(getTotalGasFee(event.gasUsed), 9) // SUI decimals
          ) * nativePrice,
        nativePrice,
      };
      gasPrice.set(event.id.txDigest, gasObj);

      for (const protocol of indexers) {
        if (protocol.topics.some((topic) => event.type.startsWith(topic))) {
          parallelProcess.push(protocol.process(event, gasObj));
          // console.log(event.id);
          // await protocol.process(event);
          // console.log(await protocol.process(event));
        }
      }
    }

    await Promise.all(parallelProcess);

    console.log(
      `Done save ${parallelProcess.length} row. Total ${events.length} events`
    );
    const lastEvent = events.pop();
    console.log(
      `Lastest Tx ${lastEvent?.id?.txDigest}, event type ${lastEvent?.type}. Snapshot ${lastEvent?.checkpoint}`
    );

    return;
  },
  fromSnapshot: 0,
  async getLatestIndexed() {
    return 0;
  },
  async getBackfillRange() {
    return [24964427, 0];
  },
  backfillBatch: 1000,
};
