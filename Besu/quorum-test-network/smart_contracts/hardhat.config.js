require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28", // Matches your VS Code version
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337, // Matches your docker-compose settings
    },
  },
};
