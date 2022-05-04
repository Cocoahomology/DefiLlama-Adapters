const sdk = require("@defillama/sdk");
import abi from "./abi.json";
import { ChainBlocks } from "../peggedAsset.type";

const TWAPIntervalInSeconds: number = 10;

type Pools = {
  [coinGeckoID: string]: {
    address: string;
    token: 0 | 1;
    chain: string;
    decimalsDifference: number; // difference between number of decimals for token1 and number for token0
  };
};

const pools: Pools = {
  tether: {
    address: "0x3416cF6C708Da44DB2624D63ea0AAef7113527C6",
    token: 1,
    chain: "ethereum",
    decimalsDifference: 0,
  }, // USDC-USDT
  terrausd: {
    address: "0x18D96B617a3e5C42a2Ada4bC5d1B48e223f17D0D",
    token: 1,
    chain: "ethereum",
    decimalsDifference: 12,
  }, // USDC-UST
};

export default async function getCurrentPeggedPrice(
  token: string,
  chainBlocks: ChainBlocks
): Promise<Number> {
  if (token === "usd-coin") {
    // I think this is all uniswap.info does, maybe should get a price from Curve instead?
    return 1.0;
  }
  const pool = pools[token];
  const observe = await sdk.api.abi.call({
    abi: abi.observe,
    params: [[0, TWAPIntervalInSeconds]],
    target: pool.address,
    block: chainBlocks[pool.chain],
    chain: pool.chain,
  });
  // following follows method given in https://docs.uniswap.org/protocol/concepts/V3-overview/oracle
  const token0TickCumulative = observe.output.tickCumulatives[0];
  const token1TickCumulative = observe.output.tickCumulatives[1];
  const weightedAverage =
    (token1TickCumulative - token0TickCumulative) / TWAPIntervalInSeconds;
  const token0token1PriceRatio =
    1.0001 ** weightedAverage * 10 ** pool.decimalsDifference;
  if (pool.token === 0) {
    return token0token1PriceRatio;
  } else return 1 / token0token1PriceRatio;
}
