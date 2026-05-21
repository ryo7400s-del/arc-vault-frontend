const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');

const VAULT_ADDRESS = "0x07AD7bDE86371B5c28e0f0532fF52097d0D14162";
const RPC_URL = "https://rpc.testnet.arc.network";
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

// 毎週手動更新（MacroMicro等で確認）
const MINING_COST_LOW  = 61884;  // 電気代のみ → オールバイライン
const MINING_COST_HIGH = 74263;  // 全コスト込み → DCA強化ライン

const abi = JSON.parse(fs.readFileSync('build/contracts_ArcAgentVault_sol_ArcAgentVault.abi'));

async function getFearGreed() {
  const res = await axios.get('https://api.alternative.me/fng/?limit=1');
  const data = res.data.data[0];
  return { value: parseInt(data.value), label: data.value_classification };
}

async function getCurrentPrice() {
  const res = await axios.get('https://fapi.binance.com/fapi/v1/ticker/price?symbol=BTCUSDT');
  return parseFloat(res.data.price);
}

async function main() {
  console.log("🤖 Fear & Greed DCA エージェント起動");
  console.log("📋 戦略:");
  console.log("   オールバイ: 価格 ≤ $" + MINING_COST_LOW.toLocaleString() + "（電気代下限）");
  console.log("   DCA 5%:    価格 ≤ $" + MINING_COST_HIGH.toLocaleString() + " AND F&G ≤ 30");
  console.log("   DCA 2%:    価格 > $" + MINING_COST_HIGH.toLocaleString() + " AND F&G ≤ 30");
  console.log("   利確:      F&G ≥ 75 → 全売却");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const vault = new ethers.Contract(VAULT_ADDRESS, abi, wallet);

  console.log("🔑 エージェント:", wallet.address);

  const run = async () => {
    console.log("\n" + "=".repeat(50));
    console.log("⏰ " + new Date().toLocaleString("ja-JP"));

    try {
      const [fng, currentPrice] = await Promise.all([
        getFearGreed(),
        getCurrentPrice(),
      ]);

      console.log("😱 Fear & Greed: " + fng.value + " (" + fng.label + ")");
      console.log("💰 BTC価格: $" + currentPrice.toFixed(0));
      console.log("⛏️  生産コスト下限: $" + MINING_COST_LOW.toLocaleString());
      console.log("⛏️  生産コスト上限: $" + MINING_COST_HIGH.toLocaleString());

      const stats = await vault.getVaultStats();
      const usdcBal = stats.usdcBalance;
      const btcBal  = stats.btcBalance;
      const isHoldingBTC = stats._isHoldingBTC;

      console.log("🏦 USDC残高: " + ethers.formatUnits(usdcBal, 6));
      console.log("🏦 BTC残高:  " + ethers.formatUnits(btcBal, 8));
      console.log("🏦 BTC保有中: " + isHoldingBTC);

      // ── 優先度1：利確（F&G ≥ 75）──────────────────
      if (fng.value >= 75 && isHoldingBTC && btcBal > 0n) {
        console.log("💰 F&G " + fng.value + " 強欲ゾーン！全売却実行！");
        const tx = await vault.sellBTC();
        await tx.wait();
        console.log("✅ 売却完了:", tx.hash);
        console.log("🔍 https://testnet.arcscan.app/tx/" + tx.hash);

      // ── 優先度2：オールバイ（価格 ≤ 電気代下限）──
      } else if (currentPrice <= MINING_COST_LOW && !isHoldingBTC && usdcBal > 0n) {
        console.log("🚨 価格が電気代下限以下！オールバイ実行！");
        const tx = await vault.buyBTC();
        await tx.wait();
        console.log("✅ オールバイ完了:", tx.hash);
        console.log("🔍 https://testnet.arcscan.app/tx/" + tx.hash);

      // ── 優先度3：DCA強化（価格 ≤ 全コスト AND F&G ≤ 30）──
      } else if (
        currentPrice <= MINING_COST_HIGH &&
        fng.value <= 30 &&
        !isHoldingBTC &&
        usdcBal > 0n
      ) {
        const dcaBal   = usdcBal * 70n / 100n;  // 70%をDCA用
        const buyAmt   = dcaBal * 5n / 100n;     // 5%購入
        console.log("📉 生産コスト圏内 + 恐怖！DCA 5% 実行");
        console.log("   購入額: " + ethers.formatUnits(buyAmt, 6) + " USDC");

        if (buyAmt >= 1_000_000n) {
          const tx = await vault.buyBTC();
          await tx.wait();
          console.log("✅ DCA 5% 完了:", tx.hash);
          console.log("🔍 https://testnet.arcscan.app/tx/" + tx.hash);
        } else {
          console.log("⏸️  残高不足（最低1 USDC必要）");
        }

      // ── 優先度4：DCA通常（F&G ≤ 30）───────────────
      } else if (fng.value <= 30 && !isHoldingBTC && usdcBal > 0n) {
        const dcaBal = usdcBal * 70n / 100n;
        const buyAmt = dcaBal * 2n / 100n;
        console.log("📉 恐怖ゾーン DCA 2% 実行");
        console.log("   購入額: " + ethers.formatUnits(buyAmt, 6) + " USDC");

        if (buyAmt >= 1_000_000n) {
          const tx = await vault.buyBTC();
          await tx.wait();
          console.log("✅ DCA 2% 完了:", tx.hash);
          console.log("🔍 https://testnet.arcscan.app/tx/" + tx.hash);
        } else {
          console.log("⏸️  残高不足（最低1 USDC必要）");
        }

      // ── HOLD ────────────────────────────────────────
      } else {
        let reason = "";
        if (isHoldingBTC)          reason = "BTC保有中 F&G待ち（現在:" + fng.value + "）";
        else if (fng.value > 30)   reason = "中立〜強欲ゾーン（F&G:" + fng.value + "）";
        else                       reason = "条件未達";
        console.log("⏸️  HOLD - " + reason);
      }

    } catch (err) {
      console.error("❌ エラー:", err.message);
    }

    console.log("\n⏳ 次回実行: 24時間後");
    // GitHub Actions: 1回実行して終了;
  };

  await run();
}

main().catch(console.error);
