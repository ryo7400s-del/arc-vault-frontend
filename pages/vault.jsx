import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { parseUnits, formatUnits } from "viem";

const ARC_CHAIN_ID = 5042002;
const SEPOLIA_CHAIN_ID = 11155111;

const ADDR = {
  USDC:      "0x3600000000000000000000000000000000000000",
  EURC:      "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  ARB_VAULT: "0x43b063f897c18558978739d1e5320ff4e6df58ec",
};

const ERC20_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "approve", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }] },
  { name: "allowance", type: "function", stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ name: "", type: "uint256" }] },
];

const VAULT_ABI = [
  { name: "deposit", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { name: "withdrawAll", type: "function", stateMutability: "nonpayable",
    inputs: [], outputs: [] },
  { name: "getUserValue", type: "function", stateMutability: "view",
    inputs: [{ name: "user", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "shares", type: "function", stateMutability: "view",
    inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
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
  { name: "depositEURC", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "eurcAmount", type: "uint256" }, { name: "minUSDC", type: "uint256" }],
    outputs: [] },
];

function validateAmount(value, balance, label) {
  const n = parseFloat(value);
  if (isNaN(n) || n <= 0) return `${label}の量を入力してください`;
  if (balance !== null && n > balance) return `残高不足 (残高: ${balance.toFixed(2)})`;
  if (n < 0.000001) return "最小量は 0.000001 です";
  return null;
}

export default function VaultPage() {
  const { address, isConnected, chain } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [tab,           setTab]          = useState("deposit");
  const [amount,        setAmount]       = useState("");
  const [usdcBal,       setUsdcBal]      = useState(null);
  const [userValue,     setUserValue]    = useState(null);
  const [vaultInfo,     setVaultInfo]    = useState(null);
  const [eurcBal,       setEurcBal]      = useState(null);
  const [loading,       setLoading]      = useState(false);
  const [status,        setStatus]       = useState(null);
  const [logs,          setLogs]         = useState([]);
  const [eurcAmount,    setEurcAmount]   = useState("");
  const [eurcWalletBal, setEurcWalletBal]= useState(null);
  const [cctpAmount,    setCctpAmount]   = useState("");
  const [cctpLoading,   setCctpLoading]  = useState(false);
  const [cctpStep,      setCctpStep]     = useState(null);
  const [inputError,    setInputError]   = useState(null);

  const onArcChain = isConnected && chain?.id === ARC_CHAIN_ID;
  const wrongChain = isConnected && chain?.id !== ARC_CHAIN_ID;
  const onSepolia  = isConnected && chain?.id === SEPOLIA_CHAIN_ID;

  const log = useCallback((msg, type = "info") => {
    const ts = new Date().toLocaleTimeString("ja-JP");
    setLogs(l => [...l.slice(-30), { ts, msg, type }]);
  }, []);

  const fetchData = useCallback(async () => {
    if (!publicClient || !address) return;
    try {
      const [uR, uv, vi, er, ewR] = await Promise.all([
        publicClient.readContract({ address: ADDR.USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [address] }),
        publicClient.readContract({ address: ADDR.ARB_VAULT, abi: VAULT_ABI, functionName: "getUserValue", args: [address] }),
        publicClient.readContract({ address: ADDR.ARB_VAULT, abi: VAULT_ABI, functionName: "getVaultInfo" }),
        publicClient.readContract({ address: ADDR.ARB_VAULT, abi: VAULT_ABI, functionName: "getEURCBalance" }),
        publicClient.readContract({ address: ADDR.EURC, abi: ERC20_ABI, functionName: "balanceOf", args: [address] }),
      ]);
      setUsdcBal(parseFloat(formatUnits(uR, 6)));
      setUserValue(parseFloat(formatUnits(uv, 6)));
      setEurcBal(parseFloat(formatUnits(er, 6)));
      setEurcWalletBal(parseFloat(formatUnits(ewR, 6)));
      setVaultInfo({
        totalAssets:   parseFloat(formatUnits(vi[0], 6)),
        totalShares:   parseFloat(formatUnits(vi[1], 6)),
        totalProfit:   parseFloat(formatUnits(vi[2], 6)),
        totalTrades:   Number(vi[3]),
        pricePerShare: parseFloat(formatUnits(vi[4], 6)),
        fee:           Number(vi[5]) / 100,
      });
    } catch(e) {
      log("データ取得エラー: " + e.message.slice(0, 60), "err");
    }
  }, [publicClient, address, log]);

  useEffect(() => {
    if (onArcChain) fetchData();
  }, [onArcChain, fetchData]);

  const handleDeposit = async () => {
    const err = validateAmount(amount, usdcBal, "USDC");
    if (err) { setInputError(err); return; }
    if (!walletClient || !onArcChain) return;
    setInputError(null); setLoading(true); setStatus(null);
    try {
      const amtRaw = parseUnits(amount, 6);
      const allowance = await publicClient.readContract({
        address: ADDR.USDC, abi: ERC20_ABI, functionName: "allowance",
        args: [address, ADDR.ARB_VAULT],
      });
      if (allowance < amtRaw) {
        log("USDC Approve 中...", "info");
        const aTx = await walletClient.writeContract({
          address: ADDR.USDC, abi: ERC20_ABI, functionName: "approve",
          args: [ADDR.ARB_VAULT, amtRaw],
        });
        await publicClient.waitForTransactionReceipt({ hash: aTx });
        log("Approve 完了", "ok");
      }
      log(`${amount} USDC 預け入れ中...`, "info");
      const tx = await walletClient.writeContract({
        address: ADDR.ARB_VAULT, abi: VAULT_ABI, functionName: "deposit",
        args: [amtRaw],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      if (receipt.status === "success") {
        log(`✓ ${amount} USDC 預け入れ完了`, "ok");
        setStatus({ ok: true, msg: `${amount} USDC を預けました` });
        setAmount(""); await fetchData();
      } else {
        throw new Error("トランザクションが失敗しました");
      }
    } catch(e) {
      log("エラー: " + (e.shortMessage || e.message).slice(0, 80), "err");
      setStatus({ ok: false, msg: e.shortMessage || e.message });
    }
    setLoading(false);
  };

  const handleDepositEURC = async () => {
    const err = validateAmount(eurcAmount, eurcWalletBal, "EURC");
    if (err) { setInputError(err); return; }
    if (!walletClient || !onArcChain) return;
    setInputError(null); setLoading(true); setStatus(null);
    try {
      const amtRaw = parseUnits(eurcAmount, 6);
      const allowance = await publicClient.readContract({
        address: ADDR.EURC, abi: ERC20_ABI, functionName: "allowance",
        args: [address, ADDR.ARB_VAULT],
      });
      if (allowance < amtRaw) {
        log("EURC Approve 中...", "info");
        const aTx = await walletClient.writeContract({
          address: ADDR.EURC, abi: ERC20_ABI, functionName: "approve",
          args: [ADDR.ARB_VAULT, amtRaw],
        });
        await publicClient.waitForTransactionReceipt({ hash: aTx });
        log("Approve 完了", "ok");
      }
      const minUSDC = amtRaw * 95n / 100n;
      log(`${eurcAmount} EURC を USDC に変換して預け入れ中...`, "info");
      const tx = await walletClient.writeContract({
        address: ADDR.ARB_VAULT, abi: VAULT_ABI, functionName: "depositEURC",
        args: [amtRaw, minUSDC],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      if (receipt.status === "success") {
        log(`✓ ${eurcAmount} EURC を預けました`, "ok");
        setStatus({ ok: true, msg: `${eurcAmount} EURC を USDC に変換して預けました` });
        setEurcAmount(""); await fetchData();
      } else {
        throw new Error("トランザクションが失敗しました");
      }
    } catch(e) {
      log("エラー: " + (e.shortMessage || e.message).slice(0, 80), "err");
      setStatus({ ok: false, msg: e.shortMessage || e.message });
    }
    setLoading(false);
  };
  const handleWithdrawAll = async () => {
    if (!walletClient || !onArcChain) return;
    if ((userValue ?? 0) <= 0) { setInputError("引き出せる残高がありません"); return; }
    setInputError(null); setLoading(true); setStatus(null);
    try {
      log("全額引き出し中...", "info");
      const tx = await walletClient.writeContract({
        address: ADDR.ARB_VAULT, abi: VAULT_ABI, functionName: "withdrawAll",
        args: [],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      if (receipt.status === "success") {
        log("✓ 引き出し完了", "ok");
        setStatus({ ok: true, msg: "全額引き出しました" });
        await fetchData();
      } else {
        throw new Error("トランザクションが失敗しました");
      }
    } catch(e) {
      log("エラー: " + (e.shortMessage || e.message).slice(0, 80), "err");
      setStatus({ ok: false, msg: e.shortMessage || e.message });
    }
    setLoading(false);
  };

  const handleCctpDeposit = async () => {
    const err = validateAmount(cctpAmount, null, "USDC");
    if (err) { setInputError(err); return; }
    if (!walletClient) return;
    if (!onSepolia) {
      setInputError("Ethereum Sepolia に切り替えてからブリッジしてください");
      return;
    }
    setInputError(null); setCctpLoading(true); setCctpStep("🌉 ブリッジ開始...");
    try {
      const { AppKit } = await import("@circle-fin/app-kit");
      const { createViemAdapterFromWalletClient } = await import("@circle-fin/adapter-viem-v2");
      const kit = new AppKit();
      const adapter = createViemAdapterFromWalletClient({ walletClient });
      kit.on("approve", () => { setCctpStep("✅ Approve完了"); log("CCTP Approve完了", "ok"); });
      kit.on("burn",    () => { setCctpStep("🔥 Burn完了 (Attestation待ち...)"); log("CCTP Burn完了", "ok"); });
      kit.on("attest",  () => { setCctpStep("📜 Attestation取得済み"); log("Attestation取得", "ok"); });
      kit.on("mint",    () => { setCctpStep("🪙 ARC着金！Vault Deposit中..."); log("CCTP Mint完了", "ok"); });
      log(`CCTPブリッジ開始: ${cctpAmount} USDC Sepolia → ARC`, "info");
      await kit.bridge({
        from: { adapter, chain: "Ethereum_Sepolia" },
        to:   { adapter, chain: "Arc_Testnet" },
        amount: cctpAmount,
      });
      log("Vault Deposit中...", "info");
      const amtRaw = parseUnits(cctpAmount, 6);
      const aTx = await walletClient.writeContract({
        address: ADDR.USDC, abi: ERC20_ABI, functionName: "approve",
        args: [ADDR.ARB_VAULT, amtRaw],
      });
      await publicClient.waitForTransactionReceipt({ hash: aTx });
      const tx = await walletClient.writeContract({
        address: ADDR.ARB_VAULT, abi: VAULT_ABI, functionName: "deposit",
        args: [amtRaw],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      if (receipt.status !== "success") throw new Error("Vault depositが失敗しました");
      setCctpStep("🎉 完了！Vaultに預け入れました");
      log(`✓ CCTPデポジット完了: ${cctpAmount} USDC`, "ok");
      setStatus({ ok: true, msg: `${cctpAmount} USDC を他チェーンからDeposit完了` });
      setCctpAmount(""); await fetchData();
    } catch(e) {
      log("CCTPエラー: " + (e.shortMessage || e.message || "").slice(0, 80), "err");
      setCctpStep("❌ エラーが発生しました");
      setStatus({ ok: false, msg: e.shortMessage || e.message });
    }
    setCctpLoading(false);
  };

  return (
    <>
      <Head><title>ARB Vault</title></Head>
      <div className="min-h-screen bg-gray-950 text-gray-300 font-mono text-xs">
        {wrongChain && tab !== "cctp" && (
          <div className="bg-red-950 border-b border-red-800 px-4 py-2 text-red-300">
            Arc Testnet (5042002) に切り替えてください
          </div>
        )}
        {tab === "cctp" && isConnected && !onSepolia && (
          <div className="bg-yellow-950 border-b border-yellow-800 px-4 py-2 text-yellow-300">
            CCTPブリッジには Ethereum Sepolia への切り替えが必要です
          </div>
        )}
        <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-600 to-emerald-500 flex items-center justify-center text-sm font-bold text-white">🏦</div>
          <div>
            <div className="text-sm font-bold text-white tracking-widest">ARB VAULT</div>
            <div className="text-gray-600 text-[10px]">EURC/USDC · ARC TESTNET · 手数料 {vaultInfo?.fee ?? 10}%</div>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Vault総資産", val: vaultInfo ? vaultInfo.totalAssets.toFixed(2) : "—", unit: "USDC", color: "text-green-400" },
              { label: "累積利益",    val: vaultInfo ? "+" + vaultInfo.totalProfit.toFixed(4) : "—", unit: "USDC", color: "text-emerald-400" },
              { label: "取引回数",    val: vaultInfo ? vaultInfo.totalTrades + "" : "—", unit: "回", color: "text-blue-400" },
              { label: "EURC残高",    val: eurcBal != null ? eurcBal.toFixed(2) : "—", unit: "EURC (Vault内)", color: "text-yellow-400" },
            ].map(s => (
              <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                <div className="text-gray-700 text-[9px] tracking-widest uppercase mb-1">{s.label}</div>
                <div className={`text-lg font-bold ${s.color}`}>{s.val}</div>
                <div className="text-gray-700 text-[9px]">{s.unit}</div>
              </div>
            ))}
          </div>
          {isConnected && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="text-gray-700 text-[9px] tracking-widest uppercase font-bold mb-3">あなたのポジション</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-gray-700 text-[9px] mb-1">ウォレット USDC</div>
                  <div className="text-blue-400 font-bold text-lg">{usdcBal?.toFixed(2) ?? "—"}</div>
                </div>
                <div>
                  <div className="text-gray-700 text-[9px] mb-1">Vault 預け入れ額</div>
                  <div className="text-green-400 font-bold text-lg">{userValue?.toFixed(4) ?? "—"}</div>
                </div>
              </div>
            </div>
          )}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex gap-2 mb-4 flex-wrap">
              {[
                ["deposit",  "預ける(USDC)"],
                ["eurc",     "預ける(EURC)"],
                ["cctp",     "🌉 他チェーンから"],
                ["withdraw", "引き出す"],
              ].map(([t, label]) => (
                <button key={t} onClick={() => { setTab(t); setInputError(null); setStatus(null); }}
                  className={`px-4 py-1.5 rounded text-xs font-bold tracking-widest border transition-colors
                    ${tab === t
                      ? t === "cctp"
                        ? "border-purple-500 bg-purple-950 text-purple-400"
                        : "border-green-500 bg-green-950 text-green-400"
                      : "border-gray-800 text-gray-600"}`}>
                  {label}
                </button>
              ))}
            </div>
            {inputError && (
              <div className="mb-3 p-2 rounded border border-orange-800 bg-orange-950 text-orange-300 text-[11px]">
                ⚠ {inputError}
              </div>
            )}
            {tab === "deposit" && (
              <div className="space-y-3">
                <div className="text-gray-600 text-[11px]">USDCを預けてアービトラージ利益を自動で受け取れます。</div>
                <div className="flex gap-2">
                  <input type="number" value={amount} onChange={e => { setAmount(e.target.value); setInputError(null); }}
                    placeholder="預ける USDC 量" min="0"
                    className="flex-1 bg-gray-950 border border-gray-800 rounded px-3 py-2 text-gray-300 text-xs focus:outline-none focus:border-green-700" />
                  <button onClick={() => setAmount(usdcBal?.toFixed(6) ?? "0")}
                    className="px-3 py-2 bg-gray-800 text-gray-400 rounded text-xs hover:bg-gray-700">MAX</button>
                </div>
                <button onClick={handleDeposit} disabled={loading || !amount || !isConnected || !onArcChain}
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
                  <input type="number" value={eurcAmount} onChange={e => { setEurcAmount(e.target.value); setInputError(null); }}
                    placeholder="預ける EURC 量" min="0"
                    className="flex-1 bg-gray-950 border border-gray-800 rounded px-3 py-2 text-gray-300 text-xs focus:outline-none focus:border-yellow-700" />
                  <button onClick={() => setEurcAmount(eurcWalletBal != null ? eurcWalletBal.toFixed(6) : "0")}
                    className="px-3 py-2 bg-gray-800 text-gray-400 rounded text-xs hover:bg-gray-700">MAX</button>
                </div>
                <button onClick={handleDepositEURC} disabled={loading || !eurcAmount || !isConnected || !onArcChain}
                  className="w-full py-3 bg-yellow-950 hover:bg-yellow-900 border border-yellow-800 text-yellow-400 rounded text-xs font-bold tracking-widest disabled:opacity-40 transition-colors">
                  {loading ? "処理中..." : "⬇ EURC を預ける"}
                </button>
              </div>
            )}
            {tab === "cctp" && (
              <div className="space-y-3">
                <div className="text-gray-600 text-[11px]">Ethereum SepoliaのUSDCをCCTPでブリッジして、そのままVaultに預けます。</div>
                <div className="bg-gray-950 border border-gray-800 rounded p-2 text-[10px] text-gray-600 space-y-0.5">
                  <div>① MetaMaskをEthereum Sepoliaに切り替える</div>
                  <div>② USDC量を入力してブリッジ実行</div>
                  <div>③ ARC Testnetへ自動でDeposit</div>
                </div>
                <input type="number" value={cctpAmount} onChange={e => { setCctpAmount(e.target.value); setInputError(null); }}
                  placeholder="送る USDC 量 (Sepolia)" min="0"
                  className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-gray-300 text-xs focus:outline-none focus:border-purple-700" />
                {cctpStep && (
                  <div className={`rounded p-2 text-[11px] border ${
                    cctpStep.startsWith("❌") ? "bg-red-950 border-red-900 text-red-300"
                    : cctpStep.startsWith("🎉") ? "bg-green-950 border-green-900 text-green-300"
                    : "bg-purple-950 border-purple-900 text-purple-300"}`}>
                    {cctpStep}
                  </div>
                )}
                <button onClick={handleCctpDeposit} disabled={cctpLoading || !cctpAmount || !isConnected}
                  className="w-full py-3 bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-400 rounded text-xs font-bold tracking-widest disabled:opacity-40 transition-colors">
                  {cctpLoading ? "処理中..." : "🌉 他チェーンからDeposit (CCTP)"}
                </button>
                <div className="text-gray-700 text-[10px]">※ MetaMaskのみで署名します。秘密鍵の入力は不要です。</div>
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
                <button onClick={handleWithdrawAll} disabled={loading || !isConnected || !onArcChain || (userValue ?? 0) <= 0}
                  className="w-full py-3 bg-red-950 hover:bg-red-900 border border-red-800 text-red-400 rounded text-xs font-bold tracking-widest disabled:opacity-40 transition-colors">
                  {loading ? "処理中..." : "⬆ 全額引き出す (Withdraw All)"}
                </button>
              </div>
            )}
            {status && (
              <div className={`mt-3 p-3 rounded text-[11px] border ${status.ok ? "bg-green-950 border-green-800 text-green-400" : "bg-red-950 border-red-800 text-red-400"}`}>
                {status.ok ? "✓ " : "✗ "}{status.msg}
              </div>
            )}
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-gray-700 text-[9px] tracking-widest uppercase font-bold mb-2">ログ</div>
            <div className="h-24 overflow-y-auto space-y-0.5 leading-6">
              {logs.length === 0
                ? <div className="text-gray-800 text-center py-2">ログなし</div>
                : logs.map((l, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-gray-800 shrink-0">{l.ts}</span>
                    <span className={{ info: "text-sky-400", ok: "text-green-400", err: "text-red-400" }[l.type] || "text-gray-500"}>
                      {l.msg}
                    </span>
                  </div>
                ))
              }
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-gray-700 text-[9px] tracking-widest uppercase font-bold mb-2">コントラクト</div>
            <div className="text-[10px] space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-700">ArbVault</span>
                <a href={`https://testnet.arcscan.app/address/${ADDR.ARB_VAULT}`} target="_blank" rel="noreferrer"
                  className="text-blue-700 hover:text-blue-500 underline font-mono">{ADDR.ARB_VAULT.slice(0, 14)}…</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
