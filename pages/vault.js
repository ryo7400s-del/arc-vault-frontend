"use client";
import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { parseUnits, formatUnits } from "viem";

const ARC_CHAIN_ID = 5042002;

const ADDR = {
  USDC:      "0x3600000000000000000000000000000000000000",
  ARB_VAULT: "0x53dbf84e7ff49a94e133faf6eec5050299d3a98d",
};

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

const VAULT_ABI = [
  { name: "deposit", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { name: "withdraw", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "shareAmount", type: "uint256" }], outputs: [] },
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
];

export default function VaultPage() {
  const { address, isConnected, chain } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [tab,          setTab]        = useState("deposit");
  const [amount,       setAmount]     = useState("");
  const [usdcBal,      setUsdcBal]    = useState(null);
  const [userValue,    setUserValue]  = useState(null);
  const [userShares,   setUserShares] = useState(null);
  const [vaultInfo,    setVaultInfo]  = useState(null);
  const [loading,      setLoading]    = useState(false);
  const [status,       setStatus]     = useState(null);
  const [logs,         setLogs]       = useState([]);

  const wrongChain = isConnected && chain?.id !== ARC_CHAIN_ID;

  const log = useCallback((msg, type = "info") => {
    const ts = new Date().toLocaleTimeString("ja-JP");
    setLogs(l => [...l.slice(-30), { ts, msg, type }]);
  }, []);

  const fetchData = useCallback(async () => {
    if (!publicClient || !address) return;
    try {
      const [uR, uv, us, vi] = await Promise.all([
        publicClient.readContract({ address: ADDR.USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [address] }),
        publicClient.readContract({ address: ADDR.ARB_VAULT, abi: VAULT_ABI, functionName: "getUserValue", args: [address] }),
        publicClient.readContract({ address: ADDR.ARB_VAULT, abi: VAULT_ABI, functionName: "shares", args: [address] }),
        publicClient.readContract({ address: ADDR.ARB_VAULT, abi: VAULT_ABI, functionName: "getVaultInfo" }),
      ]);
      setUsdcBal(parseFloat(formatUnits(uR, 6)));
      setUserValue(parseFloat(formatUnits(uv, 6)));
      setUserShares(us);
      setVaultInfo({
        totalAssets:   parseFloat(formatUnits(vi[0], 6)),
        totalShares:   parseFloat(formatUnits(vi[1], 6)),
        totalProfit:   parseFloat(formatUnits(vi[2], 6)),
        totalTrades:   Number(vi[3]),
        pricePerShare: parseFloat(formatUnits(vi[4], 6)),
        fee:           Number(vi[5]) / 100,
      });
    } catch(e) {
      log("データ取得エラー: " + e.message.slice(0,60), "err");
    }
  }, [publicClient, address, log]);

  useEffect(() => {
    if (isConnected && !wrongChain) fetchData();
  }, [isConnected, wrongChain, fetchData]);

  const handleDeposit = async () => {
    if (!walletClient || !amount) return;
    setLoading(true);
    setStatus(null);
    try {
      const amtRaw = parseUnits(amount, 6);
      const MAX    = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

      // approve チェック
      const allowance = await publicClient.readContract({
        address: ADDR.USDC, abi: ERC20_ABI, functionName: "allowance",
        args: [address, ADDR.ARB_VAULT],
      });
      if (allowance < amtRaw) {
        log("USDC を Vault に Approve 中...", "info");
        const aTx = await walletClient.writeContract({
          address: ADDR.USDC, abi: ERC20_ABI, functionName: "approve",
          args: [ADDR.ARB_VAULT, MAX],
        });
        await publicClient.waitForTransactionReceipt({ hash: aTx });
        log("Approve ✓", "ok");
      }

      log(`${amount} USDC を預け入れ中...`, "info");
      const tx = await walletClient.writeContract({
        address: ADDR.ARB_VAULT, abi: VAULT_ABI, functionName: "deposit",
        args: [amtRaw],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      if (receipt.status === "success") {
        log(`✓ 預け入れ完了 +${amount} USDC`, "ok");
        setStatus({ ok: true, msg: `${amount} USDC を預け入れました` });
        setAmount("");
        await fetchData();
      } else {
        log("✗ TX reverted", "err");
      }
    } catch(e) {
      log("エラー: " + (e.shortMessage||e.message).slice(0,80), "err");
      setStatus({ ok: false, msg: e.shortMessage||e.message });
    }
    setLoading(false);
  };

  const handleWithdrawAll = async () => {
    if (!walletClient) return;
    setLoading(true);
    setStatus(null);
    try {
      log("全額引き出し中...", "info");
      const tx = await walletClient.writeContract({
        address: ADDR.ARB_VAULT, abi: VAULT_ABI, functionName: "withdrawAll",
        args: [],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      if (receipt.status === "success") {
        log(`✓ 引き出し完了`, "ok");
        setStatus({ ok: true, msg: "全額引き出しました" });
        await fetchData();
      } else {
        log("✗ TX reverted", "err");
      }
    } catch(e) {
      log("エラー: " + (e.shortMessage||e.message).slice(0,80), "err");
      setStatus({ ok: false, msg: e.shortMessage||e.message });
    }
    setLoading(false);
  };

  const depositedAmount = userValue != null && vaultInfo
    ? userValue : 0;
  const profit = userValue != null && userShares != null && vaultInfo
    ? userValue - (Number(userShares) / 1e6) : 0;

  return (
    <>
      <Head><title>ARB Vault — Arc Testnet</title></Head>
      <div className="min-h-screen bg-gray-950 text-gray-300 font-mono text-xs">

        {wrongChain && (
          <div className="bg-red-950 border-b border-red-800 px-4 py-2 text-red-300 text-xs">
            ⚠️ Arc Testnet (Chain ID: 5042002) に切り替えてください
          </div>
        )}

        {/* Header */}
        <div className="bg-gray-900 border-b border-gray-800 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-600 to-emerald-500 flex items-center justify-center text-sm font-bold text-white">🏦</div>
            <div>
              <div className="text-sm font-bold text-white tracking-widest">ARB VAULT</div>
              <div className="text-gray-600 text-[10px]">EURC/USDC · ARC TESTNET · {vaultInfo ? `手数料 ${vaultInfo.fee}%` : ""}</div>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">

          {/* Vault Stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label:"Vault 総資産",   val: vaultInfo ? vaultInfo.totalAssets.toFixed(2) : "—",   unit:"USDC", color:"text-green-400" },
              { label:"累積利益",        val: vaultInfo ? "+"+vaultInfo.totalProfit.toFixed(4) : "—", unit:"USDC", color:"text-emerald-400" },
              { label:"取引回数",        val: vaultInfo ? vaultInfo.totalTrades : "—",               unit:"回",   color:"text-blue-400" },
              { label:"シェア単価",      val: vaultInfo ? vaultInfo.pricePerShare.toFixed(6) : "—",  unit:"USDC", color:"text-yellow-400" },
            ].map(s => (
              <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                <div className="text-gray-700 text-[9px] tracking-widest uppercase mb-1">{s.label}</div>
                <div className={`text-lg font-bold ${s.color}`}>{s.val}</div>
                <div className="text-gray-700 text-[9px]">{s.unit}</div>
              </div>
            ))}
          </div>

          {/* User Position */}
          {isConnected && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="text-gray-700 text-[9px] tracking-widest uppercase font-bold mb-3">あなたのポジション</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-gray-700 text-[9px] mb-1">ウォレット残高</div>
                  <div className="text-blue-400 font-bold">{usdcBal?.toFixed(2) ?? "—"} USDC</div>
                </div>
                <div>
                  <div className="text-gray-700 text-[9px] mb-1">預け入れ残高</div>
                  <div className="text-green-400 font-bold">{depositedAmount.toFixed(2)} USDC</div>
                </div>
                <div>
                  <div className="text-gray-700 text-[9px] mb-1">利益</div>
                  <div className={`font-bold ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {profit >= 0 ? "+" : ""}{profit.toFixed(4)} USDC
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Deposit / Withdraw */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex gap-2 mb-4">
              {["deposit","withdraw"].map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-1.5 rounded text-xs font-bold tracking-widest border transition-colors
                    ${tab===t ? "border-green-500 bg-green-950 text-green-400" : "border-gray-800 text-gray-600"}`}>
                  {t === "deposit" ? "預ける" : "引き出す"}
                </button>
              ))}
            </div>

            {tab === "deposit" ? (
              <div className="space-y-3">
                <div className="text-gray-600 text-[11px]">USDC を預けてアービトラージ利益を自動で受け取れます。</div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="預ける USDC 量"
                    className="flex-1 bg-gray-950 border border-gray-800 rounded px-3 py-2 text-gray-300 text-xs focus:outline-none focus:border-green-700"
                  />
                  <button onClick={() => setAmount(usdcBal?.toFixed(2) ?? "")}
                    className="px-3 py-2 bg-gray-800 text-gray-400 rounded text-xs hover:bg-gray-700">
                    MAX
                  </button>
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
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-gray-600">引き出し予定額</span>
                    <span className="text-green-400 font-bold">{depositedAmount.toFixed(4)} USDC</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-600">うち利益</span>
                    <span className={profit >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {profit >= 0 ? "+" : ""}{profit.toFixed(4)} USDC
                    </span>
                  </div>
                </div>
                <button onClick={handleWithdrawAll} disabled={loading || !isConnected || depositedAmount <= 0}
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

          {/* Contract Info */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-gray-700 text-[9px] tracking-widest uppercase font-bold mb-2">コントラクト情報</div>
            <div className="space-y-1">
              {[
                ["ArbVault",  ADDR.ARB_VAULT],
                ["USDC",      ADDR.USDC],
              ].map(([k,v]) => (
                <div key={k} className="flex justify-between text-[10px]">
                  <span className="text-gray-700">{k}</span>
                  <a href={`https://testnet.arcscan.app/address/${v}`} target="_blank" rel="noreferrer"
                    className="text-blue-700 hover:text-blue-500 underline font-mono">{v.slice(0,12)}…</a>
                </div>
              ))}
            </div>
          </div>

          {/* Logs */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-gray-700 text-[9px] tracking-widests uppercase font-bold mb-2">ログ</div>
            <div className="h-24 overflow-y-auto space-y-0.5 leading-6">
              {logs.length === 0
                ? <div className="text-gray-800 text-center py-2">ログなし</div>
                : logs.map((l,i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-gray-800 shrink-0">{l.ts}</span>
                    <span className={{"info":"text-sky-400","ok":"text-green-400","err":"text-red-400"}[l.type]||"text-gray-500"}>
                      {l.msg}
                    </span>
                  </div>
                ))
              }
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
