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
  ARB_VAULT: "0x43b063f897c18558978739d1e5320ff4e6df58ec",
};

const CURVE_ABI = [
  { name: "get_dy", type: "function", stateMutability: "view",
    inputs: [{ name: "i", type: "int128" },{ name: "j", type: "int128" },{ name: "dx", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }] },
];

const VAULT_ABI = [
  { name: "harvest", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "direction", type: "uint8" },{ name: "amountIn", type: "uint256" },{ name: "minAmountOut", type: "uint256" }],
    outputs: [{ name: "amountOut", type: "uint256" }] },
  { name: "getVaultInfo", type: "function", stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "_totalAssets",   type: "uint256" },
      { name: "_totalShares",   type: "uint256" },
      { name: "_totalProfit",   type: "uint256" },
      { name: "_totalTrades",   type: "uint256" },
      { name: "_pricePerShare", type: "uint256" },
      { name: "_fee",           type: "uint256" },
    ] },
  { name: "getEURCBalance", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint256" }] },
];

// Synthra Pool slot0 からEURC/USDCレートを取得
async function getEurUsdRate() {
  try {
    const res = await fetch("https://rpc.testnet.arc.network", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "eth_call",
        params: [{ to: "0xc4abb91884094972fc6634c0d91bb9f9332277f1", data: "0x3850c7bd" }, "latest"]
      })
    });
    const data = await res.json();
    const sqrtPriceX96 = BigInt("0x" + data.result.slice(2, 66));
    const Q96 = BigInt(2) ** BigInt(96);
    const price = Number(sqrtPriceX96 * sqrtPriceX96) / Number(Q96 * Q96);
    const usdcPerEurc = 1 / price;
    if (!usdcPerEurc || usdcPerEurc < 0.5 || usdcPerEurc > 2) throw new Error("invalid rate");
    return usdcPerEurc;
  } catch(e) {
    return 1.0800;
  }
}

