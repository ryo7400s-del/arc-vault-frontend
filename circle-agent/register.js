// register.js - 最新改善版
const { registerEntitySecretCiphertext } = require('@circle-fin/developer-controlled-wallets');
const dotenv = require('dotenv');
dotenv.config();

async function register() {
  console.log("🔍 Entity Secret 登録を開始します...");

  if (!process.env.CIRCLE_API_KEY) {
    console.error("❌ CIRCLE_API_KEY が .env に見つかりません");
    return;
  }
  if (!process.env.CIRCLE_ENTITY_SECRET) {
    console.error("❌ CIRCLE_ENTITY_SECRET が .env に見つかりません");
    return;
  }

  console.log("✅ API Key と Entity Secret を読み込みました");

  try {
    const response = await registerEntitySecretCiphertext({
      apiKey: process.env.CIRCLE_API_KEY,
      entitySecret: process.env.CIRCLE_ENTITY_SECRET,
      recoveryFileDownloadPath: "./",   // recoveryファイルをここに保存
    });

    console.log("🎉 ✅ Entity Secret 登録成功！");
    console.log("Recovery File:", response.data?.recoveryFile || "保存されました");
    
  } catch (error) {
    console.error("❌ エラー:", error.message);
    
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("詳細:", JSON.stringify(error.response.data, null, 2));
    }
  }
}

register();
