const fs = require("fs");
let code = fs.readFileSync("pages/vault.jsx", "utf8");

// handleDepositEURC 関数を handleWithdrawAll の後に追加
const newFunc = `
  const handleDepositEURC = async () => {
    if (!walletClient || !eurcAmount) return;
    setLoading(true);
    setStatus(null);
    try {
      const amtRaw = parseUnits(eurcAmount, 6);
      const MAX = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
      const allowance = await publicClient.readContract({
        address: ADDR.EURC, abi: ERC20_ABI, functionName: "allowance",
        args: [address, ADDR.ARB_VAULT],
      });
      if (allowance < amtRaw) {
        log("EURC Approve 中...", "info");
        const aTx = await walletClient.writeContract({
          address: ADDR.EURC, abi: ERC20_ABI, functionName: "approve",
          args: [ADDR.ARB_VAULT, MAX],
        });
        await publicClient.waitForTransactionReceipt({ hash: aTx });
        log("Approve 完了", "ok");
      }
      const minUSDC = amtRaw * 95n / 100n;
      log(\`\${eurcAmount} EURC を USDC に変換して預け入れ中...\`, "info");
      const tx = await walletClient.writeContract({
        address: ADDR.ARB_VAULT, abi: VAULT_ABI, functionName: "depositEURC",
        args: [amtRaw, minUSDC],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      if (receipt.status === "success") {
        log(\`✓ \${eurcAmount} EURC を預けました (USDC に変換済み)\`, "ok");
        setStatus({ ok: true, msg: \`\${eurcAmount} EURC を USDC に変換して預けました\` });
        setEurcAmount("");
        await fetchData();
      }
    } catch(e) {
      log("エラー: " + (e.shortMessage||e.message).slice(0,80), "err");
      setStatus({ ok: false, msg: e.shortMessage||e.message });
    }
    setLoading(false);
  };
`;

code = code.replace(
  "  const handleWithdrawAll = async () => {",
  newFunc + "\n  const handleWithdrawAll = async () => {"
);

// eurcAmount state を追加
code = code.replace(
  "  const [logs,       setLogs]      = useState([]);",
  `  const [logs,       setLogs]      = useState([]);
  const [eurcAmount, setEurcAmount] = useState("");
  const [eurcWalletBal, setEurcWalletBal] = useState(null);`
);

// fetchData に EURC ウォレット残高を追加
code = code.replace(
  "      const [uR, uv, vi, er] = await Promise.all([",
  `      const [uR, uv, vi, er, ewR] = await Promise.all([`
);
code = code.replace(
  "        publicClient.readContract({ address: ADDR.ARB_VAULT, abi: VAULT_ABI, functionName: \"getEURCBalance\" }),",
  `        publicClient.readContract({ address: ADDR.ARB_VAULT, abi: VAULT_ABI, functionName: "getEURCBalance" }),
        publicClient.readContract({ address: ADDR.EURC, abi: ERC20_ABI, functionName: "balanceOf", args: [address] }),`
);
code = code.replace(
  "      setEurcBal(parseFloat(formatUnits(er, 6)));",
  `      setEurcBal(parseFloat(formatUnits(er, 6)));
      setEurcWalletBal(parseFloat(formatUnits(ewR, 6)));`
);

// タブに eurc を追加
code = code.replace(
  `{[["deposit","預ける"],["withdraw","引き出す"]].map(([t,label]) => (`,
  `{[["deposit","預ける(USDC)"],["eurc","預ける(EURC)"],["withdraw","引き出す"]].map(([t,label]) => (`
);

// EURC タブのUI を withdraw の前に追加
const eurcUI = `
            {tab === "eurc" && (
              <div className="space-y-3">
                <div className="text-gray-600 text-[11px]">EURCを預けます。自動でUSDCに変換されます。</div>
                <div className="text-gray-700 text-[10px]">ウォレット EURC残高: {eurcWalletBal?.toFixed(2) ?? "—"}</div>
                <div className="flex gap-2">
                  <input type="number" value={eurcAmount} onChange={e => setEurcAmount(e.target.value)}
                    placeholder="預ける EURC 量"
                    className="flex-1 bg-gray-950 border border-gray-800 rounded px-3 py-2 text-gray-300 text-xs focus:outline-none focus:border-yellow-700"/>
                  <button onClick={() => setEurcAmount(eurcWalletBal?.toFixed(2)??"0")}
                    className="px-3 py-2 bg-gray-800 text-gray-400 rounded text-xs hover:bg-gray-700">MAX</button>
                </div>
                <button onClick={handleDepositEURC} disabled={loading || !eurcAmount || !isConnected}
                  className="w-full py-3 bg-yellow-950 hover:bg-yellow-900 border border-yellow-800 text-yellow-400 rounded text-xs font-bold tracking-widest disabled:opacity-40 transition-colors">
                  {loading ? "処理中..." : "⬇ EURC を預ける"}
                </button>
              </div>
            )}
`;

code = code.replace(
  `            {tab === "withdraw" ? (`,
  eurcUI + `            {tab === "withdraw" ? (`
);

fs.writeFileSync("pages/vault.jsx", code);
console.log("done");
