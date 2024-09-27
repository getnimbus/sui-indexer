import { SuiContext } from "../interface";
import { getOrSet } from "../services/cache";
import { suiClient } from "../services/client";
import { getAllOwnedObjects } from "../utils";

export const getUserContext = async (owner: string): Promise<SuiContext> => {
  // TODO: Bounce this function to only return 1 time in short amt of time
  const [ownedObj, balances] = await Promise.all([
    getOrSet(
      {
        protocol: "SUI",
        key: `obj_${owner}`,
        ttl: 2 * 60, // 2 mins
      },
      () =>
        getAllOwnedObjects({
          owner,
          options: {
            showContent: true,
            showType: true,
          },
        })
    ),
    getOrSet(
      {
        protocol: "SUI",
        key: `holding_${owner}`,
        ttl: 2 * 60, // 2 mins
      },
      () =>
        suiClient.getAllBalances({
          owner,
        })
    ),
  ]);

  return {
    ownedObj,
    balances,
  };
};
