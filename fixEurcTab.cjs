const fs = require("fs");
let code = fs.readFileSync("pages/vault.jsx", "utf8");

const eurcUI = `
            {tab === "eurc" && (
              <div className="space-y-3">
                <div className="text-gray-600 text-[11px]">EURCを預けます。自動でUSDCに変換されます。</div>
                <div className="text-gray-700 text-[10px]">ウォレット EURC残高: {eurcWalletBal != null ? eurcWalletBal.toFixed(2) : "—"}</div>
                <div className="flex gap-2">
                  <input type="number" value={eurcAmount} onChange={e => setEurcAmount(e.target.value)}
                    placeholder="預ける EURC 量"
                    className="flex-1 bg-gray-950 border border-gray-800 rounded px-3 py-2 text-gray-300 text-xs focus:outline-none focus:border-yellow-700"/>
                  <button onClick={() => setEurcAmount(eurcWalletBal != null ? eurcWalletBal.toFixed(2) : "0")}
                    className="px-3 py-2 bg-gray-800 text-gray-400 rounded text-xs hover:bg-gray-700">MAX</button>
                </div>
                <button onClick={handleDepositEURC} disabled={loading || !eurcAmount || !isConnected}
                  className="w-full py-3 bg-yellow-950 hover:bg-yellow-900 border border-yellow-800 text-yellow-400 rounded text-xs font-bold tracking-widest disabled:opacity-40 transition-colors">
                  {loading ? "処理中..." : "⬇ EURC を預ける"}
                </button>
              </div>
            )}
`;

// withdraw タブの前に挿入
code = code.replace(
  `            {tab === "withdraw" ? (`,
  eurcUI + `            {tab === "withdraw" ? (`
);

fs.writeFileSync("pages/vault.jsx", code);
console.log("done");
