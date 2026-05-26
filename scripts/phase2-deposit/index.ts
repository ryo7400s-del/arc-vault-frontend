import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { inspect } from "util";

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
});

const USDC_ADDRESS  = "0x3600000000000000000000000000000000000000";
const VAULT_ADDRESS = "0x43b063F897c18558978739d1e5320FF4E6dF58Ec";
const DEPOSIT_AMOUNT_USDC = "1.0";

const ERC20_ABI = [
  { name: "approve", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }] },
  { name: "balanceOf", type: "function", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }] },
];

const VAULT_ABI = [
  { name: "deposit", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { name: "totalAssets", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "shares", type: "function", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }] },
  { name: "getPricePerShare", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint256" }] },
];

const main = async () => {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY が .env に設定されていません");

  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const walletClient = createWalletClient({ chain: arcTestnet, transport: http(), account });
  const amount = parseUnits(DEPOSIT_AMOUNT_USDC, 6);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Phase 2: ArbVault Deposit テスト");
  console.log(`  ウォレット: ${account.address}`);
  console.log(`  Deposit量:  ${DEPOSIT_AMOUNT_USDC} USDC`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const usdcBefore = await publicClient.readContract({
    address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "balanceOf",
    args: [account.address],
  });
  const vaultBefore = await publicClient.readContract({
    address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "totalAssets",
  });
  const sharesBefore = await publicClient.readContract({
    address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "shares",
    args: [account.address],
  });

  console.log("📊 Deposit 前:");
  console.log(`  USDC残高:   ${formatUnits(usdcBefore, 6)} USDC`);
  console.log(`  Vault総資産: ${formatUnits(vaultBefore, 6)} USDC`);
  console.log(`  シェア数:   ${sharesBefore.toString()}\n`);

  if (usdcBefore < amount) {
    console.error("❌ USDC残高不足！https://faucet.circle.com で取得してください");
    process.exit(1);
  }

  console.log("⏳ [1/2] Approve...");
  const approveTx = await walletClient.writeContract({
    address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "approve",
    args: [VAULT_ADDRESS, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveTx });
  console.log(`✅ Approve完了  https://testnet.arcscan.app/tx/${approveTx}\n`);

  console.log("⏳ [2/2] Deposit...");
  const depositTx = await walletClient.writeContract({
    address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "deposit",
    args: [amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: depositTx });
  console.log(`✅ Deposit完了  https://testnet.arcscan.app/tx/${depositTx}\n`);

  const usdcAfter = await publicClient.readContract({
    address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "balanceOf",
    args: [account.address],
  });
  const vaultAfter = await publicClient.readContract({
    address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "totalAssets",
  });
  const sharesAfter = await publicClient.readContract({
    address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "shares",
    args: [account.address],
  });

  console.log("📊 Deposit 後:");
  console.log(`  USDC残高:    ${formatUnits(usdcAfter, 6)} USDC`);
  console.log(`  Vault総資産: ${formatUnits(vaultAfter, 6)} USDC (+${formatUnits(vaultAfter - vaultBefore, 6)})`);
  console.log(`  シェア数:    ${sharesAfter.toString()} (+${(sharesAfter - sharesBefore).toString()})`);
  console.log("\n🎉 Phase 2 成功！");
};

main().catch((err) => {
  console.error("\n❌ エラー:", inspect(err, false, null, true));
  process.exit(1);
});
