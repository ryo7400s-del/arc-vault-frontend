const { ethers } = require('ethers');
const Groq = require('groq-sdk');
const axios = require('axios');
const fs = require('fs');

const VAULT_ADDRESS = "0x07AD7bDE86371B5c28e0f0532fF52097d0D14162";
const RPC_URL = "https://rpc.testnet.arc.network";
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

const abi = JSON.parse(fs.readFileSync('build/contracts_ArcAgentVault_sol_ArcAgentVault.abi'));
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function getCurrentPrice() {
  const res = await axios.get('https://fapi.binance.com/fapi/v1/ticker/price?symbol=BTCUSDT');
  return parseFloat(res.data.price);
}

async function getDailyPrices() {
  const res = await axios.get(
    'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=90&interval=daily'
  );
  return res.data.prices.map(p => p[1]);
}

async function getTaker1h() {
  const res = await axios.get(
    'https://fapi.binance.com/futures/data/takerlongshortRatio?symbol=BTCUSDT&period=1h&limit=1'
  );
  return res.data[0];
}

function calcRSI(prices, period = 14) {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const rs = gains / (losses || 1);
  return 100 - 100 / (1 + rs);
}

function makeDecision(buyVol, sellVol, dailyRSI) {
  const ratio = buyVol / (sellVol || 1);
  console.log("📊 1時間テイカー:");
  console.log("   買いVol: " + buyVol.toFixed(0) + " BTC");
  console.log("   売りVol: " + sellVol.toFixed(0) + " BTC");
  console.log("   買い/売り比率: " + ratio.toFixed(2) + "倍");

  if (ratio >= 2.0 && dailyRSI <= 50) {
    return { action: "BUY", reason: "買いTaker" + ratio.toFixed(1) + "倍 RSI" + dailyRSI.toFixed(0), confidence: 80 };
  }
  if (dailyRSI >= 72) {
    return { action: "SELL", reason: "日足RSI" + dailyRSI.toFixed(0) + " 利確", confidence: 85 };
  }
  return { action: "HOLD", reason: "条件未達(Taker:" + ratio.toFixed(2) + " RSI:" + dailyRSI.toFixed(0) + ")", confidence: 60 };
}

async function main() {
  console.log("🤖 X402AeroVault AIエージェント起動");
  console.log("🏦 Vault:", VAULT_ADDRESS);
  console.log("📋 買い: 1h買いTaker≥2倍 AND 日足RSI≤50");
  console.log("📋 売り: 日足RSI≥72（利確）");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const vault = new ethers.Contract(VAULT_ADDRESS, abi, wallet);

  console.log("🔑 エージェントアドレス:", wallet.address);

  const run = async () => {
    console.log("\n" + "=".repeat(50));
    console.log("⏰ " + new Date().toLocaleString("ja-JP"));

    try {
      const [currentPrice, dailyPrices, taker] = await Promise.all([
        getCurrentPrice(),
        getDailyPrices(),
        getTaker1h(),
      ]);

      const dailyRSI = calcRSI(dailyPrices, 14);
      const buyVol = parseFloat(taker.buyVol);
      const sellVol = parseFloat(taker.sellVol);

      console.log("💰 BTC価格: $" + currentPrice.toFixed(2));
      console.log("📊 日足RSI: " + dailyRSI.toFixed(1));

      const stats = await vault.getVaultStats();
      console.log("🏦 USDC残高: " + ethers.formatUnits(stats.usdcBalance, 6));
      console.log("🏦 BTC残高: " + ethers.formatUnits(stats.btcBalance, 8));
      console.log("🏦 BTC保有中: " + stats._isHoldingBTC);
      console.log("🏦 総取引数: " + stats._totalTrades.toString());

      const decision = makeDecision(buyVol, sellVol, dailyRSI);
      console.log("🎯 判断: " + decision.action + " (" + decision.confidence + "%) - " + decision.reason);

      if (decision.action === "BUY" && !stats._isHoldingBTC && stats.usdcBalance > 0n) {
        console.log("🔄 buyBTC実行中...");
        const tx = await vault.buyBTC();
        await tx.wait();
        console.log("✅ TX:", tx.hash);
        console.log("🔍 https://testnet.arcscan.app/tx/" + tx.hash);

      } else if (decision.action === "SELL" && stats._isHoldingBTC && stats.btcBalance > 0n) {
        console.log("🔄 sellBTC実行中...");
        const tx = await vault.sellBTC();
        await tx.wait();
        console.log("✅ TX:", tx.hash);
        console.log("🔍 https://testnet.arcscan.app/tx/" + tx.hash);

      } else {
        if (decision.action === "BUY" && stats._isHoldingBTC) console.log("⏸️  BUYシグナルだが既にBTC保有中");
        if (decision.action === "SELL" && !stats._isHoldingBTC) console.log("⏸️  SELLシグナルだがUSDC保有中");
        if (decision.action === "HOLD") console.log("⏸️  HOLD");
      }

    } catch (err) {
      console.error("❌ エラー:", err.message);
    }

    console.log("\n⏳ 次回実行: 4時間後");
    setTimeout(run, 4 * 60 * 60 * 1000);
  };

  await run();
}

main().catch(console.error);
