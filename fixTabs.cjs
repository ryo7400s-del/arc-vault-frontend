const fs = require("fs");
let code = fs.readFileSync("pages/vault.jsx", "utf8");

const oldTabs = `            {tab === "deposit" ? (
              <div className="space-y-3">
                <div className="text-gray-600 text-[11px]">USDCを預けてアービトラージ利益を自動で受け取れます。</div>
                <div className="flex gap-2">
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                    placeholder="預ける USDC 量"
                    className="flex-1 bg-gray-950 border border-gray-800 rounded px-3 py-2 text-gray-300 text-xs focus:outline-none focus:border-green-700"/>
                  <button onClick={() => setAmount(usdcBal?.toFixed(2)??"0")}
                    className="px-3 py-2 bg-gray-800 text-gray-400 rounded text-xs hover:bg-gray-700">MAX</button>
                </div>
                <button onClick={handleDeposit} disabled={loading || !amount || !isConnected}
                  className="w-full py-3 bg-green-950 hover:bg-green-900 border border-green-800 text-green-400 rounded text-xs font-bold tracking-widest disabled:opacity-40 transition-colors">
                  {loading ? "処理中..." : "⬇ 預ける (Deposit)"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-gray-600 text-[11px]">元本＋利益を全額引き出します。</div>
                <div className="bg-gray-950 border border-gray-800 rounded p-3">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-600">引き出し予定額</span>
                    <span className="text-green-400 font-bold">{userValue?.toFixed(4) ?? "—"} USDC</span>
                  </div>
                </div>
                <button onClick={handleWithdrawAll} disabled={loading || !isConnected || (userValue??0) <= 0}
                  className="w-full py-3 bg-red-950 hover:bg-red-900 border border-red-800 text-red-400 rounded text-xs font-bold tracking-widest disabled:opacity-40 transition-colors">
                  {loading ? "処理中..." : "⬆ 全額引き出す (Withdraw All)"}
                </button>
              </div>
            )}`;

const newTabs = `            {tab === "deposit" && (
              <div className="space-y-3">
                <div className="text-gray-600 text-[11px]">USDCを預けてアービトラージ利益を自動で受け取れます。</div>
                <div className="flex gap-2">
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                    placeholder="預ける USDC 量"
                    className="flex-1 bg-gray-950 border border-gray-800 rounded px-3 py-2 text-gray-300 text-xs focus:outline-none focus:border-green-700"/>
                  <button onClick={() => setAmount(usdcBal?.toFixed(2)??"0")}
                    className="px-3 py-2 bg-gray-800 text-gray-400 rounded text-xs hover:bg-gray-700">MAX</button>
                </div>
                <button onClick={handleDeposit} disabled={loading || !amount || !isConnected}
                  className="w-full py-3 bg-green-950 hover:bg-green-900 border border-green-800 text-green-400 rounded text-xs font-bold tracking-widest disabled:opacity-40 transition-colors">
                  {loading ? "処理中..." : "⬇ 預ける (Deposit)"}
                </button>
              </div>
            )}
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
            {tab === "withdraw" && (
              <div className="space-y-3">
                <div className="text-gray-600 text-[11px]">元本＋利益を全額引き出します。</div>
                <div className="bg-gray-950 border border-gray-800 rounded p-3">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-600">引き出し予定額</span>
                    <span className="text-green-400 font-bold">{userValue?.toFixed(4) ?? "—"} USDC</span>
                  </div>
                </div>
                <button onClick={handleWithdrawAll} disabled={loading || !isConnected || (userValue??0) <= 0}
                  className="w-full py-3 bg-red-950 hover:bg-red-900 border border-red-800 text-red-400 rounded text-xs font-bold tracking-widest disabled:opacity-40 transition-colors">
                  {loading ? "処理中..." : "⬆ 全額引き出す (Withdraw All)"}
                </button>
              </div>
            )}`;

if (code.includes(oldTabs)) {
  code = code.replace(oldTabs, newTabs);
  fs.writeFileSync("pages/vault.jsx", code);
  console.log("done");
} else {
  console.log("not found");
}
