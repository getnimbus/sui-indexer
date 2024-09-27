import Redis from "ioredis";

const client = new Redis(process.env?.UPSTASH, {
  enableAutoPipelining: true,
  db: 11,
});

interface ICacheOptions {
  protocol: string;
  key: string;
  ttl?: number;
}

const getKey = (options: ICacheOptions) => `${options.protocol}_${options.key}`;

export const setCache = (value: any, options: ICacheOptions) => {
  const key = getKey(options);
  client.set(key, JSON.stringify({ value })).then(() => {
    if (options.ttl) {
      return client.expire(key, options.ttl);
    }

    return true;
  });

  return true;
};

export const getCache = async (options: ICacheOptions) => {
  const key = getKey(options);
  const cachedValue = await client.get(key);
  if (cachedValue) {
    return JSON.parse(cachedValue).value;
  }

  return undefined;
};

export const getOrSet = async <T extends Function>(
  options: ICacheOptions,
  fn: T
) => {
  // return await fn(); // TODO: Remove me
  const cacheValue = await getCache(options);

  // HIT
  if (typeof cacheValue !== "undefined") {
    return cacheValue;
  }

  // MISS
  const value = await fn();
  setCache(value, options);

  return value;
};
