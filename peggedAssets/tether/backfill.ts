const sdk = require("@defillama/sdk");
import { sumSingleBalance } from "../helper/generalUtil";
import {
  getTokenSupply as solanaGetTokenSupply,
  getTokenBalance as solanaGetTokenBalance,
} from "../helper/solana";
import {
  ChainBlocks,
  PeggedIssuanceAdapter,
  Balances,
} from "../peggedAsset.type";
import {
  getTokenBalance as tronGetTokenBalance,
  getTotalSupply as tronGetTotalSupply, // NOTE THIS DEPENDENCY
} from "../helper/tron";
const axios = require("axios"); // ADD RETRY EVERYWHERE

type ChainContracts = {
  [chain: string]: {
    [contract: string]: string;
  };
};

const chainContracts: ChainContracts = {
  ethereum: {
    issued: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    unreleased: "0x5754284f345afc66a98fbb0a0afe71e0f007b949", // api claims slightly less than this
  },
  polygon: {
    bridgeFromETH: "0x40ec5B33f54e0E8A33A975908C5BA1c14e5BbbDf",
    native: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
  },
  bsc: {
    bridgeFromETH: "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503", // native one can't get balance
  },
  avax: {
    bridgeFromETH: "0xE78388b4CE79068e89Bf8aA7f218eF6b9AB0e9d0",
    native: "0xc7198437980c041c805a1edcba50c1ce5db95118",
    issued: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
    unreleased: "0x5754284f345afc66a98fbb0a0afe71e0f007b949",
  },
  solana: {
    issued: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    unreleased: "Q6XprfkF8RQQKoQVG33xT88H7wi8Uk1B1CC7YAs69Gi",
  },
  tron: {
    issued: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    unreleased: "TKHuVq1oKVruCGLvqVexFs6dawKv6fQgFs",
  },
  arbitrum: {
    bridgeFromETH: "0xcee284f754e854890e311e3280b767f80797180d", // coins in arbi contract count as circulating on ETH
    native: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
  },
  optimism: {
    bridgeFromETH: "0x99c9fc46f92e8a1c0dec1b1747d010903e884be1",
    native: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
  },
  boba: {
    bridgeFromETH: "0xdc1664458d2f0b6090bea60a8793a4e66c2f1c00",
    native: "0x5DE1677344D3Cb0D7D465c10b72A8f60699C062d",
  },
  metis: {
    bridgeFromETH: "0x3980c9ed79d2c191A89E02Fa3529C60eD6e9c04b",
    native: "0xbB06DCA3AE6887fAbF931640f67cab3e3a16F4dC",
  },
  moonbeam: {
    bridgeFromETH: "0xEC4486a90371c9b66f499Ff3936F29f0D5AF8b7E",
    native: "0xeFAeeE334F0Fd1712f9a8cc375f427D9Cdd40d73",
  },
  kcc: {
    bridgeFromETH: "0xD6216fC19DB775Df9774a6E33526131dA7D19a2c",
    native: "0x0039f574ee5cc39bdd162e9a88e3eb1f111baf48", //is this correct? huge disparity
  },
  moonriver: {
    bridgeFromETH: "0x10c6b61dbf44a083aec3780acf769c77be747e23",
    native: "0xB44a9B6905aF7c801311e8F4E76932ee959c663C",
  },
  // any bridgeFromETH contracts are just for info purposes, any missing I couldn't find
  tomochain: {
    native: "0x381b31409e4d220919b2cff012ed94d70135a59e",
  },
  harmony: {
    bridgeFromETH: "0x2dccdb493827e15a5dc8f8b72147e6c4a5620857",
    native: "0x3c2b8be99c50593081eaa2a724f0b8285f5aba8f",
  },
  syscoin: {
    bridgeFromETH: "0x8cC49FE67A4bD7a15674c4ffD4E969D94304BBbf",
    native: "0x922d641a426dcffaef11680e5358f34d97d112e1",
  },
  kardia: {
    native: "0x551a5dcac57c66aa010940c2dcff5da9c53aa53b",
  },
  heco: {
    bridgeFromETH: "0xA929022c9107643515F5c777cE9a910F0D1e490C", //contain slightly less than native
    native: "0xa71EdC38d189767582C38A3145b5873052c3e47a",
  },
  okexchain: {
    bridgeFromETH: "0x5041ed759Dd4aFc3a72b8192C143F72f4724081A",
    native: "0x382bb369d343125bfb2117af9c149795c6c65c50",
  },
  fuse: {
    native: "0xfadbbf8ce7d5b7041be672561bba99f79c532e10",
  },
  meter: {
    native: "0x5fa41671c48e3c951afc30816947126ccc8c162e",
  },
  milkomeda: {
    native: "0x80A16016cC4A2E6a2CACA8a4a498b1699fF0f844",
  },
  iotex: {
    bridgeFromETH: "0xC2e0f31d739cB3153bA5760a203B3bd7c27f0d7a",
    native: "0x6fbcdc1169b5130c59e72e51ed68a84841c98cd1",
  },
  aurora: {
    bridgeFromETH: "0x23Ddd3e3692d1861Ed57EDE224608875809e127f", // 60M disparity, not sure
    native: "0x4988a896b1227218e4a686fde5eabdcabd91571f",
  },
  telos: {
    native: "0xefaeee334f0fd1712f9a8cc375f427d9cdd40d73",
  },
};

