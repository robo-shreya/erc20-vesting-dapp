import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

export default {
  plugins: [hardhatToolboxMochaEthers],
  solidity: "0.8.28",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
};