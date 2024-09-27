import { pool, tokens } from "@prisma/client";
import { prisma } from "./services/db";
import axios from "axios";
import { SocksProxyAgent } from "socks-proxy-agent";
import { baseTokenMappingCMC } from "./const";
import { formatUnits } from "viem";

const cmcAPI = axios.create({
  baseURL: "https://api.coinmarketcap.com",
  timeout: 30_000,
});

if (process.env.USE_PROXY) {
  cmcAPI.interceptors.request.use(function (config) {
    // https://www.webshare.io/
    let httpsAgent = new SocksProxyAgent(process.env.USE_PROXY || "");
    let httpAgent = httpsAgent;
    config.httpAgent = httpAgent;
    config.httpsAgent = httpsAgent;
    return config;
  });
}

export const valueConvert = (
  input: string | undefined | bigint | number,
  decimal: number | bigint = 9
): string => {
  if (input === undefined) {
    return "0";
  }
  if (decimal === 0) {
    return input.toString();
  }

  return formatUnits(BigInt(input), Number(decimal));
};

const poolCache: Map<string, pool> = new Map();
export const preloadPool = async () => {
  if (poolCache.size) return;

  const pools = await prisma.pool.findMany({
    where: {
      chain: "SUI",
    },
  });

  pools.forEach((pool) => {
    poolCache.set(pool.pool, pool);
  });
  console.log(`Done load ${pools.length} pools`);
};

export const getPoolInfo = async (
  poolAddress: string,
  defaultFn: () => pool | Promise<pool>,
  save = true
): Promise<pool> => {
  const cached = poolCache.get(poolAddress);
  if (cached) {
    return cached;
  }

  const poolData = await prisma.pool.findFirst({
    where: {
      pool: poolAddress,
      chain: "SUI",
    },
  });

  // console.timeEnd(`Query pool ${poolAddress}`);
  if (poolData) {
    poolCache.set(poolAddress, poolData);
    return poolData;
  }

  console.time(`Get pool ${poolAddress}`);
  const defaultPool = await defaultFn();
  console.timeEnd(`Get pool ${poolAddress}`);
  if (save) {
    poolCache.set(poolAddress, defaultPool);
    prisma.pool
      .create({
        data: defaultPool,
      })
      .then(() => {
        console.log("Stored pool ", defaultPool.pool);
      })
      .catch((error) => {
        console.log(error);
        console.log("Error insert");
      });
  }

  return defaultPool;
};

export let tokenDecimals: Map<string, number> = new Map();

export const prepareTokens = async () => {
  if (tokenDecimals.size) {
    // Ignore if already cached
    return;
  }
  console.time(`Prepare tokens`);
  const tokenData = await prisma.tokens.findMany({
    where: {
      chain: "SUI",
    },
    // take: 1000000000,
  });
  console.timeEnd(`Prepare tokens`);

  console.time(`Cooking tokens`);
  tokenData.forEach((item) => {
    tokenDecimals.set(item.token_address, item.token_decimals);
  });
  console.timeEnd(`Cooking tokens`);
  console.log(`Done load ${tokenData.length} tokens decimals`);
};

export const getTokenDecimals = async (
  token: string,
  defaultFn: () => tokens | Promise<tokens>
) => {
  const cachedData = tokenDecimals.get(token);
  if (cachedData) {
    // console.log("HIT token decimal", token, cachedData);
    return cachedData || 9;
  }

  const newData = await defaultFn();
  tokenDecimals.set(newData.token_address, newData.token_decimals); // Add to cache
  prisma.tokens
    .upsert({
      update: {},
      create: newData,
      where: {
        chain_token_address: {
          chain: "SUI",
          token_address: token,
        },
      },
    })
    .then(() => {
      console.log(`Done save token ${token}`);
    })
    .catch((error) => {
      console.log(error);
    });
  return newData.token_decimals;
};

interface PriceData {
  timestamp: number;
  price: number;
}
let lastestPrice = 0;
let tokenPriceCache: Record<string, PriceData[]> = {};

