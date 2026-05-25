import { createWalletClient, createPublicClient, http, parseUnits, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
};

const ADDR = {
  USDC:      "0x3600000000000000000000000000000000000000",
  EURC:      "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  CURVE:     "0x2D84D79C852f6842AbE0304b70bBaA1506AdD457",
  ARB_VAULT: "0x43391ac9632aa7c2a3a1221625e47572f38bb16c",
};

const CURVE_ABI = [
  { name: "get_dy", type: "function", stateMutability: "view",
    inputs: [{ name: "i", type: "int128" },{ name: "j", type: "int128" },{ name: "dx", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }] },
];

const VAULT_ABI = [
  { name: "harvest", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "direction", type: "uint8" },{ name: "amountIn", type: "uint256" },{ name: "minAmountOut", type: "uint256" }],
    outputs: [{ name: "profit", type: "uint256" }] },
  { name: "getVaultInfo", type: "function", stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "_totalAssets", type: "uint256" },
      { name: "_totalShares", type: "uint256" },
      { name: "_totalProfit", type: "uint256" },
      { name: "_totalTrades", type: "uint256" },
      { name: "_pricePerShare", type: "uint256" },
      { name: "_fee", type: "uint256" },
    ] },
  { name: "totalAssets", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint256" }] },
];

const ERC20_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
];

async function askAI(curveRate, usdcInVault) {
  const prompt = `Arbitrage AI on Arc Testnet. Vault has ${usdcInVault} USDC.
Curve EURC/USDC rate: ${curveRate.toFixed(6)}
EUR/USD reference: ~1.0800

If Curve rate differs from 1.08 by more than 0.1%, recommend HARVEST.
Round trip: USDC->EURC->USDC captures the spread minus 2x Curve fee (1% each way).
Only recommend HARVEST if expected profit > 0.

Respond JSON only:
{"action":"HARVEST","direction":0,"amountIn":100,"minAmountOut":99,"expectedProfit":0.05,"reason":"rate above peg"}
or
{"action":"WAIT","reason":"spread insufficient"}`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({ model: "llama-3.3-70b-versatile", max_tokens: 256,
        messages: [{ role: "user", content: prompt }] }),
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "{}";
    return JSON.parse(text.replace(/```json|```/g,"").trim());
  } catch(e) {
    return { action: "WAIT", reason: "AI error: " + e.message };
  }
}

export default async function handler(req, res) {
  if (req.headers["authorization"] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const log = [];
  const l = (msg) => { log.push(`${new Date().toISOString()} ${msg}`); console.log(msg); };

  try {
    const pk = process.env.PRIVATE_KEY?.startsWith("0x")
      ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`;
    const account = privateKeyToAccount(pk);
    l(`Wallet: ${account.address}`);

    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });

    // Vault 情報取得
    const vaultInfo = await publicClient.readContract({
      address: ADDR.ARB_VAULT, abi: VAULT_ABI, functionName: "getVaultInfo",
    });
    const totalAssets = parseFloat(formatUnits(vaultInfo[0], 6));
    const totalProfit = parseFloat(formatUnits(vaultInfo[2], 6));
    const totalTrades = Number(vaultInfo[3]);
    const pricePerShare = parseFloat(formatUnits(vaultInfo[4], 6));
    l(`Vault: assets=${totalAssets.toFixed(2)} USDC profit=${totalProfit.toFixed(4)} trades=${totalTrades} pps=${pricePerShare.toFixed(6)}`);

    if (totalAssets < 1) {
      return res.status(200).json({ status: "WAIT", reason: "vault empty", log });
    }

    // Curve レート取得
    const amtIn = parseUnits("1000", 6);
    const dyR = await publicClient.readContract({
      address: ADDR.CURVE, abi: CURVE_ABI, functionName: "get_dy",
      args: [0n, 1n, amtIn],
    });
    const curveRate = 1000 / parseFloat(formatUnits(dyR, 6));
    l(`Curve rate: ${curveRate.toFixed(6)} USDC/EURC`);

    // AI 判断
    const decision = await askAI(curveRate, totalAssets);
    l(`AI: ${decision.action} - ${decision.reason}`);

    if (decision.action !== "HARVEST") {
      return res.status(200).json({ status: "WAIT", log, reason: decision.reason });
    }

    // harvest 実行
    const amountIn = parseUnits(decision.amountIn.toString(), 6);
    const minOut   = parseUnits(decision.minAmountOut.toString(), 6);
    l(`harvest() direction=${decision.direction} amount=${decision.amountIn} USDC...`);

    const tx = await walletClient.writeContract({
      address: ADDR.ARB_VAULT, abi: VAULT_ABI, functionName: "harvest",
      args: [decision.direction, amountIn, minOut],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    l(`TX: ${tx} status: ${receipt.status}`);
    l(`Explorer: https://testnet.arcscan.app/tx/${tx}`);

    return res.status(200).json({ status: "HARVEST", tx, log });

  } catch(err) {
    l(`ERROR: ${err.message}`);
    return res.status(500).json({ error: err.message, log });
  }
}