// Fantom something weird going on with, 81M in bridge 171M minted

// EOS I gave up on, can't find suitable API, maybe just use USDT's API

// Liquid has 10M unreleased in USDT API, but seems no way to find account holding it

// SLP explorer is broken, seems difficult to directly query, maybe no working API
// token ID is 9fc89d6b7d5be2eac0b3787c5b8236bca5de641b5bafafc8f450727b63615c11

// Cronos: I don't think Cronos USDT is issued by Tether or bridged

// missed Oasis, also check for other Multichain destinations

async function chainMinted(chain: string, decimals: number) {
  return async function (
    _timestamp: number,
    _ethBlock: number,
    _chainBlocks: ChainBlocks
  ) {
    if (typeof _chainBlocks[chain] === "undefined") {
      throw new Error(`Chain ${chain} has undefined blocks`)
    }
    let balances = {} as Balances;
    const totalSupply = (
      await sdk.api.abi.call({
        abi: "erc20:totalSupply",
        target: chainContracts[chain].issued,
        block: _chainBlocks[chain],
        chain: chain,
      })
    ).output;
    sumSingleBalance(balances, "peggedUSD", totalSupply / 10 ** decimals);
    return balances;
  };
}

async function chainUnreleased(chain: string, decimals: number) {
  return async function (
    _timestamp: number,
    _ethBlock: number,
    _chainBlocks: ChainBlocks
  ) {
    if (typeof _chainBlocks[chain] === "undefined") {
      throw new Error(`Chain ${chain} has undefined blocks`)
    }
    let balances = {} as Balances;
    const reserve = (
      await sdk.api.erc20.balanceOf({
        target: chainContracts[chain].issued,
        owner: chainContracts[chain].unreleased,
        block: _chainBlocks[chain],
        chain: chain,
      })
    ).output;
    sumSingleBalance(balances, "peggedUSD", reserve / 10 ** decimals);
    return balances;
  };
}

async function bridgedSupply(chain: string, decimals: number) {
  return async function (
    _timestamp: number,
    _ethBlock: number,
    _chainBlocks: ChainBlocks
  ) {
    if (typeof _chainBlocks[chain] === "undefined") {
      throw new Error(`Chain ${chain} has undefined blocks`)
    }
    let balances = {} as Balances;
    const totalSupply = (
      await sdk.api.abi.call({
        abi: "erc20:totalSupply",
        target: chainContracts[chain].native,
        block: _chainBlocks[chain],
        chain: chain,
      })
    ).output;
    sumSingleBalance(balances, "peggedUSD", totalSupply / 10 ** decimals);
    return balances;
  };
}

