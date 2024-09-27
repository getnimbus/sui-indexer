import { suiClient } from "./services/client";
import { prisma } from "./services/db";
import { EventIndexerConfig, SuiEvent } from "./type";
import {
  getNativeTokenPrice,
  getTotalGasFee,
  preloadPool,
  preparePrices,
  prepareTokens,
  valueConvert,
} from "./utils";

export const processingConfig: EventIndexerConfig = {
  type: "event",
  eventTypes: ["todo"],
  async handler(events: SuiEvent[]) {
    // Get token metadata

    // Store to db

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
    const earliestLiveSnapshot = await prisma.trade
      .findFirst({
        select: {
          block: true,
        },
        where: {
          chain: "SUI",
        },
        orderBy: {
          block: "asc",
        },
      })
      .then((data) => data?.block || 0); // TODO: Get from backfill range
    return [24964427, earliestLiveSnapshot];
  },
};
