const sdk = require("@defillama/sdk");
import {
  getTokenSupply as solanaGetTokenSupply,
  getTokenBalance as solanaGetTokenBalance,
} from "../helper/solana";
import { sumSingleBalance } from "../helper/generalUtil";
import {
  ChainBlocks,
  PeggedIssuanceAdapter,
  Balances,
} from "../peggedAsset.type";
import {
  getTotalSupply as tronGetTotalSupply, // NOTE THIS DEPENDENCY
} from "../helper/tron";
const axios = require("axios");

type ChainContracts = {
  [chain: string]: {
    [contract: string]: string[];
  };
};

const chainContracts: ChainContracts = {
  ethereum: {
    issued: ["0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"],
  },
  polygon: {
    bridgeOnETH: ["0x40ec5b33f54e0e8a33a975908c5ba1c14e5bbbdf"],
    native: ["0x2791bca1f2de4661ed88a30c99a7a9449aa84174"],
  },
  bsc: {
    bridgeOnETH: ["0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503"], // native one can't get balance
  },
  avax: {
    bridgeOnETH: ["0xe78388b4ce79068e89bf8aa7f218ef6b9ab0e9d0"],
    native: ["0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664"], // should check these amounts
    issued: ["0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e"],
  },
  solana: {
    issued: ["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"],
    unreleased: ["7VHUFJHWu2CuExkJcJrzhQPJ2oygupTWkL2A2For4BmE"], // address doesn't seem correct, just coincidence has correct amount
  },
  arbitrum: {
    bridgeOnETH: ["0xcee284f754e854890e311e3280b767f80797180d"],
    native: ["0xff970a61a04b1ca14834a43f5de4533ebddb5cc8"],
  },
  optimism: {
    bridgeOnETH: ["0x99c9fc46f92e8a1c0dec1b1747d010903e884be1"],
    native: ["0x7f5c764cbc14f9669b88837ca1490cca17c31607"],
  },
  boba: {
    bridgeOnETH: ["0xdc1664458d2f0b6090bea60a8793a4e66c2f1c00"],
    native: ["0x66a2a913e447d6b4bf33efbec43aaef87890fbbc"],
  },
  metis: {
    bridgeOnETH: ["0x3980c9ed79d2c191A89E02Fa3529C60eD6e9c04b"],
    native: ["0xea32a96608495e54156ae48931a7c20f0dcc1a21"],
  },
  moonbeam: {
    bridgeOnETH: ["0xec4486a90371c9b66f499ff3936f29f0d5af8b7e"],
    native: ["0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b"],
  },
  kcc: {
    bridgeOnETH: ["0xD6216fC19DB775Df9774a6E33526131dA7D19a2c"], //there is another one with same amount? check for usdt too
    native: ["0x980a5afef3d17ad98635f6c5aebcbaeded3c3430"],
  },
  moonriver: {
    bridgeOnETH: ["0x10c6b61dbf44a083aec3780acf769c77be747e23"],
    native: ["0xe3f5a90f9cb311505cd691a46596599aa1a0ad7d"],
  },
  harmony: {
    bridgeOnETH: ["0x2dccdb493827e15a5dc8f8b72147e6c4a5620857"],
    native: ["0x985458e523db3d53125813ed68c274899e9dfab4"],
  },
  syscoin: {
    bridgeOnETH: ["0x8cC49FE67A4bD7a15674c4ffD4E969D94304BBbf"],
    native: ["0x2bf9b864cdc97b08b6d79ad4663e71b8ab65c45c"],
  },
  okexchain: {
    bridgeOnETH: ["0x2c8FBB630289363Ac80705A1a61273f76fD5a161"],
    native: ["0xc946daf81b08146b1c7a8da2a851ddf2b3eaaf85"],
  },
  tomochain: {
    native: ["0xcca4e6302510d555b654b3eab9c0fcb223bcfdf0"],
  },
  ronin: {
    native: ["0x0b7007c13325c48911f73a2dad5fa5dcbf808adc"],
  },
  aurora: {
    bridgeOnETH: ["0x23Ddd3e3692d1861Ed57EDE224608875809e127f"], // disparity, not sure
    native: ["0xB12BFcA5A55806AaF64E99521918A4bf0fC40802"],
  },
  fuse: {
    native: ["0x620fd5fa44be6af63715ef4e65ddfa0387ad13f5"],
  },
  meter: {
    native: ["0xd86e243fc0007e6226b07c9a50c9d70d78299eb5"],
  },
  telos: {
    native: ["0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b"],
  },
  milkomeda: {
    native: ["0xb44a9b6905af7c801311e8f4e76932ee959c663c"],
  },
  elastos: {
    native: ["0xa06be0f5950781ce28d965e5efc6996e88a8c141"],
  },
  tron: {
    issued: ["TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8"],
  },
};