export const preparePrices = async (begin: number, end: number) => {
  // Cache the price for 2 mins
  if (end - lastestPrice < 2 * 60 * 1000) {
    return;
  }
  const tokensCMC = Object.values(baseTokenMappingCMC);
  const tokenPrices = await Promise.all(
    tokensCMC.map((token) => getCMCPricing(token, begin, end))
  );
  tokenPriceCache = tokenPrices.reduce((prev, cur) => {
    return {
      ...prev,
      ...cur,
    };
  }, {});

  // console.log(`Done prepare token price`);
  lastestPrice = end;
  return;
};

const wait = (time: number) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, time);
  });
};

async function getCMCPricing(id: number, startDate: number, endDate: number) {
  // console.log("Start ", id, startDate, endDate);
  const oneDayInSeconds = 24 * 60 * 60;
  const startTime = Math.round(startDate / 1000);
  const endTime = Math.round(endDate / 1000);
  let currentTime = endTime;

  const dataToWrite: PriceData[] = [];

  let count = 1;
  while (true) {
    const data = await Promise.all(
      (process.env.STATE === "backfill"
        ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        : [1]
      ).map((step) => {
        const startTimeData = currentTime - oneDayInSeconds * step - 1;
        const endTimeData = currentTime - oneDayInSeconds * (step - 1);
        return cmcAPI
          .get(
            `/data-api/v3/cryptocurrency/detail/chart?id=${id}&range=${startTimeData}~${endTimeData}`
          )
          .then((res) => res.data)
          .catch((error) => {
            console.log(error);
            return {};
          });
      })
    );

    const results =
      process.env.STATE === "backfill"
        ? {
            ...(data[0]?.data?.points || {}),
            ...(data[1]?.data?.points || {}),
            ...(data[2]?.data?.points || {}),
            ...(data[3]?.data?.points || {}),
            ...(data[4]?.data?.points || {}),
            ...(data[5]?.data?.points || {}),
            ...(data[6]?.data?.points || {}),
            ...(data[7]?.data?.points || {}),
            ...(data[8]?.data?.points || {}),
            ...(data[9]?.data?.points || {}),
          }
        : {
            ...(data[0]?.data?.points || {}),
          };

    // console.log(results);

    // console.log(`Done ${count}`);
    count++;
    // await wait(100);

    // if (Object.keys(results).length === 0) {
    //   break;
    // }

    if (Object.keys(results).length) {
      // Extract relevant data from the API response and push it to the dataToWrite array
      // Modify this part based on the actual structure of the API response
      Object.keys(results).map((timestamp) => {
        const dataPoint = results[timestamp];
        // console.log(timestamp, dataPoint?.v?.[0]);
        dataToWrite.push({
          timestamp: Number(timestamp) * 1000,
          price: dataPoint?.v?.[0] || 0,
        });
      });
    }

    // Move to the next day
    currentTime = currentTime - oneDayInSeconds * 10;

    if (currentTime < startTime) {
      break;
    }

    await wait(100);
  }

  return { [id]: dataToWrite };
}

