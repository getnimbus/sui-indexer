import "dotenv/config";
import { kafkaClient } from "./services/kafka";
import {
  EventHandler,
  EventIndexerConfig,
  IndexerConfig,
  SuiEvent,
  SuiTx,
} from "./type";
import { processingConfig } from "./main";

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

const backfillData = async () => {};

function start() {
  // TODO: Run in 2 process
  if (!process.env.BACKFILL_ONLY) {
    liveIndexer(processingConfig);
  }

  if (!process.env.REALTIME_ONLY) {
    backfillData();
  }
}

start();
