import { network } from "hardhat";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { ethers } = await network.connect();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// I haven't really called fund() and approve() here so that has to be done manually
async function main() {
    const [deployer, beneficiary = deployer] = await ethers.getSigners();

    const totalSupply = 1000n;
    const allocation = 300n;
    const cliffDuration = 60n;
    const duration = 300n;

    const latestBlock = await ethers.provider.getBlock("latest");
    const start = BigInt(latestBlock.timestamp) + 10n;

    const tokenContract = await ethers.deployContract("MyToken", [
        totalSupply,
        "MyToken",
        "MTK",
        18,
    ]);
    await tokenContract.waitForDeployment();

    const vestingContract = await ethers.deployContract("TokenVesting", [
        beneficiary.address,
        await tokenContract.getAddress(),
        start,
        duration,
        cliffDuration,
        allocation,
    ]);
    await vestingContract.waitForDeployment();

    const tokenAddress = await tokenContract.getAddress();
    const vestingAddress = await vestingContract.getAddress();
    const frontendConfigPath = path.resolve(__dirname, "../frontend/src/config.js");

    const configContents = 
    `export const HARDHAT_CHAIN_ID = 31337n;
    export const MY_TOKEN_ADDRESS = "${tokenAddress}";
    export const TOKEN_VESTING_ADDRESS = "${vestingAddress}";`;

    await writeFile(frontendConfigPath, configContents, "utf8");

    console.log("Deployer:", deployer.address);
    console.log("Beneficiary:", beneficiary.address);
    console.log("MyToken:", tokenAddress);
    console.log("TokenVesting:", vestingAddress);
    console.log("Updated frontend config:", frontendConfigPath);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
