import "dotenv/config";
// import { eventHandler } from "./services/eventProcess";
import { kafkaClient } from "./services/kafka";
import {
  EventHandler,
  EventIndexerConfig,
  IndexerConfig,
  SuiEvent,
  SuiTx,
} from "./type";
import { processingConfig } from "./main";
import * as csv from "fast-csv";
import fs from "node:fs";
import path from "node:path";
import parseStruct from "athena-struct-parser";

const SUI_EVENT_TOPICS = "sui-events";
const SUI_TX_TOPICS = "sui-txs";

const LATEST_BACKFILL = 10000; // TODO: Query from our endpoint

// TODO: Make it run on multiple workers/consumers
// TODO: Make a flow to check latest realtime consumer & backfill point
// If no schema for state, query from outdb to get the point between realtime & backfill
// If state already existed, start 2 processes for realtime & backfill
// Dev can config to run backfill or realtime only by settings the from
async function liveIndexer(config: IndexerConfig) {
  const consumer = kafkaClient.consumer({
    groupId: process.env.GROUP_ID || "default-group",
  });

  const startSnapshot = (await config.getLatestIndexed()) || LATEST_BACKFILL;

  if (config.type === "event") {
    await consumer.subscribe({
      topic: SUI_EVENT_TOPICS,
      fromBeginning: true,
    });

    await consumer.run({
      autoCommit: true,
      autoCommitInterval: 1000,
      eachBatchAutoResolve: true,
      eachBatch: async ({ batch }) => {
        let latestOffset = "";
        const events: SuiEvent[] = [];
        for (let message of batch.messages) {
          const payload = JSON.parse(
            message.value?.toString() as any
          ) as SuiEvent;
          if (Number(payload.checkpoint) > startSnapshot) {
            if (
              config.eventTypes.length &&
              config.eventTypes.some((type) => !!payload.type.startsWith(type)) // Start with compare
            ) {
              events.push(payload);
            } else {
              // Consume all
              events.push(payload);
            }
          }
          latestOffset = message.offset;
        }

        return await config.handler(events);
      },
    });

    return;
  }

  if (config.type === "tx") {
    await consumer.subscribe({
      topic: SUI_TX_TOPICS,
      fromBeginning: true,
    });

    await consumer.run({
      autoCommit: true,
      autoCommitInterval: 1000,
      eachBatchAutoResolve: true,
      eachBatch: async ({ batch }) => {
        let latestOffset = "";
        const txs: SuiTx[] = [];
        for (let message of batch.messages) {
          const payload = JSON.parse(message.value?.toString() as any) as SuiTx;
          if (Number(payload.checkpoint) > startSnapshot) {
            if (
              config.objectTypes.length &&
              config.objectTypes.some(
                (type) =>
                  !!payload.objectChanges?.find((obj) => obj.type === type)
              )
            ) {
              txs.push(payload);
            } else {
              // Consume all txs
              txs.push(payload);
            }
          }
          latestOffset = message.offset;
        }

        return await config.handler(txs);
      },
    });

    return;
  }

  return;
}

const backfillData = async (config: IndexerConfig) => {
  let rows: any[] = [];

  const processData = async (rows: any[]) => {
    if (config.type === "event") {
      const parseData: SuiEvent[] = rows.map((item) => {
        const idParsed = parseStruct(item.id);
        return {
          id: {
            txDigest: idParsed.txdigest,
            eventSeq: idParsed.eventseq,
          },
          packageId: item.packageId,
          transactionModule: item.transactionModule,
          sender: item.sender,
          type: item.type,
          parsedJson: item.parsedJson,
          timestampMs: item.timestampMs,
          dateKey: item.dateKey,
          checkpoint: item.checkpoint,
          gasUsed: parseStruct(item.gasUsed),
        };
      });
      await config.handler(parseData);
    }

    if (config.type === "tx") {
      const parseData: SuiTx[] = rows.map((item) => {
        // TODO: Convert to right format

        return {
          digest: item.digest,
          checkpoint: item.checkpoint,
          timestampMs: item.timestampMs,
          effects: parseStruct(item.effects),
          objectChanges: parseStruct(item.objectchanges),
          events: parseStruct(item.events),
          balanceChanges: parseStruct(item.balancechanges),
        };
      });
      await config.handler(parseData);
    }
  };

  const [from, to] = await config.getBackfillRange();

  const readStream = fs.createReadStream(
    process.env.BACKFILL_FILE as string
    // path.resolve(__dirname, "../backfill_data", "example.csv")
  );

  readStream
    .pipe(csv.parse({ headers: true }))
    .on("error", (error) => console.error(error))
    .on("data", async (row) => {
      if (Number(row.checkpoint) > from && Number(row.checkpoint) < to) {
        // In-range check
        rows.push(row);
      }
      if (rows.length >= config.backfillBatch) {
        readStream.pause();
        await processData(rows);
        readStream.resume();
        await processData(rows);
        rows = [];
      }
    })
    .on("end", async (rowCount: number) => {
      if (rows.length) {
        await processData(rows);
      }
      console.log(`Done backfill ${rowCount} rows`);
    });
};

function start() {
  // TODO: Run in 2 process
  if (process.env.REALTIME_ONLY) {
    liveIndexer(processingConfig);
  }

  if (process.env.BACKFILL_ONLY) {
    backfillData(processingConfig);
  }
}

start();
