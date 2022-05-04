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
import { combineFunctions } from "../helper/generalUtil";
const axios = require("axios"); // ADD RETRY EVERYWHERE

type ChainContracts = {
  [chain: string]: {
    [contract: string]: string[];
  };
};
// any bridgeOnETH contracts are not used and are just for info purposes
const chainContracts: ChainContracts = {
  ethereum: {
    issued: ["0xdAC17F958D2ee523a2206206994597C13D831ec7"],
    nativeFromBSC: ["0xDe60aDfDdAAbaAAC3dAFa57B26AcC91Cb63728c4"], // wormhole
    nativeFromSol: ["0x1CDD2EaB61112697626F7b4bB0e23Da4FeBF7B7C"], // wormhole
    unreleased: ["0x5754284f345afc66a98fbb0a0afe71e0f007b949"], // api claims slightly less than this
  },
  polygon: {
    bridgeOnETH: ["0x40ec5B33f54e0E8A33A975908C5BA1c14e5BbbDf"],
    nativeFromETH: [
      "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
      "0x9417669fBF23357D2774e9D421307bd5eA1006d2", // wormhole
    ],
    nativeFromSol: ["0x3553f861dEc0257baDA9F8Ed268bf0D74e45E89C"], // wormhole
  },
  bsc: {
    bridgeOnETH: ["0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503"], // native one can't get balance
    nativeFromAvax: ["0x2B90E061a517dB2BbD7E39Ef7F733Fd234B494CA"], // wormhole
    nativeFromETH: ["0x524bC91Dc82d6b90EF29F76A3ECAaBAffFD490Bc"], // wormhole
    nativeFromSol: ["0x49d5cC521F75e13fa8eb4E89E9D381352C897c96"], // wormhole but the info on this is typo'd???
  },
  avax: {
    bridgeOnETH: ["0xE78388b4CE79068e89Bf8aA7f218eF6b9AB0e9d0"],
    nativeFromETH: ["0xc7198437980c041c805a1edcba50c1ce5db95118"],
    nativeFromSol: ["0xF0FF231e3F1A50F83136717f287ADAB862f89431"], // wormhole
    nativeFromBSC: ["0xA67BCC0D06d7d13A13A2AE30bF30f1B434f5a28B"], // wormhole
    issued: ["0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7"],
    unreleased: ["0x5754284f345afc66a98fbb0a0afe71e0f007b949"],
  },
  solana: {
    issued: ["Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"],
    nativeFromETH: [
      "Dn4noZ5jgGfkntzcQSUZ8czkreiZ1ForXYoV2H8Dm7S1", // wormhole
      "Bn113WT6rbdgwrm12UJtnmNqGqZjY4it2WoUQuQopFVn", // allbridge
    ],
    nativeFromPolygon: [
      "5goWRao6a3yNC4d6UjMdQxonkCMvKBwdpubU3qhfcdf1", // wormhole
      "DNhZkUaxHXYvpxZ7LNnHtss8sQgdAfd1ZYS1fB7LKWUZ", // allbridge
    ],
    nativeFromBSC: [
      "8qJSyQprMC57TWKaYEmetUR3UUiTP2M3hXdcvFhkZdmv", // wormhole
      "E77cpQ4VncGmcAXX16LHFFzNBEBb2U7Ar7LBmZNfCgwL", // allbridge
    ],
    nativeFromHeco: ["GfzU1fLASNV3r4NtEyrnwTyTakJkYzoivnaL3Snh45oj"], // allbridge
    nativeFromAvax: ["FwEHs3kJEdMa2qZHv7SgzCiFXUQPEycEXksfBkwmS8gj"], // allbridge
    unreleased: ["Q6XprfkF8RQQKoQVG33xT88H7wi8Uk1B1CC7YAs69Gi"],
  },
  tron: {
    issued: ["TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"],
    unreleased: ["TKHuVq1oKVruCGLvqVexFs6dawKv6fQgFs"],
  },
  arbitrum: {
    bridgeOnETH: ["0xcee284f754e854890e311e3280b767f80797180d"],
    native: ["0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9"],
  },
  optimism: {
    bridgeOnETH: ["0x99c9fc46f92e8a1c0dec1b1747d010903e884be1"],
    native: ["0x94b008aA00579c1307B0EF2c499aD98a8ce58e58"],
  },
  boba: {
    bridgeOnETH: ["0xdc1664458d2f0b6090bea60a8793a4e66c2f1c00"],
    native: ["0x5DE1677344D3Cb0D7D465c10b72A8f60699C062d"],
  },
  metis: {
    bridgeOnETH: ["0x3980c9ed79d2c191A89E02Fa3529C60eD6e9c04b"],
    native: ["0xbB06DCA3AE6887fAbF931640f67cab3e3a16F4dC"],
  },
  moonbeam: {
    bridgeOnETH: ["0xEC4486a90371c9b66f499Ff3936F29f0D5AF8b7E"],
    nativeFromETH: [
      "0xeFAeeE334F0Fd1712f9a8cc375f427D9Cdd40d73",
      "0x81ECac0D6Be0550A00FF064a4f9dd2400585FE9c", // cbridge
    ],
  },
  kcc: {
    bridgeOnETH: ["0xD6216fC19DB775Df9774a6E33526131dA7D19a2c"],
    native: ["0x0039f574ee5cc39bdd162e9a88e3eb1f111baf48"], //is this correct? huge disparity
  },
  moonriver: {
    bridgeOnETH: ["0x10c6b61dbf44a083aec3780acf769c77be747e23"],
    native: ["0xB44a9B6905aF7c801311e8F4E76932ee959c663C"],
  },
  tomochain: {
    native: ["0x381b31409e4d220919b2cff012ed94d70135a59e"],
  },
  harmony: {
    bridgeOnETH: ["0x2dccdb493827e15a5dc8f8b72147e6c4a5620857"],
    native: ["0x3c2b8be99c50593081eaa2a724f0b8285f5aba8f"],
  },
  syscoin: {
    bridgeOnETH: ["0x8cC49FE67A4bD7a15674c4ffD4E969D94304BBbf"],
    native: ["0x922d641a426dcffaef11680e5358f34d97d112e1"],
  },
  kardia: {
    native: ["0x551a5dcac57c66aa010940c2dcff5da9c53aa53b"],
  },
  heco: {
    bridgeOnETH: ["0xA929022c9107643515F5c777cE9a910F0D1e490C"], //contain slightly less than native
    native: ["0xa71EdC38d189767582C38A3145b5873052c3e47a"],
  },
  okexchain: {
    bridgeOnETH: ["0x5041ed759Dd4aFc3a72b8192C143F72f4724081A"],
    native: ["0x382bb369d343125bfb2117af9c149795c6c65c50"],
  },
  fuse: {
    native: ["0xfadbbf8ce7d5b7041be672561bba99f79c532e10"],
  },
  meter: {
    native: ["0x5fa41671c48e3c951afc30816947126ccc8c162e"],
  },
  milkomeda: {
    native: [
      "0x80A16016cC4A2E6a2CACA8a4a498b1699fF0f844",
      "0x3795C36e7D12A8c252A20C5a7B455f7c57b60283", // cbridge
    ],
  },
  iotex: {
    bridgeOnETH: ["0xC2e0f31d739cB3153bA5760a203B3bd7c27f0d7a"],
    native: ["0x6fbcdc1169b5130c59e72e51ed68a84841c98cd1"],
  },
  aurora: {
    bridgeOnETH: ["0x23Ddd3e3692d1861Ed57EDE224608875809e127f"], // 60M disparity, not sure
    native: ["0x4988a896b1227218e4a686fde5eabdcabd91571f"],
  },
  telos: {
    native: ["0xefaeee334f0fd1712f9a8cc375f427d9cdd40d73"],
  },
  oasis: {
    native: [
      "0x6Cb9750a92643382e020eA9a170AbB83Df05F30B", // native, 107M from evodefi??? sus
      "0x366EF31C8dc715cbeff5fA54Ad106dC9c25C6153", // wormhole #1 from where?
      "0xdC19A122e268128B5eE20366299fc7b5b199C8e3", // wormhole #2 ??? don't know
      "0x4Bf769b05E832FCdc9053fFFBC78Ca889aCb5E1E", // cbridge
    ],
  },
  bittorrent: {
    nativeFromETH: ["0xE887512ab8BC60BcC9224e1c3b5Be68E26048B8B"],
    nativeFromBSC: ["0x9B5F27f6ea9bBD753ce3793a07CbA3C74644330d"],
    nativeFromTron: ["0xdB28719F7f938507dBfe4f0eAe55668903D34a15"],
  },
  crab: {
    native: ["0x6a2d262D56735DbA19Dd70682B39F6bE9a931D98"], // cbridge
  }
};

