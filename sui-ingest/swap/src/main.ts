import "dotenv/config";
import { protocols } from "./protocols";
import { suiClient } from "./services/client";
import { prisma } from "./services/db";
import { EventIndexerConfig, TxIndexerConfig, SuiEvent, SuiTx } from "./type";
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
  eventTypes: protocols.map((item) => item.topic),
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
      gasPrice.set(event.id.txDigest, {
        gasFee:
          Number(
            valueConvert(getTotalGasFee(event.gasUsed), 9) // SUI decimals
          ) * nativePrice,
        nativePrice,
      });

      for (const protocol of protocols) {
        if (event.type.startsWith(protocol.topic)) {
          parallelProcess.push(protocol.process(event));
          // console.log(event.id);
          // await protocol.process(event);
          // console.log(await protocol.process(event));
        }
      }
    }

    const processData = (await Promise.all(parallelProcess)).filter(
      (item) => item
    );

    // processData.push(...result);
    // console.log(processData);

    processData.forEach((item) => {
      const gasData = gasPrice.get(item.tx_hash);
      (item.fee = gasData?.gasFee || 0),
        (item.native_price = gasData?.nativePrice || 0);
      item.from_token_address = normalizedTokenAddress(item.from_token_address);
      item.to_token_address = normalizedTokenAddress(item.to_token_address);
    });

    if (process.env.TEST) {
      console.log(processData);
    } else {
      await prisma.trade.createMany({
        data: processData,
        skipDuplicates: true,
      });
      // TODO: remove catch if failed then consumer not commit offset and must restart to consume
      // .catch((error) => {
      //   console.log(error);
      //   throw error;
      // });
    }

    console.log(
      `Done save ${processData.length} trades. Total ${events.length} events`
    );
    const lastEvent = events.pop();
    console.log(
      `Lastest Tx ${lastEvent?.id?.txDigest}, event type ${lastEvent?.type}. Snapshot ${lastEvent?.checkpoint}`
    );

    return;
  },
  fromSnapshot: 0,
  async getLatestIndexed() {
    return await prisma.trade
      .findFirst({
        select: {
          block: true,
        },
        where: {
          chain: "SUI",
        },
        orderBy: {
          block: "desc",
        },
      })
      .then((data) => data?.block || null);
  },
  async getBackfillRange() {
    const CHECKPOINT = 27950539;
    const earliestLiveSnapshot = await prisma.trade
      .findFirst({
        select: {
          block: true,
        },
        where: {
          block: {
            lt: CHECKPOINT,
          },
          chain: "SUI",
        },
        orderBy: {
          block: "desc",
        },
      })
      .then((data) => data?.block || 0); // TODO: Get from backfill range
    return [earliestLiveSnapshot, CHECKPOINT];
  },
  backfillBatch: 1000,
};
