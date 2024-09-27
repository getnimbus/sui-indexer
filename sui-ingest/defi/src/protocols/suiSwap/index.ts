import handles from "./indexer";
// import { getUserPositions } from "./position";

const PROTOCOL = "SuiSwap";

const getUserPositions = () => Promise.resolve([]);

export default { indexer: handles, getUserPositions, PROTOCOL };
