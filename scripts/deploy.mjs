import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  console.log("Deploying RentalPayment contract...");

  // Deploy USDC mock first if you're testing
  // const USDCMock = await ethers.getContractFactory("USDCMock");
  // const usdc = await USDCMock.deploy();
  // await usdc.deployed();
  // console.log("USDC Mock deployed to:", usdc.address);

  // Deploy RentalPayment
  const RentalPayment = await ethers.getContractFactory("RentalPayment");
  const rental = await RentalPayment.deploy(
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" // Base USDC address
  );

  // Wait for the deployment to be mined
  await rental.waitForDeployment();

  // Log the deployed contract address
  console.log("RentalPayment deployed to:", rental.target); // Access the target property
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 