async function supplyInEthereumBridge(chain: string) {
  return async function (
    _timestamp: number,
    _ethBlock: number,
    _chainBlocks: ChainBlocks
  ) {
    if (typeof _chainBlocks[chain] === "undefined") {
      throw new Error(`Chain ${chain} has undefined blocks`)
    }
    let balances = {} as Balances;
    const bridged = (
      await sdk.api.erc20.balanceOf({
        target: chainContracts["ethereum"].issued,
        owner: chainContracts[chain].bridgeFromETH,
        block: _ethBlock,
      })
    ).output;
    sumSingleBalance(balances, "peggedUSD", bridged / 10 ** 6);
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
    const totalSupply = await solanaGetTokenSupply(
      chainContracts["solana"].issued
    );
    sumSingleBalance(balances, "peggedUSD", totalSupply);
    return balances;
  };
}

async function solanaUnreleased() {
  return async function (
    _timestamp: number,
    _ethBlock: number,
    _chainBlocks: ChainBlocks
  ) {
    let balances = {} as Balances;
    const unreleased = await solanaGetTokenBalance(
      chainContracts["solana"].issued,
      chainContracts["solana"].unreleased
    );
    sumSingleBalance(balances, "peggedUSD", unreleased);
    return balances;
  };
}

async function liquidMinted() {
  return async function (
    _timestamp: number,
    _ethBlock: number,
    _chainBlocks: ChainBlocks
  ) {
    let balances = {} as Balances;
    const res = await axios.get(
      "https://blockstream.info/liquid/api/asset/ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2"
    );
    const issued = res.data.chain_stats.issued_amount;
    const burned = res.data.chain_stats.burned_amount;
    sumSingleBalance(balances, "peggedUSD", (issued - burned) / 10 ** 8);
    return balances;
  };
}

async function algorandMinted() {
  // I gave up on trying to use the SDK for this
  return async function (
    _timestamp: number,
    _ethBlock: number,
    _chainBlocks: ChainBlocks
  ) {
    let balances = {} as Balances;
    const supplyRes = await axios.get(
      "https://algoindexer.algoexplorerapi.io/v2/assets/312769"
    );
    const supply = supplyRes.data.asset.params.total;
    const reserveRes = await axios.get(
      "https://algoindexer.algoexplorerapi.io/v2/accounts/XIU7HGGAJ3QOTATPDSIIHPFVKMICXKHMOR2FJKHTVLII4FAOA3CYZQDLG4"
    );
    const reserveAccount = reserveRes.data.account.assets.filter(
      (asset: any) => asset["asset-id"] === 312769
    );
    const reserves = reserveAccount[0].amount;
    let balance = (supply - reserves) / 10 ** 6;
    sumSingleBalance(balances, "peggedUSD", balance);
    return balances;
  };
}

async function omniMinted() {
  return async function (
    _timestamp: number,
    _ethBlock: number,
    _chainBlocks: ChainBlocks
  ) {
    let balances = {} as Balances;
    const options = {
      method: "post",
      url: "https://api.omniexplorer.info/v1/properties/listbyecosystem",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: "ecosystem=1",
    };
    let res = await axios(options);
    let totalSupply = parseInt(res.data.properties[6].totaltokens);
    sumSingleBalance(balances, "peggedUSD", totalSupply);
    return balances;
  };
}

async function omniUnreleased() {
  return async function (
    _timestamp: number,
    _ethBlock: number,
    _chainBlocks: ChainBlocks
  ) {
    let balances = {} as Balances;
    const options = {
      method: "post",
      url: "https://api.omniexplorer.info/v1/address/addr",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: "addr=1NTMakcgVwQpMdGxRQnFKyb3G1FAJysSfz",
    };
    let res = await axios(options);
    let account = res.data.balance.filter((obj: any) => obj.id === "31");
    let balance = parseInt(account[0].value);
    sumSingleBalance(balances, "peggedUSD", balance / 10 ** 8);
    return balances;
  };
}

async function tronMinted() {
  return async function (
    _timestamp: number,
    _ethBlock: number,
    _chainBlocks: ChainBlocks
  ) {
    let balances = {} as Balances;
    const totalSupply = await tronGetTotalSupply(chainContracts["tron"].issued);
    sumSingleBalance(balances, "peggedUSD", totalSupply);
    return balances;
  };
}

async function tronUnreleased() {
  return async function (
    _timestamp: number,
    _ethBlock: number,
    _chainBlocks: ChainBlocks
  ) {
    let balances = {} as Balances;
    const unreleased = await tronGetTokenBalance(
      chainContracts["tron"].issued,
      chainContracts["tron"].unreleased
    );
    sumSingleBalance(balances, "peggedUSD", unreleased);
    return balances;
  };
}