// Fantom: again, still not going to add until I understand

// Sora: can't find anything

// Cronos: still don't trust uses real assets

// DFK Chain: ...don't look too good

// Flow: A.b19436aae4d94622.FiatToken. HTTP API has no info about tokens

// Hedera: no info yet

// Stellar: no info yet

// missed Oasis, also check for other Multichain destinations

// double-check celer/allbridge/wormhole/multichain

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

async function bridgedSupply(
  chain: string,
  decimals: number,
  addresses: string[]
) {
  return async function (
    _timestamp: number,
    _ethBlock: number,
    _chainBlocks: ChainBlocks
  ) {
    let balances = {} as Balances;
    for (let address of addresses) {
      const totalSupply = (
        await sdk.api.abi.call({
          abi: "erc20:totalSupply",
          target: address,
          block: _chainBlocks[chain],
          chain: chain,
        })
      ).output;
      sumSingleBalance(balances, "peggedUSD", totalSupply / 10 ** decimals);
    }
    return balances;
  };
}

async function supplyInEthereumBridge(target: string, owner: string) {
  return async function (
    _timestamp: number,
    _ethBlock: number,
    _chainBlocks: ChainBlocks
  ) {
    let balances = {} as Balances;
    const bridged = (
      await sdk.api.erc20.balanceOf({
        target: target,
        owner: owner,
        block: _ethBlock,
      })
    ).output;
    sumSingleBalance(balances, "peggedUSD", bridged / 10 ** 6);
    return balances;
  };
}

async function solanaMintedOrBridged(targets: string[]) {
  return async function (
    _timestamp: number,
    _ethBlock: number,
    _chainBlocks: ChainBlocks
  ) {
    let balances = {} as Balances;
    for (let target of targets) {
      const totalSupply = await solanaGetTokenSupply(target);
      sumSingleBalance(balances, "peggedUSD", totalSupply);
    }
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
      chainContracts["solana"].issued[0],
      chainContracts["solana"].unreleased[0]
    );
    sumSingleBalance(balances, "peggedUSD", unreleased);
    return balances;
  };
}

async function algorandIssuance() {
  // I gave up on trying to use the SDK for this
  return async function (
    _timestamp: number,
    _ethBlock: number,
    _chainBlocks: ChainBlocks
  ) {
    let balances = {} as Balances;
    const supplyRes = await axios.get(
      "https://algoindexer.algoexplorerapi.io/v2/assets/31566704"
    );
    const supply = supplyRes.data.asset.params.total;
    const reserveRes = await axios.get(
      "https://algoindexer.algoexplorerapi.io/v2/accounts/2UEQTE5QDNXPI7M3TU44G6SYKLFWLPQO7EBZM7K7MHMQQMFI4QJPLHQFHM"
    );
    const reserveAccount = reserveRes.data.account.assets.filter(
      (asset: any) => asset["asset-id"] === 31566704
    );
    const reserves = reserveAccount[0].amount;
    let balance = (supply - reserves) / 10 ** 6;
    sumSingleBalance(balances, "peggedUSD", balance);
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
    const totalSupply = await tronGetTotalSupply(
      chainContracts["tron"].issued[0]
    );
    sumSingleBalance(balances, "peggedUSD", totalSupply);
    return balances;
  };
}