// Fantom something weird going on with, 81M in bridge 171M minted
// "0xA40AF6E9c7f86D378F817ec839B0217c29A4730f": Fantom wormhole, 0 supply

// EOS I gave up on, can't find suitable API, maybe just use USDT's API

// Liquid has 10M unreleased in USDT API, but seems no way to find account holding it

// SLP explorer is broken, seems difficult to directly query, maybe no working API
// token ID is 9fc89d6b7d5be2eac0b3787c5b8236bca5de641b5bafafc8f450727b63615c11

// Cronos: I don't think Cronos USDT is issued by Tether or bridged

// double-check celer/allbridge/wormhole/multichain

// don't know how to count the 2 Saber wrapped USDT on Solana

// add evmos eventually. evmos cbridge: 0xb72A7567847abA28A2819B855D7fE679D4f59846

// shiden: "0x818ec0A7Fe18Ff94269904fCED6AE3DaE6d6dC0b", don't know where it's from

// conflux: "cfx:acf2rcsh8payyxpg6xj7b0ztswwh81ute60tsw35j7" from shuttleflow, don't know where from
// "0xfe97E85d13ABD9c1c33384E796F10B73905637cE" from cbridge, address doesn't work?

// terra should have wormhole

// astar?

// rei?

// flow: "A.231cc0dbbcffc4b7.ceUSDT" cbridge, check for others

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
    const balance = (supply - reserves) / 10 ** 6;
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
    const res = await axios(options);
    const totalSupply = parseInt(res.data.properties[6].totaltokens);
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
    const res = await axios(options);
    const account = res.data.balance.filter((obj: any) => obj.id === "31");
    const balance = parseInt(account[0].value);
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
    const totalSupply = await tronGetTotalSupply(
      chainContracts["tron"].issued[0]
    );
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
      chainContracts["tron"].issued[0],
      chainContracts["tron"].unreleased[0]
    );
    sumSingleBalance(balances, "peggedUSD", unreleased);
    return balances;
  };
}

