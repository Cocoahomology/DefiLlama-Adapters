const sdk = require("@defillama/sdk");

import { sumSingleBalance } from "../helper/generalUtil";
import {
  ChainBlocks,
  PeggedIssuanceAdapter,
  Balances,
} from "../peggedAsset.type";
import { getTokenSupply as solanaGetTokenSupply } from "../helper/solana";
const axios = require("axios");

type ChainContracts = {
  [chain: string]: {
    [contract: string]: string[];
  };
};

const chainContracts: ChainContracts = {
  ethereum: {
    native: ["0xa47c8bf37f92abed4a126bda807a7b7498661acd"],
  },
  bsc: {
    native: ["0x23396cF899Ca06c4472205fC903bDB4de249D6fC"],
  },
  harmony: {
    native: ["0x224e64ec1bdce3870a6a6c777edd450454068fec"],
  },
  polygon: {
    native: ["0x692597b009d13c4049a947cab2239b7d6517875f"],
  },
  solana: {
    native: ["CXLBjMMcwkc17GfJtBos6rQCo1ypeH6eDbB82Kby4MRm"],
  },
  fantom: {
    native: ["0xe2d27f06f63d98b8e11b38b5b08a75d0c8dd62b9"],
  },
  aurora: {
    native: ["0x5ce9f0b6afb36135b5ddbf11705ceb65e634a9dc"],
  },
  avax: {
    native: ["0xb599c3590F42f8F995ECfa0f85D2980B76862fc1"],
  },
  moonbeam: {
    native: ["0x085416975fe14C2A731a97eC38B9bF8135231F62"],
  },
};

// Sora: again, no idea how to get info from explorer

// Oasis: can't find any info on wormhole wUST contract

async function terraMinted() {
  return async function (
    _timestamp: number,
    _ethBlock: number,
    _chainBlocks: ChainBlocks
  ) {
    let balances = {} as Balances;
    const res = await axios.get(
      "https://api.extraterrestrial.money/v1/api/supply?denom=uusd"
    );
    const totalSupply = res.data.uusd[0].total;
    sumSingleBalance(balances, "peggedUSD", totalSupply / 10 ** 6);
    return balances;
  };
}

async function bridgedSupply(chain: string, decimals: number) {
  return async function (
    _timestamp: number,
    _ethBlock: number,
    _chainBlocks: ChainBlocks
  ) {
    let balances = {} as Balances;
    for (let native of chainContracts[chain].native) {
      const totalSupply = (
        await sdk.api.abi.call({
          abi: "erc20:totalSupply",
          target: native,
          block: _chainBlocks[chain],
          chain: chain,
        })
      ).output;
      sumSingleBalance(balances, "peggedUSD", totalSupply / 10 ** decimals);
    }
    return balances;
  };
}

async function solanaBridged() {
  return async function (
    _timestamp: number,
    _ethBlock: number,
    _chainBlocks: ChainBlocks
  ) {
    let balances = {} as Balances;
    const totalSupply = await solanaGetTokenSupply(chainContracts["solana"].native[0]);
    sumSingleBalance(balances, "peggedUSD", totalSupply);
    return balances;
  };
}

async function osmosisBridged() {
  return async function (
    _timestamp: number,
    _ethBlock: number,
    _chainBlocks: ChainBlocks
  ) {
    let balances = {} as Balances;
    const res = await axios.get(
      "https://api-osmosis.imperator.co/tokens/v2/UST"
    );
    const totalSupply = res.data[0].liquidity;
    sumSingleBalance(balances, "peggedUSD", totalSupply);
    return balances;
  };
}

const adapter: PeggedIssuanceAdapter = {
  terra: {
    minted: terraMinted(),
    unreleased: async () => ({}),
  },
  ethereum: {
    minted: async () => ({}),
    terra: bridgedSupply("ethereum", 18),
    unreleased: async () => ({}),
  },
  bsc: {
    minted: async () => ({}),
    terra: bridgedSupply("bsc", 18),
    unreleased: async () => ({}),
  },
  harmony: {
    minted: async () => ({}),
    terra: bridgedSupply("harmony", 18),
    unreleased: async () => ({}),
  },
  polygon: {
    minted: async () => ({}),
    terra: bridgedSupply("polygon", 18),
    unreleased: async () => ({}),
  },
  solana: {
    minted: async () => ({}),
    terra: solanaBridged(),
    unreleased: async () => ({}),
  },
  fantom: {
    minted: async () => ({}),
    terra: bridgedSupply("fantom", 6),
    unreleased: async () => ({}),
  },
  aurora: {
    minted: async () => ({}),
    terra: bridgedSupply("aurora", 18),
    unreleased: async () => ({}),
  },
  avalanche: {
    minted: async () => ({}),
    terra: bridgedSupply("avax", 6),
    unreleased: async () => ({}),
  },
  osmosis: {
    minted: async () => ({}),
    terra: osmosisBridged(),
    unreleased: async () => ({}),
  },
  moonbeam: {
    minted: async () => ({}),
    terra: bridgedSupply("moonbeam", 6),
    unreleased: async () => ({}),
  },
};

export default adapter;