async function askAI({ curveRate, eurUsdRate, usdcInVault, eurcInVault, spread, spreadPct }) {
  const prompt = `Arbitrage AI on Arc Testnet (Curve DEX only). Gas paid in USDC.

Vault balances:
  USDC: ${usdcInVault} USDC
  EURC: ${eurcInVault} EURC

Curve pool rate:   ${curveRate.toFixed(6)} USDC per EURC
EUR/USD real rate: ${eurUsdRate.toFixed(6)} (from CoinGecko)
Spread:            ${spreadPct.toFixed(4)}%

Decision rules:
1. If EURC in vault > 5: ALWAYS sell EURC->USDC (direction=1), use 90% of EURC
2. If spread > 0.5% and curveRate < eurUsdRate: buy EURC (direction=0), use 25% of USDC (EURC underpriced on Curve)
3. If spread > 0.5% and curveRate > eurUsdRate: sell EURC (direction=1) if eurcInVault > 0
4. If spread < 0.3%: WAIT (not profitable after fees)

Respond JSON only, no explanation outside JSON:
{"action":"HARVEST","direction":0,"amountIn":12,"reason":"EURC underpriced 0.8%"}
or
{"action":"WAIT","reason":"spread too small"}`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: 128,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "{}";
    const match = text.match(/{[^}]+}/);
    return match ? JSON.parse(match[0]) : { action: "WAIT", reason: "no JSON found" };
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

    // Vault情報 + EUR/USDレート を並列取得
    const [vaultInfo, eurcRaw, eurUsdRate] = await Promise.all([
      publicClient.readContract({ address: ADDR.ARB_VAULT, abi: VAULT_ABI, functionName: "getVaultInfo" }),
      publicClient.readContract({ address: ADDR.ARB_VAULT, abi: VAULT_ABI, functionName: "getEURCBalance" }),
      getEurUsdRate(),
    ]);

    const totalAssets = parseFloat(formatUnits(vaultInfo[0], 6));
    const totalProfit = parseFloat(formatUnits(vaultInfo[2], 6));
    const totalTrades = Number(vaultInfo[3]);
    const eurcInVault = parseFloat(formatUnits(eurcRaw, 6));

    l(`Vault: USDC=${totalAssets.toFixed(2)} EURC=${eurcInVault.toFixed(2)} profit=${totalProfit.toFixed(4)} trades=${totalTrades}`);
    l(`EUR/USD (CoinGecko): ${eurUsdRate.toFixed(6)}`);

    // Curveレート取得 (1000 USDC → EURC)
    const amtIn = parseUnits("1000", 6);
    const dyR = await publicClient.readContract({
      address: ADDR.CURVE, abi: CURVE_ABI, functionName: "get_dy",
      args: [0n, 1n, amtIn],
    });
    const curveRate = 1000 / parseFloat(formatUnits(dyR, 6));
    const spread    = curveRate - eurUsdRate;
    const spreadPct = Math.abs(spread) / eurUsdRate * 100;

    l(`Curve: ${curveRate.toFixed(6)} USDC/EURC | EUR/USD: ${eurUsdRate.toFixed(6)} | spread: ${spread.toFixed(6)} (${spreadPct.toFixed(4)}%)`);

    // EURC残りがあれば強制売却
    if (eurcInVault > 5) {
      const sellAmount = Math.floor(eurcInVault * 0.90);
      const sellRaw    = parseUnits(sellAmount.toString(), 6);
      const minOut     = parseUnits(Math.floor(sellAmount * curveRate * 0.97).toString(), 6);
      l(`EURC残高 ${eurcInVault.toFixed(2)} → 強制売却 amount=${sellAmount}`);

      const tx = await walletClient.writeContract({
        address: ADDR.ARB_VAULT, abi: VAULT_ABI, functionName: "harvest",
        args: [1, sellRaw, minOut],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      l(`TX: ${tx} status: ${receipt.status}`);
      l(`Explorer: https://testnet.arcscan.app/tx/${tx}`);
      return res.status(200).json({ status: "HARVEST", direction: 1, tx, log });
    }

    // スプレッドで直接判断（AIより確実）
    if (spreadPct > 0.3 && curveRate < eurUsdRate && totalAssets >= 1) {
      const useAmount = Math.floor(totalAssets * 0.25);
      const amountIn = parseUnits(useAmount.toString(), 6);
      const minOut   = parseUnits(Math.floor(useAmount * 0.95).toString(), 6);
      l(`HARVEST: EURC割安 spread=${spreadPct.toFixed(4)}% direction=0 amount=${useAmount}`);
      const tx = await walletClient.writeContract({
        address: ADDR.ARB_VAULT, abi: VAULT_ABI, functionName: "harvest",
        args: [0, amountIn, minOut],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      l(`TX: ${tx} status: ${receipt.status}`);
      l(`Explorer: https://testnet.arcscan.app/tx/${tx}`);
      return res.status(200).json({ status: "HARVEST", direction: 0, tx, log });
    }

    // AI判断
    const decision = await askAI({
      curveRate, eurUsdRate,
      usdcInVault: totalAssets.toFixed(2),
      eurcInVault: eurcInVault.toFixed(2),
      spread, spreadPct,
    });
    l(`AI: ${decision.action} - ${decision.reason}`);

    if (decision.action !== "HARVEST" || totalAssets < 1) {
      return res.status(200).json({ status: "WAIT", log, reason: decision.reason });
    }

    const amountIn = parseUnits(Math.floor(decision.amountIn).toString(), 6);
    const minOut   = parseUnits(Math.floor(decision.amountIn * 0.95).toString(), 6);
    l(`executeArbitrage() direction=${decision.direction} amount=${decision.amountIn}...`);

    const tx = await walletClient.writeContract({
      address: ADDR.ARB_VAULT, abi: VAULT_ABI, functionName: "harvest",
      args: [decision.direction, amountIn, minOut],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    l(`TX: ${tx} status: ${receipt.status}`);
    l(`Explorer: https://testnet.arcscan.app/tx/${tx}`);

    return res.status(200).json({ status: "HARVEST", direction: decision.direction, tx, log });

  } catch(err) {
    l(`ERROR: ${err.message}`);
    return res.status(500).json({ error: err.message, log });
  }
}
