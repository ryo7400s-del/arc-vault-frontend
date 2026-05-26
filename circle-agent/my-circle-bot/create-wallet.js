import crypto from "node:crypto";
import fs from "node:fs";
import {
  registerEntitySecretCiphertext,
  initiateDeveloperControlledWalletsClient,
} from "@circle-fin/developer-controlled-wallets";

const apiKey = process.env.CIRCLE_API_KEY;
const entitySecret = crypto.randomBytes(32).toString("hex");

fs.mkdirSync("./output", { recursive: true });

console.log("Entity Secret を登録中...");
await registerEntitySecretCiphertext({
  apiKey,
  entitySecret,
  recoveryFileDownloadPath: "./output",
});
console.log("登録完了！Entity Secret:", entitySecret);

fs.appendFileSync(".env", `\nCIRCLE_ENTITY_SECRET=${entitySecret}\n`);

const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

console.log("Wallet Set を作成中...");
const walletSet = (await client.createWalletSet({ name: "Bot Wallet Set" })).data?.walletSet;
console.log("Wallet Set ID:", walletSet.id);

console.log("ウォレットを作成中...");
const wallet = (await client.createWallets({
  walletSetId: walletSet.id,
  blockchains: ["ARC-TESTNET"],
  count: 1,
  accountType: "EOA",
})).data?.wallets?.[0];

console.log("✅ 完了！");
console.log("Wallet ID:", wallet.id);
console.log("Address:", wallet.address);
fs.writeFileSync("./output/wallet-info.json", JSON.stringify(wallet, null, 2));
