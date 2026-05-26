require("dotenv").config();

const axios = require("axios");

async function main() {
  try {
    console.log("🔍 Entity Secret 登録を開始します...");

    const publicKeyRes = await axios.get(
      "https://api-sandbox.circle.com/v1/w3s/config/entity/publicKey",
      {
        headers: {
          Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
        },
      }
    );

    console.log("✅ API認証成功");
    console.log(publicKeyRes.data);

  } catch (e) {
    console.error(
      "❌ エラー:",
      e.response?.data || e.message
    );
  }
}

main();
