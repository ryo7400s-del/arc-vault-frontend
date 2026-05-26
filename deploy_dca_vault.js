const { ethers } = require('ethers');
const fs = require('fs');

const RPC_URL = "https://rpc.testnet.arc.network";
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  console.log("デプロイアドレス:", wallet.address);
  const abi = JSON.parse(fs.readFileSync('build/contracts_ArcAgentVault_sol_ArcAgentVault.abi'));
  const bin = fs.readFileSync('build/contracts_ArcAgentVault_sol_ArcAgentVault.bin', 'utf8');
  const factory = new ethers.ContractFactory(abi, bin, wallet);
  console.log("デプロイ中...");
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log("✅ DCA専用Vault:", address);
}

main().catch(console.error);