const adapter: PeggedIssuanceAdapter = {
  ethereum: {
    minted: chainMinted("ethereum", 6),
    unreleased: chainUnreleased("ethereum", 6),
  },
  polygon: {
    minted: async () => ({}),
    ethereum: bridgedSupply("polygon", 6),
    unreleased: async () => ({}),
  },
  bsc: {
    minted: async () => ({}),
    ethereum: supplyInEthereumBridge("bsc"),
    unreleased: async () => ({}),
  },
  avalanche: {
    minted: chainMinted("avax", 6),
    ethereum: bridgedSupply("avax", 6),
    unreleased: chainUnreleased("avax", 6),
  },
  solana: {
    minted: solanaMinted(),
    unreleased: solanaUnreleased(),
  },
  arbitrum: {
    minted: async () => ({}),
    ethereum: bridgedSupply("arbitrum", 6),
    unreleased: async () => ({}),
  },
  optimism: {
    minted: async () => ({}),
    ethereum: bridgedSupply("optimism", 6),
    unreleased: async () => ({}),
  },
  boba: {
    minted: async () => ({}),
    ethereum: bridgedSupply("boba", 6),
    unreleased: async () => ({}),
  },
  metis: {
    minted: async () => ({}),
    ethereum: bridgedSupply("metis", 6),
    unreleased: async () => ({}),
  },
  moonbeam: {
    minted: async () => ({}),
    ethereum: bridgedSupply("moonbeam", 6),
    unreleased: async () => ({}),
  },
  kcc: {
    minted: async () => ({}),
    ethereum: bridgedSupply("kcc", 18),
    unreleased: async () => ({}),
  },
  moonriver: {
    minted: async () => ({}),
    ethereum: bridgedSupply("moonriver", 6),
    unreleased: async () => ({}),
  },
  harmony: {
    minted: async () => ({}),
    ethereum: bridgedSupply("harmony", 6),
    unreleased: async () => ({}),
  },
  syscoin: {
    minted: async () => ({}),
    ethereum: bridgedSupply("syscoin", 6),
    unreleased: async () => ({}),
  },
  heco: {
    minted: async () => ({}),
    ethereum: bridgedSupply("heco", 18),
    unreleased: async () => ({}),
  },
  okexchain: {
    minted: async () => ({}),
    ethereum: bridgedSupply("okexchain", 18),
    unreleased: async () => ({}),
  },
  iotex: {
    minted: async () => ({}),
    ethereum: bridgedSupply("iotex", 6),
    unreleased: async () => ({}),
  },
  tomochain: {
    minted: async () => ({}),
    ethereum: bridgedSupply("tomochain", 6),
    unreleased: async () => ({}),
  },
  kardia: {
    minted: async () => ({}),
    ethereum: bridgedSupply("kardia", 6),
    unreleased: async () => ({}),
  },
  fuse: {
    minted: async () => ({}),
    ethereum: bridgedSupply("fuse", 6),
    unreleased: async () => ({}),
  },
  /* is broken atm?
  meter: {
    minted: async () => ({}),
    ethereum: bridgedSupply("meter", 6),
    unreleased: async () => ({}),
  },
  */
  milkomeda: {
    minted: async () => ({}),
    ethereum: bridgedSupply("milkomeda", 6),
    unreleased: async () => ({}),
  },
  omni: {
    minted: omniMinted(),
    unreleased: omniUnreleased(),
  },
  tron: {
    minted: tronMinted(),
    unreleased: tronUnreleased(),
  },
  aurora: {
    minted: async () => ({}),
    ethereum: bridgedSupply("aurora", 6),
    unreleased: async () => ({}),
  },
  telos: {
    minted: async () => ({}),
    ethereum: bridgedSupply("telos", 6),
    unreleased: async () => ({}),
  },
  algorand: {
    minted: algorandMinted(),
    unreleased: async () => ({}),
  },
  liquid: {
    minted: liquidMinted(),
    unreleased: async () => ({}),
  },
};

export default adapter;