const adapter: PeggedIssuanceAdapter = {
  ethereum: {
    minted: chainMinted("ethereum", 6),
    unreleased: async () => ({}),
  },
  polygon: {
    minted: async () => ({}),
    ethereum: bridgedSupply("polygon", 6, chainContracts.polygon.native),
    unreleased: async () => ({}),
  },
  solana: {
    minted: solanaMintedOrBridged(chainContracts.solana.issued),
    unreleased: solanaUnreleased(),
  },
  bsc: {
    minted: async () => ({}),
    ethereum: supplyInEthereumBridge(
      chainContracts.ethereum.issued[0],
      chainContracts.bsc.bridgeOnETH[0]
    ),
    unreleased: async () => ({}),
  },
  avalanche: {
    minted: chainMinted("avax", 6),
    ethereum: bridgedSupply("avax", 6, chainContracts.avax.native),
    unreleased: async () => ({}),
  },
  harmony: {
    minted: async () => ({}),
    ethereum: bridgedSupply("harmony", 6, chainContracts.harmony.native),
    unreleased: async () => ({}),
  },
  arbitrum: {
    minted: async () => ({}),
    ethereum: bridgedSupply("arbitrum", 6, chainContracts.arbitrum.native),
    unreleased: async () => ({}),
  },
  okexchain: {
    minted: async () => ({}),
    ethereum: bridgedSupply("okexchain", 18, chainContracts.okexchain.native),
    unreleased: async () => ({}),
  },
  moonriver: {
    minted: async () => ({}),
    ethereum: bridgedSupply("moonriver", 6, chainContracts.moonriver.native),
    unreleased: async () => ({}),
  },
  moonbeam: {
    minted: async () => ({}),
    ethereum: bridgedSupply("moonbeam", 6, chainContracts.moonbeam.native),
    unreleased: async () => ({}),
  },
  boba: {
    minted: async () => ({}),
    ethereum: bridgedSupply("boba", 6, chainContracts.boba.native),
    unreleased: async () => ({}),
  },
  optimism: {
    minted: async () => ({}),
    ethereum: bridgedSupply("optimism", 6, chainContracts.optimism.native),
    unreleased: async () => ({}),
  },
  metis: {
    minted: async () => ({}),
    ethereum: bridgedSupply("metis", 6, chainContracts.metis.native),
    unreleased: async () => ({}),
  },
  kcc: {
    minted: async () => ({}),
    ethereum: bridgedSupply("kcc", 18, chainContracts.kcc.native),
    unreleased: async () => ({}),
  },
  syscoin: {
    minted: async () => ({}),
    ethereum: bridgedSupply("syscoin", 6, chainContracts.syscoin.native),
    unreleased: async () => ({}),
  },
  tomochain: {
    minted: async () => ({}),
    ethereum: bridgedSupply("tomochain", 6, chainContracts.tomochain.native),
    unreleased: async () => ({}),
  },
  ronin: {
    minted: async () => ({}),
    ethereum: bridgedSupply("ronin", 6, chainContracts.ronin.native),
    unreleased: async () => ({}),
  },
  aurora: {
    minted: async () => ({}),
    ethereum: bridgedSupply("aurora", 6, chainContracts.aurora.native),
    unreleased: async () => ({}),
  },
  fuse: {
    minted: async () => ({}),
    ethereum: bridgedSupply("fuse", 6, chainContracts.fuse.native),
    unreleased: async () => ({}),
  },
  meter: {
    minted: async () => ({}),
    ethereum: bridgedSupply("meter", 6, chainContracts.meter.native),
    unreleased: async () => ({}),
  },
  telos: {
    minted: async () => ({}),
    ethereum: bridgedSupply("telos", 6, chainContracts.telos.native),
    unreleased: async () => ({}),
  },
  milkomeda: {
    minted: async () => ({}),
    ethereum: bridgedSupply("milkomeda", 6, chainContracts.milkomeda.native),
    unreleased: async () => ({}),
  },
  elastos: {
    minted: async () => ({}),
    ethereum: bridgedSupply("elastos", 6, chainContracts.elastos.native),
    unreleased: async () => ({}),
  },
  algorand: {
    minted: algorandIssuance(),
    unreleased: async () => ({}),
  },
  tron: {
    minted: tronMinted(),
    unreleased: async () => ({}),
  },
};

export default adapter;
