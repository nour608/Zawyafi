import { ethers } from 'hardhat';

async function main() {
  console.log('Deploying DailySalesRecorder contract...');

  // Get forwarder address from https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory
  const SEPOLIA_FORWARDER = "0x..."; // Replace with actual Sepolia forwarder address

  const DailySalesRecorder = await ethers.getContractFactory('DailySalesRecorder');
  const contract = await DailySalesRecorder.deploy(SEPOLIA_FORWARDER);

  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`DailySalesRecorder deployed to: ${address}`);
  console.log(`\nUpdate your workflow config.json with:`);
  console.log(`"consumerAddress": "${address}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
