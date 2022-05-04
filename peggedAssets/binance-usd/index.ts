const sdk = require("@defillama/sdk");
import { sumSingleBalance } from "../helper/generalUtil";
import { getTokenSupply as solanaGetTokenSupply } from "../helper/solana";
import {
  ChainBlocks,
  PeggedIssuanceAdapter,
  Balances,
} from "../peggedAsset.type";
const axios = require("axios"); // ADD RETRY EVERYWHERE

type ChainContracts = {
  [chain: string]: {
    [contract: string]: string[];
  };
};

const chainContracts: ChainContracts = {
  ethereum: {
    issued: ["0x4fabb145d64652a948d72533023f6e7a623c7c53"],
  },
  bsc: {
    // there is 8M on bsc that came from ETH then is bridged away again in wormhole
    bridgeFromETH: ["0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503"],
    native: ["0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"],
  },
  avax: {
    bridgeFromETH: ["0xe78388b4ce79068e89bf8aa7f218ef6b9ab0e9d0"],
    native: [
      "0x19860ccb0a68fd4213ab9d8266f7bbf05a8dde98",
      "0xA41a6c7E25DdD361343e8Cb8cFa579bbE5eEdb7a", // wormhole
    ],
  },
  solana: {
    bridgeFromETH: ["0xf92cd566ea4864356c5491c177a430c222d7e678"],
    issued: [
      "33fsBLA8djQm82RpHmE3SuVrPGtZBWNYExsEUeKX1HXX",
      "AJ1W9A9N9dEMdVyoDiam2rV44gnBm2csrPDP7xqcapgX", // wormhole
      "6nuaX3ogrr2CaoAPjtaKHAoBNWok32BMcRozuf32s2QF", // allbridge
    ],
  },
  harmony: {
    bridgeFromETH: ["0xfd53b1b4af84d59b20bf2c20ca89a6beeaa2c628"],
    native: ["0xe176ebe47d621b984a73036b9da5d834411ef734"],
  },
  iotex: {
    native: ["0x84abcb2832be606341a50128aeb1db43aa017449"],
  },
  okexchain: {
    native: ["0x332730a4f6e03d9c55829435f10360e13cfa41ff"],
  },
  moonriver: {
    native: ["0x5d9ab5522c64e1f6ef5e3627eccc093f56167818"],
  },
  polygon: {
    native: [
      "0x9fb83c0635de2e815fd1c21b3a292277540c2e8d",
      "0xA8D394fE7380b8cE6145d5f85E6aC22d4E91ACDe", // wormhole
    ],
  },
  fuse: {
    native: ["0x6a5f6a8121592becd6747a38d67451b310f7f156"],
  },
  meter: {
    native: ["0x24aa189dfaa76c671c279262f94434770f557c35"],
  },
  moonbeam: {
    native: ["0xa649325aa7c5093d12d6f98eb4378deae68ce23f"],
  },
  milkomeda: {
    native: ["0x218c3c3d49d0e7b37aff0d8bb079de36ae61a4c0"],
  },
  elastos: {
    native: ["0x9f1d0ed4e041c503bd487e5dc9fc935ab57f9a57"],
  },
  aurora: {
    native: [
      "0x3b40D173b5802733108E047CF538Be178646b2e4", // might be allbridge or wormhole, not sure...all 3 are on it???
      "0x5D9ab5522c64E1F6ef5e3627ECCc093f56167818", // multichain
    ], 
  },
};

// Sora: missing

// Cronos: I'm more and more sure they just mint stuff and call it whatever they want

// Theta: address on coingecko seems wrong

// find all the wormhole ones: checked, most chains you can bridge to don't have it

// allbridge/multichain

async function chainMinted(chain: string, decimals: number) {
  return async function (
    _timestamp: number,
    _ethBlock: number,
    _chainBlocks: ChainBlocks
  ) {
    let balances = {} as Balances;
    for (let issued of chainContracts[chain].issued) {
      const totalSupply = (
        await sdk.api.abi.call({
          abi: "erc20:totalSupply",
          target: issued,
          block: _chainBlocks[chain],
          chain: chain,
        })
      ).output;
      sumSingleBalance(balances, "peggedUSD", totalSupply / 10 ** decimals);
    }
    return balances;
  };
}

async function chainUnreleased(chain: string, decimals: number, owner: string) {
  return async function (
    _timestamp: number,
    _ethBlock: number,
    _chainBlocks: ChainBlocks
  ) {
    let balances = {} as Balances;
    for (let issued of chainContracts[chain].issued) {
      const reserve = (
        await sdk.api.erc20.balanceOf({
          target: issued,
          owner: owner,
          block: _chainBlocks[chain],
          chain: chain,
        })
      ).output;
      sumSingleBalance(balances, "peggedUSD", reserve / 10 ** decimals);
    }
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

async function solanaMinted() {
  return async function (
    _timestamp: number,
    _ethBlock: number,
    _chainBlocks: ChainBlocks
  ) {
    let balances = {} as Balances;
    for (let issued of chainContracts["solana"].issued) {
      const totalSupply = await solanaGetTokenSupply(issued);
      sumSingleBalance(balances, "peggedUSD", totalSupply);
    }
    return balances;
  };
}

const adapter: PeggedIssuanceAdapter = {
  ethereum: {
    minted: chainMinted("ethereum", 18),
    unreleased: async () => ({}),
  },
  bsc: {
    minted: async () => ({}),
    ethereum: bridgedSupply("bsc", 18),
    unreleased: async () => ({}),
  },
  avalanche: {
    minted: async () => ({}),
    ethereum: bridgedSupply("avax", 18),
    unreleased: async () => ({}),
  },
  harmony: {
    minted: async () => ({}),
    ethereum: bridgedSupply("harmony", 18),
    unreleased: async () => ({}),
  },
  iotex: {
    minted: async () => ({}),
    ethereum: bridgedSupply("iotex", 18),
    unreleased: async () => ({}),
  },
  okexchain: {
    minted: async () => ({}),
    ethereum: bridgedSupply("okexchain", 18),
    unreleased: async () => ({}),
  },
  moonriver: {
    minted: async () => ({}),
    ethereum: bridgedSupply("moonriver", 18),
    unreleased: async () => ({}),
  },
  solana: {
    minted: async () => ({}),
    ethereum: solanaMinted(),
    unreleased: async () => ({}),
  },
  polygon: {
    minted: async () => ({}),
    ethereum: bridgedSupply("polygon", 18),
    unreleased: async () => ({}),
  },
  fuse: {
    minted: async () => ({}),
    ethereum: bridgedSupply("fuse", 18),
    unreleased: async () => ({}),
  },
  meter: {
    minted: async () => ({}),
    ethereum: bridgedSupply("meter", 18),
    unreleased: async () => ({}),
  },
  moonbeam: {
    minted: async () => ({}),
    ethereum: bridgedSupply("moonbeam", 18),
    unreleased: async () => ({}),
  },
  milkomeda: {
    minted: async () => ({}),
    ethereum: bridgedSupply("milkomeda", 18),
    unreleased: async () => ({}),
  },
  elastos: {
    minted: async () => ({}),
    ethereum: bridgedSupply("elastos", 18),
    unreleased: async () => ({}),
  },
  aurora: {
    minted: async () => ({}),
    ethereum: bridgedSupply("aurora", 18),
    unreleased: async () => ({}),
  },
};

export default adapter;
