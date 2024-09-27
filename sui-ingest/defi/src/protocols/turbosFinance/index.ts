import handles from "./indexer";
// import { getUserPositions } from "./position";

const PROTOCOL = "TubosFinance";

const getUserPositions = () => Promise.resolve([]);

export default { indexer: handles, getUserPositions, PROTOCOL };
