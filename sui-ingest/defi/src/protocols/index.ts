import aftermathFinance from "./aftermath";
import cetus from "./cetus";
import suiSwap from "./suiSwap";
import flowX from "./flowX";
import kriya from "./kriya";
import turbos from "./turbosFinance";
import blueMove from "./blueMove";
import navi from "./navi";
import scallop from "./scallop";
import stake from "./stake";
import { getUserContext } from "./context";

export const protocols = [
  aftermathFinance,
  blueMove,
  cetus,
  flowX,
  kriya,
  navi,
  scallop,
  stake,
  suiSwap,
  turbos,
];

export const indexers = [
  aftermathFinance.indexer,
  blueMove.indexer,
  cetus.indexer,
  flowX.indexer,
  kriya.indexer,
  navi.indexer,
  scallop.indexer,
  stake.indexer,
  suiSwap.indexer,
  turbos.indexer,
].flat();

export const getIndexersTopics = () => {
  return protocols
    .map((item) => {
      return {
        name: item.PROTOCOL,
        topics: item.indexer.map((item) => item.topics).flat(),
      };
    })
    .flat();
};

export const getUserPositions = async (
  owner: string,
  protocolsFilter?: string
) => {
  const ctx = await getUserContext(owner);
  console.time(`Get all Positions ${owner}`);
  const positions = await Promise.all(
    protocols
      .filter((item) =>
        protocolsFilter ? item.PROTOCOL === protocolsFilter : true
      )
      .map((protocol) => {
        console.log(`Getting position for ${protocol.PROTOCOL}`);
        return protocol.getUserPositions(owner, ctx).catch((error) => {
          console.error(error);

          return {
            protocol: protocol.PROTOCOL,
            error,
          };
        });
      })
  );
  console.timeEnd(`Get all Positions ${owner}`);

  return positions;
};

const test = async () => {
  if (!process.env.TEST) {
    return;
  }

  const address =
    "0x692853c81afc8f847147c8a8b4368dc894697fc12b929ef3071482d27339815e";

  console.time("getUserPositions");
  const result = await getUserPositions(address);
  console.log(JSON.stringify(result));
  console.timeEnd("getUserPositions");
};

test();
