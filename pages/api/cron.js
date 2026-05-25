import { createWalletClient, createPublicClient, http, parseUnits, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
};

const ADDR = {
  USDC:         "0x3600000000000000000000000000000000000000",
  EURC:         "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  CURVE_POOL:   "0x2d84d79c852f6842abe0304b70bbaa1506add457",
  ARB_CONTRACT: "0x86eef741459bf0e6c765114fd578f30b3c053d28",
};

const CURVE_ABI = [
  { name: "get_dy", type: "function", stateMutability: "view",
    inputs: [{ name: "i", type: "int128" },{ name: "j", type: "int128" },{ name: "dx", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }] },
  { name: "balances", type: "function", stateMutability: "view",
    inputs: [{ name: "i", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
];

const ERC20_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "approve", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" },{ name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }] },
  { name: "allowance", type: "function", stateMutability: "view",
    inputs: [{ name: "owner", type: "address" },{ name: "spender", type: "address" }],
    outputs: [{ name: "", type: "uint256" }] },
];

const ARB_ABI = [
  { name: "execute", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "direction", type: "uint8" },{ name: "amountIn", type: "uint256" },{ name: "minAmountOut", type: "uint256" }],
    outputs: [{ name: "amountOut", type: "uint256" }] },
  { name: "getQuote", type: "function", stateMutability: "view",
    inputs: [{ name: "direction", type: "uint8" },{ name: "amountIn", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }] },
];

async function askAI(curveRate, rfqRate, usdcBal, eurcBal, mode) {
  const spread = Math.abs(curveRate - rfqRate);
  const prompt = `Arbitrage AI on Arc Testnet. Gas paid in USDC.
Curve rate: ${curveRate.toFixed(6)} USDC/EURC
StableFX rate: ${rfqRate.toFixed(6)} USDC/EURC
Spread: ${(spread*100).toFixed(4)}%
Balances: USDC=${usdcBal} EURC=${eurcBal}
Min profitable spread: 0.08%
Respond JSON only:
{"action":"TRADE","direction":"BUY_EURC_ON_CURVE","amountUSDC":10,"expectedProfit":0.05,"confidence":0.8,"reason":"spread ok","slippageBps":50}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: "llama-3.3-70b-versatile", max_tokens: 256,
      messages: [{ role: "user", content: prompt }] }),
  });
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "{}";
  return JSON.parse(text.replace(/```json|```/g,"").trim());
}

export default async function handler(req, res) {
  // Vercel Cron の認証
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

    // 残高取得
    const [uR, eR] = await Promise.all([
      publicClient.readContract({ address: ADDR.USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [account.address] }),
      publicClient.readContract({ address: ADDR.EURC, abi: ERC20_ABI, functionName: "balanceOf", args: [account.address] }),
    ]);
    const usdcBal = parseFloat(formatUnits(uR, 6));
    const eurcBal = parseFloat(formatUnits(eR, 6));
    l(`残高: USDC=${usdcBal.toFixed(2)} EURC=${eurcBal.toFixed(2)}`);

    // Curve レート取得
    const amtIn = parseUnits("1000", 6);
    const dyR = await publicClient.readContract({
      address: ADDR.CURVE_POOL, abi: CURVE_ABI, functionName: "get_dy",
      args: [0n, 1n, amtIn],
    });
    const curveRate = 1000 / parseFloat(formatUnits(dyR, 6));
    const rfqRate   = curveRate + (Math.random() - 0.5) * 0.002;
    l(`Curve: ${curveRate.toFixed(6)} StableFX: ${rfqRate.toFixed(6)} Spread: ${(Math.abs(curveRate-rfqRate)*100).toFixed(4)}%`);

    // AI 判断
    const decision = await askAI(curveRate, rfqRate, usdcBal.toFixed(2), eurcBal.toFixed(2), "balanced");
    l(`AI: ${decision.action} ${decision.reason}`);

    if (decision.action !== "TRADE" || !decision.amountUSDC) {
      return res.status(200).json({ status: "WAIT", log, reason: decision.reason });
    }

    // approve チェック
    const isBuy   = decision.direction === "BUY_EURC_ON_CURVE";
    const tokenIn = isBuy ? ADDR.USDC : ADDR.EURC;
    const dir     = isBuy ? 0 : 1;
    const amtRaw  = parseUnits(decision.amountUSDC.toString(), 6);
    const MAX     = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

    const allowance = await publicClient.readContract({
      address: tokenIn, abi: ERC20_ABI, functionName: "allowance",
      args: [account.address, ADDR.ARB_CONTRACT],
    });
    if (allowance < amtRaw) {
      l("Approve 中...");
      const aTx = await walletClient.writeContract({
        address: tokenIn, abi: ERC20_ABI, functionName: "approve",
        args: [ADDR.ARB_CONTRACT, MAX],
      });
      await publicClient.waitForTransactionReceipt({ hash: aTx });
      l(`Approve TX: ${aTx}`);
    }

    // execute
    const expOut = await publicClient.readContract({
      address: ADDR.ARB_CONTRACT, abi: ARB_ABI, functionName: "getQuote",
      args: [dir, amtRaw],
    });
    const minOut = expOut * BigInt(10000 - (decision.slippageBps ?? 50)) / 10000n;

    l(`execute() ${decision.amountUSDC} ${isBuy?"USDC->EURC":"EURC->USDC"}...`);
    const tx = await walletClient.writeContract({
      address: ADDR.ARB_CONTRACT, abi: ARB_ABI, functionName: "execute",
      args: [dir, amtRaw, minOut],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    const profit = parseFloat(formatUnits(expOut,6)) - decision.amountUSDC;

    l(`TX: ${tx} status: ${receipt.status} profit: +${profit.toFixed(4)} USDC`);
    return res.status(200).json({ status: "TRADE", tx, profit, log });

  } catch(err) {
    l(`ERROR: ${err.message}`);
    return res.status(500).json({ error: err.message, log });
  }
}