const adapter: PeggedIssuanceAdapter = {
  ethereum: {
    minted: chainMinted("ethereum", 6),
    bsc: bridgedSupply("ethereum", 18, chainContracts.ethereum.nativeFromBSC),
    solana: bridgedSupply("ethereum", 6, chainContracts.ethereum.nativeFromSol),
    unreleased: chainUnreleased(
      "ethereum",
      6,
      chainContracts.ethereum.unreleased[0]
    ),
  },
  polygon: {
    minted: async () => ({}),
    ethereum: bridgedSupply("polygon", 6, chainContracts.polygon.nativeFromETH),
    solana: bridgedSupply("polygon", 6, chainContracts.polygon.nativeFromSol),
    unreleased: async () => ({}),
  },
  bsc: {
    minted: async () => ({}),
    ethereum: combineFunctions(
      [
        supplyInEthereumBridge(
          chainContracts.ethereum.issued[0],
          chainContracts.bsc.bridgeOnETH[0]
        ),
        bridgedSupply("bsc", 6, chainContracts.bsc.nativeFromETH),
      ],
      "peggedUSD"
    ),
    avalanche: bridgedSupply("bsc", 6, chainContracts.bsc.nativeFromAvax),
    solana: bridgedSupply("bsc", 6, chainContracts.bsc.nativeFromSol),
    unreleased: async () => ({}),
  },
  avalanche: {
    minted: chainMinted("avax", 6),
    ethereum: bridgedSupply("avax", 6, chainContracts.avax.nativeFromETH),
    solana: bridgedSupply("avax", 6, chainContracts.avax.nativeFromSol),
    bsc: bridgedSupply("avax", 18, chainContracts.avax.nativeFromBSC),
    unreleased: chainUnreleased("avax", 6, chainContracts.avax.unreleased[0]),
  },
  /* blockchain is taking a rest, need to comment it out everywhere for today
  solana: {
    minted: solanaMintedOrBridged(chainContracts.solana.issued),
    ethereum: solanaMintedOrBridged(chainContracts.solana.nativeFromETH),
    polygon: solanaMintedOrBridged(chainContracts.solana.nativeFromPolygon),
    bsc: solanaMintedOrBridged(chainContracts.solana.nativeFromBSC),
    heco: solanaMintedOrBridged(chainContracts.solana.nativeFromHeco),
    avalanche: solanaMintedOrBridged(chainContracts.solana.nativeFromAvax),
    unreleased: solanaUnreleased(),
  },
  */
  arbitrum: {
    minted: async () => ({}),
    ethereum: bridgedSupply("arbitrum", 6, chainContracts.arbitrum.native),
    unreleased: async () => ({}),
  },
  optimism: {
    minted: async () => ({}),
    ethereum: bridgedSupply("optimism", 6, chainContracts.optimism.native),
    unreleased: async () => ({}),
  },
  boba: {
    minted: async () => ({}),
    ethereum: bridgedSupply("boba", 6, chainContracts.boba.native),
    unreleased: async () => ({}),
  },
  metis: {
    minted: async () => ({}),
    ethereum: bridgedSupply("metis", 6, chainContracts.metis.native),
    unreleased: async () => ({}),
  },
  moonbeam: {
    minted: async () => ({}),
    ethereum: bridgedSupply(
      "moonbeam",
      6,
      chainContracts.moonbeam.nativeFromETH
    ),
    unreleased: async () => ({}),
  },
  kcc: {
    minted: async () => ({}),
    ethereum: bridgedSupply("kcc", 18, chainContracts.kcc.native),
    unreleased: async () => ({}),
  },
  moonriver: {
    minted: async () => ({}),
    ethereum: bridgedSupply("moonriver", 6, chainContracts.moonriver.native),
    unreleased: async () => ({}),
  },
  harmony: {
    minted: async () => ({}),
    ethereum: bridgedSupply("harmony", 6, chainContracts.harmony.native),
    unreleased: async () => ({}),
  },
  syscoin: {
    minted: async () => ({}),
    ethereum: bridgedSupply("syscoin", 6, chainContracts.syscoin.native),
    unreleased: async () => ({}),
  },
  heco: {
    minted: async () => ({}),
    ethereum: bridgedSupply("heco", 18, chainContracts.heco.native),
    unreleased: async () => ({}),
  },
  okexchain: {
    minted: async () => ({}),
    ethereum: bridgedSupply("okexchain", 18, chainContracts.okexchain.native),
    unreleased: async () => ({}),
  },
  iotex: {
    minted: async () => ({}),
    ethereum: bridgedSupply("iotex", 6, chainContracts.iotex.native),
    unreleased: async () => ({}),
  },
  tomochain: {
    minted: async () => ({}),
    ethereum: bridgedSupply("tomochain", 6, chainContracts.tomochain.native),
    unreleased: async () => ({}),
  },
  kardia: {
    minted: async () => ({}),
    ethereum: bridgedSupply("kardia", 6, chainContracts.kardia.native),
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
  milkomeda: {
    minted: async () => ({}),
    ethereum: bridgedSupply("milkomeda", 6, chainContracts.milkomeda.native),
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
    ethereum: bridgedSupply("aurora", 6, chainContracts.aurora.native),
    unreleased: async () => ({}),
  },
  telos: {
    minted: async () => ({}),
    ethereum: bridgedSupply("telos", 6, chainContracts.telos.native),
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
  bittorrent: {
    minted: async () => ({}),
    ethereum: bridgedSupply(
      "bittorrent",
      6,
      chainContracts.bittorrent.nativeFromETH
    ),
    bsc: bridgedSupply(
      "bittorrent",
      18,
      chainContracts.bittorrent.nativeFromBSC
    ),
    tron: bridgedSupply(
      "bittorrent",
      6,
      chainContracts.bittorrent.nativeFromTron
    ),
    unreleased: async () => ({}),
  },
  crab: {
    minted: async () => ({}),
    ethereum: bridgedSupply("crab", 6, chainContracts.crab.native),
    unreleased: async () => ({}),
  },
};

export default adapter;
