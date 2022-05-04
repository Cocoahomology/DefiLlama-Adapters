import { ChainBlocks } from "./peggedAsset.type";
import { Chain } from "@defillama/sdk/build/general";
import { lookupBlock } from "@defillama/sdk/build/util/index";
import adapter from "./tether/backfill";

const blockRetries = 3;
const chainBlocks = {} as {
  [chain: string]: number;
};

async function getEthBlock(timestamp: number) {
  return {
    ethereumBlock: (await lookupBlock(timestamp, { chain: "ethereum" })).block,
    chainBlocks: {},
  };
}

async function getChainBlocks(timestamp: number, chains: Chain[]) {
  const chainBlocks = {} as {
    [chain: string]: number;
  };
  await Promise.all(
    chains.map(async (chain) => {
      for (let i = 0; i < blockRetries; i++) {
        try {
          chainBlocks[chain] = await lookupBlock(timestamp, {
            chain,
          }).then((block) => block.block);
          break;
        } catch (e) {
          if (i === blockRetries - 1) {
            throw e;
          }
        }
      }
    })
  );
  return chainBlocks;
}

const chainsForBlocks = [
  "ethereum",
  "avax",
  "bsc",
  "polygon",
  "xdai",
  "fantom",
  "arbitrum",
  "optimism",
  "boba",
  "metis",
  "kcc",
  "syscoin",
  "iotex",
  "tomochain",
  "kardia",
  "aurora",
  "telos",
  "moonriver",
  "iotex",
  "okexchain",
  "polygon",
  "moonbeam",
  "milkomeda",
  "elastos",
  "ronin",
  "harmony",
  "fuse",
  "heco",
] as Chain[];

let timestamp = 1651098049;
const secondsInWeek = 86400 * 7;

const test = async () => {
  let chains = chainsForBlocks;
  let chainBlocks = {} as any;
  
  /*
  while (true) {
    console.log(timestamp);
    if (timestamp < 1643338800) {    // all timestamps are only accurate to nearest week, counting back from 1643338800
      chains = await chains.filter((chain) => chain !== "milkomeda");
    }
    if (timestamp < 1640314800) {  
      chains = await chains.filter((chain) => chain !== "moonbeam");
    }
    if (timestamp < 1639105200) {  
      chains = await chains.filter((chain) => chain !== "syscoin");
    }
    if (timestamp < 1637895600) {  
      chains = await chains.filter((chain) => chain !== "metis");
    }
    if (timestamp < 1636686000) {  
      chains = await chains.filter((chain) => chain !== "optimism");
    }
    if (timestamp < 1635476400) {  
      chains = await chains.filter((chain) => chain !== "boba");
    }
    if (timestamp < 1635476400) {  // NOT start of chain, but can't get block earlier (check again)
      chains = await chains.filter((chain) => chain !== "telos");
    }
    if (timestamp < 1634871600) {  // NOT start of chain, but can't get block earlier (check again)
      chains = await chains.filter((chain) => chain !== "aurora");
    }
    if (timestamp < 1625194800) {  
      chains = await chains.filter((chain) => chain !== "moonriver");
    }
    if (timestamp < 1623985200) {  
      chains = await chains.filter((chain) => chain !== "arbitrum");
    }
    if (timestamp < 1622775600) {  
      chains = await chains.filter((chain) => chain !== "kcc");
    }
    if (timestamp < 1620961200) {  // NOT start of chain, but can't get block earlier (check again)
      chains = await chains.filter((chain) => chain !== "okexchain");
    }
    chainBlocks = await getChainBlocks(timestamp, chains);
    //console.log(chainBlocks["okexchain"]);
    const { ethereumBlock } = await getEthBlock(timestamp);
    // chainBlocks.ethereum = ethereumBlock;
    chains.forEach((chain) => {
      if (typeof chainBlocks[chain] === "undefined") {
        throw new Error(`Chain ${chain} has no blocks`);
      }
    });
    timestamp = timestamp - secondsInWeek;
  }
  */
  
    if (timestamp < 1643338800) {    // all timestamps are only accurate to nearest week, counting back from 1643338800
      chains = await chains.filter((chain) => chain !== "milkomeda");
    }
    if (timestamp < 1640314800) {  
      chains = await chains.filter((chain) => chain !== "moonbeam");
    }
    if (timestamp < 1639105200) {  
      chains = await chains.filter((chain) => chain !== "syscoin");
    }
    if (timestamp < 1637895600) {  
      chains = await chains.filter((chain) => chain !== "metis");
    }
    if (timestamp < 1636686000) {  
      chains = await chains.filter((chain) => chain !== "optimism");
    }
    if (timestamp < 1635476400) {  
      chains = await chains.filter((chain) => chain !== "boba");
    }
    if (timestamp < 1635476400) {  // NOT start of chain, but can't get block earlier (check again)
      chains = await chains.filter((chain) => chain !== "telos");
    }
    if (timestamp < 1634871600) {  // NOT start of chain, but can't get block earlier (check again)
      chains = await chains.filter((chain) => chain !== "aurora");
    }
    if (timestamp < 1625194800) {  
      chains = await chains.filter((chain) => chain !== "moonriver");
    }
    if (timestamp < 1623985200) {  
      chains = await chains.filter((chain) => chain !== "arbitrum");
    }
    if (timestamp < 1622775600) {  
      chains = await chains.filter((chain) => chain !== "kcc");
    }
    if (timestamp < 1620961200) {  // NOT start of chain, but can't get block earlier (check again)
      chains = await chains.filter((chain) => chain !== "okexchain");
    }
    chainBlocks = await getChainBlocks(timestamp, chains);
    const { ethereumBlock } = await getEthBlock(timestamp);
    chainBlocks.ethereum = ethereumBlock;
    chainsForBlocks.forEach((chain) => {
      if (typeof chainBlocks[chain] === "undefined") {
        chainBlocks[chain] = 1;
      }
    });
    console.log(chainBlocks)
  for (let chain of Object.keys(adapter)) {
    const results = await result(timestamp, ethereumBlock, chainBlocks, chain);
    console.log(JSON.stringify({ [chain]: results }));
  }
  
};

const result = async (
  timestamp: number,
  ethBlock: number,
  chainBlocks: ChainBlocks,
  chain: string
) => {
  let results = Object.entries(adapter[chain]).map(
    async ([issuanceType, issuanceFunction]) => {
      let resolvedFunc = await issuanceFunction;
      if (typeof resolvedFunc !== "function") {
        return { [`${issuanceType}`]: 0 };
      }
      let total = await resolvedFunc(timestamp, ethBlock, chainBlocks);
      //console.log(total);
      if (Object.keys(total).length !== 0) {
        return { [`${issuanceType}`]: total };
      } else return { [`${issuanceType}`]: 0 };
    }
  );
  return Promise.all(results);
};

test();