function findNearestPoint(
  timestamp: number,
  data: PriceData[]
): PriceData | null {
  let left: number = 0;
  let right: number = data.length - 1;
  let nearestPoint: PriceData | null = null;

  while (left <= right) {
    const mid: number = Math.floor((left + right) / 2);
    const midTimestamp: number = data[mid].timestamp;

    if (midTimestamp === timestamp) {
      return data[mid];
    }

    const diff: number = Math.abs(midTimestamp - timestamp);

    if (
      nearestPoint === null ||
      diff < Math.abs(nearestPoint.timestamp - timestamp)
    ) {
      nearestPoint = data[mid];
    }

    if (midTimestamp < timestamp) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return nearestPoint;
}

export const getTradeValue = async ({
  fromAddress,
  fromAmount,
  toAddress,
  toAmount,
  header: { height, timestamp },
}: {
  fromAddress: string;
  fromAmount: number;
  toAddress: string;
  toAmount: number;
  header: {
    height: number;
    timestamp: number;
  };
}) => {
  const priceCtx = tokenPriceCache;
  const contractAdressCMCMapping = baseTokenMappingCMC;

  if (contractAdressCMCMapping[fromAddress]) {
    const historicalPriceCMC =
      priceCtx[contractAdressCMCMapping[fromAddress]] || [];

    return (
      fromAmount * (findNearestPoint(timestamp, historicalPriceCMC)?.price || 0)
    );
  }

  if (contractAdressCMCMapping[toAddress]) {
    const historicalPriceCMC =
      priceCtx[contractAdressCMCMapping[toAddress]] || [];

    return (
      fromAmount * (findNearestPoint(timestamp, historicalPriceCMC)?.price || 0)
    );
  }

  // Try to agg data
  console.time(`Agg price ${toAddress}`);
  const tradeHistoryToToken = await prisma.trade.findMany({
    where: {
      chain: "SUI",
      block: {
        lte: height,
        gt: height - 5,
      },
      to_token_address: toAddress,
      amount_usd: {
        gt: 0,
      },
    },
    orderBy: {
      block: "desc",
    },
    take: 10,
  });
  const costTo = tradeHistoryToToken.reduce(
    (prev, cur) => prev + cur.amount_usd,
    0
  );
  const amountToData = tradeHistoryToToken.reduce(
    (prev, cur) => prev + cur.quanlity_out,
    0
  );
  console.timeEnd(`Agg price ${toAddress}`);

  if (costTo > 0) {
    return toAmount * (costTo / amountToData || 0);
  }

  console.time(`Agg price ${fromAddress}`);
  const tradeHistoryFromToken = await prisma.trade.findMany({
    where: {
      chain: "SUI",
      block: {
        lte: height,
        gt: height - 5,
      },
      from_token_address: fromAddress,
      amount_usd: {
        gt: 0,
      },
    },
    orderBy: {
      block: "desc",
    },
    take: 10,
  });
  const costFrom = tradeHistoryFromToken.reduce(
    (prev, cur) => prev + cur.amount_usd,
    0
  );
  const amountFromData = tradeHistoryFromToken.reduce(
    (prev, cur) => prev + cur.quanlity_out,
    0
  );
  console.timeEnd(`Agg price ${fromAddress}`);

  return fromAmount * (costFrom / amountFromData || 0);
};

export const getNativeTokenPrice = async ({
  timestamp,
}: {
  timestamp: number;
}) => {
  const priceCtx = tokenPriceCache;
  const native = "0x2::sui::SUI";

  const contractAdressCMCMapping = baseTokenMappingCMC;
  const historicalPriceCMC = priceCtx[contractAdressCMCMapping[native]] || [];

  return findNearestPoint(timestamp, historicalPriceCMC)?.price || 0;
};

export const tryCatchFn =
  (fn: Function, defaultValue: any) =>
  async (...input: any) => {
    try {
      return await fn(...input);
    } catch (error) {
      console.error(error);
      return defaultValue;
    }
  };

export const parsePoolToken = (poolType: string) => {
  //0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb::pool::Pool<0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN, 0x2::sui::SUI>
  const data = poolType?.match(/<(.*), (.*)>/);
  return [data?.[1] || "", data?.[2] || ""];
};

export const parseWrapperObj = (type: string) => {
  const data = type?.match(/<(.*)>/);
  return data?.[1] || "";
};

export const tryCatch = async (fn: Function, defaultValue: any) => {
  try {
    return await fn();
  } catch (error) {
    console.error(error);
    return defaultValue;
  }
};

const cacheData: Record<string, any> = {};
export const cacheFn = async <T>(
  key: string,
  fn: Function,
  defaultValue: T
): Promise<T> => {
  if (cacheData[key]) {
    // console.log("HIT ", key);
    return cacheData[key];
  }

  const value = await tryCatch(fn, defaultValue);
  cacheData[key] = value;
  return value;
};

export const getTotalGasFee = (gasInput: Record<string, string>) => {
  return Object.values(gasInput).reduce((prev, cur) => prev + Number(cur), 0);
};
