require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // Local Hardhat node (for unit testing)
    hardhat: {
      chainId: 1337,
    },
    // Your Hyperledger Besu docker network — via EthSigner proxy so transactions appear in Quorum Explorer
    besu: {
      url: "http://127.0.0.1:18545",
      chainId: 1337,
      // EthSigner manages the key internally — no private key needed here
      accounts: ["0x8f2a55949038a9610f50fb23b5883af3b4ecb3c3bb792cbcefbd1542c692be63"]
    },
  },
};
