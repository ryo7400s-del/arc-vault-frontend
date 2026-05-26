import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
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
const AMOUNT        = "1.0";

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
];

const main = async () => {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY が .env に設定されていません");

  const account = privateKeyToAccount(privateKey);
  const kit = new AppKit();
  const adapter = createViemAdapterFromPrivateKey({ privateKey });

  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const walletClient = createWalletClient({ chain: arcTestnet, transport: http(), account });
  const amount = parseUnits(AMOUNT, 6);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Phase 3: CCTP ブリッジ → Vault Deposit");
  console.log(`  ウォレット: ${account.address}`);
  console.log(`  金額: ${AMOUNT} USDC`);
  console.log("  Ethereum Sepolia → Arc Testnet → ArbVault");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // ── Step 1: ブリッジ ──────────────────────────────────
  console.log("🌉 [1/3] CCTP ブリッジ開始...\n");

  kit.on("approve", (e) => console.log(`  ✅ Approve  txHash: ${e.values?.txHash ?? "-"}`));
  kit.on("burn",    (e) => console.log(`  🔥 Burn     txHash: ${e.values?.txHash ?? "-"}`));
  kit.on("attest",  ()  => console.log(`  📜 Attestation 取得済み`));
  kit.on("mint",    (e) => console.log(`  🪙 Mint     txHash: ${e.values?.txHash ?? "-"}`));

  await kit.bridge({
    from: { adapter, chain: "Ethereum_Sepolia" },
    to:   { adapter, chain: "Arc_Testnet" },
    amount: AMOUNT,
  });

  console.log("\n✅ ブリッジ完了！\n");

  // ── Step 2: Vault Deposit ────────────────────────────
  console.log("🏦 [2/3] Vault Approve...");
  const approveTx = await walletClient.writeContract({
    address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "approve",
    args: [VAULT_ADDRESS, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveTx });
  console.log(`  ✅ Approve完了  https://testnet.arcscan.app/tx/${approveTx}\n`);

  console.log("🏦 [3/3] Vault Deposit...");
  const depositTx = await walletClient.writeContract({
    address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "deposit",
    args: [amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: depositTx });
  console.log(`  ✅ Deposit完了  https://testnet.arcscan.app/tx/${depositTx}\n`);

  // ── Step 3: 結果確認 ─────────────────────────────────
  const vaultTotal = await publicClient.readContract({
    address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "totalAssets",
  });
  const sharesAfter = await publicClient.readContract({
    address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "shares",
    args: [account.address],
  });

  console.log("📊 最終状態:");
  console.log(`  Vault総資産: ${formatUnits(vaultTotal, 6)} USDC`);
  console.log(`  自分のシェア: ${sharesAfter.toString()}`);
  console.log("\n🎉 Phase 3 完了！ブリッジ → Deposit が自動連結されました");
};

main().catch((err) => {
  console.error("\n❌ エラー:", inspect(err, false, null, true));
  process.exit(1);
});
