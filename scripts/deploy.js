import { network } from "hardhat";

const { ethers } = await network.connect();

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

    console.log("Deployer:", deployer.address);
    console.log("Beneficiary:", beneficiary.address);
    console.log("MyToken:", await tokenContract.getAddress());
    console.log("TokenVesting:", await vestingContract.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
