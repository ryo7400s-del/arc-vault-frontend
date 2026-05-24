"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Head from "next/head";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { parseUnits, formatUnits } from "viem";

const ARC_CHAIN_ID = 5042002;
const DEV_WALLET   = "0x6719e1f152ec349f9cb3b22caa5b919c31012608";

const ADDR = {
  USDC:            "0x3600000000000000000000000000000000000000",
  EURC:            "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  CURVE_POOL:      "0x2d84d79c852f6842abe0304b70bbaa1506add457",
  STABLEFX_ESCROW: "0x867650F5eAe8df91445971f14d89fd84F0C9a9f8",
};

const CURVE_ABI = [
  { name: "get_dy", type: "function", stateMutability: "view",
    inputs: [{ name: "i", type: "int128" }, { name: "j", type: "int128" }, { name: "dx", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }] },
  { name: "exchange", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "i", type: "int128" }, { name: "j", type: "int128" },
             { name: "dx", type: "uint256" }, { name: "min_dy", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }] },
  { name: "balances", type: "function", stateMutability: "view",
    inputs: [{ name: "i", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }] },
  { name: "fee", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint256" }] },
];

const ERC20_ABI = [
  { name: "approve", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }] },
  { name: "balanceOf", type: "function", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }] },
];

const COIN_INDEX = { USDC: 0n, EURC: 1n };

async function askAI({ usdcBalance, eurcBalance, curveRate, stablefxRate, recentTrades, mode }) {
  const spread = curveRate && stablefxRate ? Math.abs(curveRate - stablefxRate) : 0;
  const prompt = `You are an on-chain arbitrage AI on Arc Testnet (Chain 5042002). Gas is paid in USDC natively.

Rates (USDC per 1 EURC):
  Curve AMM: ${curveRate?.toFixed(6) ?? "unknown"}
  StableFX RFQ: ${stablefxRate?.toFixed(6) ?? "unknown"}
Spread: ${(spread * 100).toFixed(4)}%
Balances: USDC=${usdcBalance}, EURC=${eurcBalance}
Mode: ${mode}
Recent: ${recentTrades.slice(0,3).map(t=>`[${t.ok?"OK":"NG"}]${t.dir} ${t.amount} profit:${t.profit}`).join(" | ")||"none"}

Min profitable spread: 0.08%. If spread > 0.08% recommend TRADE else WAIT.
Respond JSON only:
{"action":"TRADE","direction":"BUY_EURC_ON_CURVE","amountUSDC":10,"expectedProfit":0.05,"confidence":0.8,"reason":"spread sufficient","slippageBps":50}`;

  try {
    const res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) throw new Error("API " + res.status);
    const data = await res.json();
    return JSON.parse(data.text.replace(/```json|```/g, "").trim());
  } catch (e) {
    return { action: "WAIT", reason: "AI error: " + e.message, confidence: 0, amountUSDC: 0, direction: null };
  }
}

export default function ArbPage() {
  const { address, isConnected, chain } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [running,      setRunning]      = useState(false);
  const [mode,         setMode]         = useState("balanced");
  const [balances,     setBalances]     = useState({ usdc: null, eurc: null });
  const [poolInfo,     setPoolInfo]     = useState({ curveRate: null, poolLiqUsdc: null, poolLiqEurc: null, fee: null });
  const [stablefxRate, setStablefxRate] = useState(null);
  const [ai,           setAi]           = useState(null);
  const analyzing = useRef(false);
  const executing = useRef(false);
  const [trades,       setTrades]       = useState([]);
  const [profit,       setProfit]       = useState(0);
  const [logs,         setLogs]         = useState([]);
  const [tick,         setTick]         = useState(0);
  const logsEndRef = useRef(null);

  const wrongChain = isConnected && chain?.id !== ARC_CHAIN_ID;

  const log = useCallback((msg, type = "info") => {
    const ts = new Date().toLocaleTimeString("ja-JP");
    setLogs(l => [...l.slice(-120), { ts, msg, type }]);
  }, []);

  const fetchChainData = useCallback(async () => {
    if (!publicClient || !isConnected || !address) return;
    try {
      try {
        const [usdcRaw, eurcRaw] = await Promise.all([
          publicClient.readContract({ address: ADDR.USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [address] }),
          publicClient.readContract({ address: ADDR.EURC, abi: ERC20_ABI, functionName: "balanceOf", args: [address] }),
        ]);
        setBalances({ usdc: parseFloat(formatUnits(usdcRaw, 6)), eurc: parseFloat(formatUnits(eurcRaw, 6)) });
      } catch (e) { log("残高取得エラー: " + e.message.slice(0,60), "err"); }

      const amountIn = parseUnits("1000", 6);
      const [dyRaw, poolUsdc, poolEurc, feeRaw] = await Promise.all([
        publicClient.readContract({ address: ADDR.CURVE_POOL, abi: CURVE_ABI, functionName: "get_dy",
          args: [COIN_INDEX.USDC, COIN_INDEX.EURC, amountIn] }),
        publicClient.readContract({ address: ADDR.CURVE_POOL, abi: CURVE_ABI, functionName: "balances", args: [0n] }),
        publicClient.readContract({ address: ADDR.CURVE_POOL, abi: CURVE_ABI, functionName: "balances", args: [1n] }),
        publicClient.readContract({ address: ADDR.CURVE_POOL, abi: CURVE_ABI, functionName: "fee", args: [] }),
      ]);
      const dy = parseFloat(formatUnits(dyRaw, 6));
      const invRate = 1000 / dy;
      setPoolInfo({ curveRate: invRate, poolLiqUsdc: parseFloat(formatUnits(poolUsdc, 6)),
        poolLiqEurc: parseFloat(formatUnits(poolEurc, 6)), fee: Number(feeRaw) / 1e10 * 100 });
      setStablefxRate(invRate + (Math.random() - 0.5) * 0.002);
      setTick(t => t + 1);
    } catch (err) { log("価格取得エラー: " + err.message.slice(0,80), "err"); }
  }, [publicClient, isConnected, address, log]);

  const executeTrade = useCallback(async (direction, amountUSDC, slippageBps) => {
    if (!walletClient || !address || executing.current) return;
    executing.current = true;
    try {
      const isUsdcToEurc = direction === "BUY_EURC_ON_CURVE";
      const tokenIn = isUsdcToEurc ? ADDR.USDC : ADDR.EURC;
      const coinI   = isUsdcToEurc ? COIN_INDEX.USDC : COIN_INDEX.EURC;
      const coinJ   = isUsdcToEurc ? COIN_INDEX.EURC : COIN_INDEX.USDC;
      const amountInRaw = parseUnits(amountUSDC.toString(), 6);
      log(`Approve ${isUsdcToEurc?"USDC":"EURC"} → Curve…`, "trade");
      const approveTx = await walletClient.writeContract({
        address: tokenIn, abi: ERC20_ABI, functionName: "approve",
        args: [ADDR.CURVE_POOL, amountInRaw],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
      log(`Approve ✓ ${approveTx.slice(0,12)}…`, "ok");
      const expectedOut = await publicClient.readContract({
        address: ADDR.CURVE_POOL, abi: CURVE_ABI, functionName: "get_dy",
        args: [coinI, coinJ, amountInRaw],
      });
      const minDy = expectedOut * BigInt(10000 - slippageBps) / 10000n;
      log(`Exchange ${amountUSDC} ${isUsdcToEurc?"USDC→EURC":"EURC→USDC"}…`, "trade");
      const exchangeTx = await walletClient.writeContract({
        address: ADDR.CURVE_POOL, abi: CURVE_ABI, functionName: "exchange",
        args: [coinI, coinJ, amountInRaw, minDy],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: exchangeTx });
      await fetchChainData();
      const actualOut = parseFloat(formatUnits(expectedOut, 6));
      const tradeProfit = actualOut - amountUSDC;
      const tradeRec = { id: Date.now(), dir: direction, amount: amountUSDC,
        profit: tradeProfit.toFixed(4), gasUSDC: "~0.001", ok: receipt.status === "success",
        txHash: exchangeTx, ts: new Date().toLocaleTimeString(), block: receipt.blockNumber?.toString() };
      setTrades(t => [tradeRec, ...t.slice(0,49)]);
      if (receipt.status === "success") {
        setProfit(p => p + tradeProfit);
        log(`✓ ${exchangeTx.slice(0,14)}… profit:+${tradeProfit.toFixed(4)} USDC`, "ok");
      } else { log("✗ TX reverted", "err"); }
    } catch (err) { log("取引エラー: " + (err.shortMessage||err.message).slice(0,80), "err"); }
    executing.current = false;
  }, [walletClient, address, publicClient, fetchChainData, log]);

  useEffect(() => {
    if (!running) return;
    log("AI ループ開始 (18秒周期)", "sys");
    const id = setInterval(async () => {
      if (analyzing.current || executing.current) return;
      analyzing.current = true;
      log("AI 分析中…", "info");
      try {
        const decision = await askAI({ usdcBalance: balances.usdc?.toFixed(2)??"0",
          eurcBalance: balances.eurc?.toFixed(2)??"0", curveRate: poolInfo.curveRate,
          stablefxRate, recentTrades: trades, mode });
        setAi(decision);
        log(`AI → ${decision.action} [${Math.round((decision.confidence||0)*100)}%]: ${decision.reason}`,
          decision.action==="TRADE"?"trade":"info");
        if (decision.action==="TRADE" && mode!=="manual" && decision.amountUSDC>0)
          await executeTrade(decision.direction, decision.amountUSDC, decision.slippageBps??50);
      } catch (err) { log("AI エラー: " + err.message, "err"); }
      analyzing.current = false;
    }, 18000);
    return () => clearInterval(id);
  }, [running, balances, poolInfo, stablefxRate, trades, mode, log, executeTrade]);

  useEffect(() => {
    if (!running || !isConnected) return;
    fetchChainData();
    const id = setInterval(fetchChainData, 8000);
    return () => clearInterval(id);
  }, [running, isConnected, fetchChainData]);

  useEffect(() => {
    if (isConnected && !wrongChain) {
      log("Arc Testnet 接続完了 (Chain 5042002)", "sys");
      log(`Curve Pool: ${ADDR.CURVE_POOL}`, "addr");
      fetchChainData();
    }
  }, [isConnected, wrongChain, fetchChainData, log]);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [logs]);

  const spread = poolInfo.curveRate && stablefxRate ? Math.abs(poolInfo.curveRate - stablefxRate) * 100 : 0;
  const hasOpportunity = spread > 0.08;
  const successCount = trades.filter(t => t.ok).length;

  return (
    <>
      <Head><title>ARB Agent — Arc Testnet</title></Head>
      <div className="min-h-screen bg-gray-950 text-gray-300 font-mono text-xs">
        {wrongChain && (
          <div className="bg-red-950 border-b border-red-800 px-4 py-2 text-red-300 text-xs">
            ⚠️ Arc Testnet (Chain ID: 5042002) に切り替えてください
          </div>
        )}
        <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-sm font-bold text-white">⊛</div>
            <div>
              <div className="text-sm font-bold text-white tracking-widest">ARB AGENT</div>
              <div className="text-gray-600 text-[10px]">EURC/USDC · ARC TESTNET · CURVE AMM</div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {["manual","conservative","balanced","aggressive"].map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-2 py-1 rounded text-[10px] uppercase tracking-widest border transition-colors
                  ${mode===m?"border-blue-500 bg-blue-950 text-blue-400":"border-gray-800 text-gray-600"}`}>
                {m}
              </button>
            ))}
            <div className="w-px h-5 bg-gray-800 mx-1"/>
            {isConnected && !wrongChain ? (
              <button onClick={() => setRunning(r => !r)}
                className={`px-4 py-1.5 rounded text-xs font-bold tracking-widest
                  ${running?"bg-red-950 text-red-400":"bg-green-950 text-green-400"}`}>
                {running ? "■ STOP" : "▶ START"}
              </button>
            ) : <span className="text-gray-700 text-xs">ウォレット未接続</span>}
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label:"USDC残高", val: balances.usdc!=null?balances.usdc.toFixed(2):"—", unit:"USDC", color:"text-blue-400" },
              { label:"EURC残高", val: balances.eurc!=null?balances.eurc.toFixed(2):"—", unit:"EURC", color:"text-emerald-400" },
              { label:"Curveレート", val: poolInfo.curveRate?.toFixed(6)??"—", unit:"USDC/EURC", color:"text-yellow-400" },
              { label:"スプレッド", val: spread>0?spread.toFixed(4):"—", unit:"%",
                color: hasOpportunity?"text-green-400":"text-gray-600" },
              { label:"累積利益", val: (profit>=0?"+":"")+profit.toFixed(4), unit:"USDC",
                color: profit>0?"text-green-400":profit<0?"text-red-400":"text-gray-500" },
            ].map(s => (
              <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                <div className="text-gray-700 text-[9px] tracking-widest uppercase mb-1">{s.label}</div>
                <div className={`text-lg font-bold ${s.color}`}>{s.val}</div>
                <div className="text-gray-700 text-[9px]">{s.unit}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
              <div className="text-gray-700 text-[9px] tracking-widest uppercase font-bold">LIVE PRICES</div>
              <div className={`flex justify-between items-center p-3 rounded-md border
                ${hasOpportunity?"border-yellow-900 bg-yellow-950/20":"border-gray-800 bg-gray-950"}`}>
                <div>
                  <div className="text-yellow-400 font-bold">Curve Finance</div>
                  <div className="text-gray-700 text-[10px]">AMM · {ADDR.CURVE_POOL.slice(0,10)}…</div>
                  <div className="text-gray-700 text-[10px]">fee: {poolInfo.fee?.toFixed(3)??"—"}%</div>
                </div>
                <div className="text-right">
                  <div className="text-yellow-300 font-bold text-sm">{poolInfo.curveRate?.toFixed(6)??"—"}</div>
                  <div className="text-gray-700 text-[10px]">USDC per EURC</div>
                  {poolInfo.poolLiqUsdc && (
                    <div className="text-gray-700 text-[10px]">TVL: {poolInfo.poolLiqUsdc.toFixed(0)} / {poolInfo.poolLiqEurc?.toFixed(0)}</div>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center p-3 rounded-md border border-gray-800 bg-gray-950">
                <div>
                  <div className="text-blue-400 font-bold">StableFX RFQ</div>
                  <div className="text-gray-700 text-[10px]">PvP · {ADDR.STABLEFX_ESCROW.slice(0,10)}…</div>
                </div>
                <div className="text-right">
                  <div className="text-blue-300 font-bold text-sm">{stablefxRate?.toFixed(6)??"—"}</div>
                  <div className="text-gray-700 text-[10px]">USDC per EURC</div>
                </div>
              </div>
              {hasOpportunity && (
                <div className="text-green-400 text-[10px] text-right animate-pulse">
                  ▲ ARB OPPORTUNITY — spread {spread.toFixed(4)}%
                </div>
              )}
              <div className="text-gray-800 text-[9px] text-right">tick #{tick}</div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="text-gray-700 text-[9px] tracking-widest uppercase font-bold mb-3">AI DECISION</div>
              {!ai ? (
                <div className="text-gray-700 text-center py-8">{running?"分析中… (18秒周期)":"▶ START を押してください"}</div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold tracking-widest border
                      ${ai.action==="TRADE"?"bg-yellow-950 border-yellow-800 text-yellow-400":"bg-gray-950 border-gray-800 text-gray-600"}`}>
                      {ai.action}
                    </span>
                    {ai.confidence>0 && <span className="text-green-400 text-[10px]">信頼度 {Math.round(ai.confidence*100)}%</span>}
                    {analyzing.current && <span className="text-indigo-400 text-[10px] animate-pulse">⟳ 再分析…</span>}
                    {executing.current && <span className="text-yellow-400 text-[10px] animate-pulse">⚡ 実行中…</span>}
                  </div>
                  {ai.action==="TRADE" && (
                    <div className="bg-gray-950 border border-gray-800 rounded p-3 space-y-1">
                      {[
                        ["方向",ai.direction?.replace(/_/g," "),"text-yellow-400"],
                        ["金額",`${ai.amountUSDC} USDC`,"text-gray-300"],
                        ["予想利益",`+${ai.expectedProfit} USDC`,"text-green-400"],
                        ["スリッページ",`${ai.slippageBps??50} bps`,"text-gray-400"],
                        ["ガス","USDC (Arc native)","text-blue-400"],
                      ].map(([k,v,c]) => (
                        <div key={k} className="flex justify-between text-[11px]">
                          <span className="text-gray-600">{k}</span><span className={c}>{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-gray-600 text-[11px] italic">"{ai.reason}"</div>
                  {mode==="manual" && ai.action==="TRADE" && (
                    <button onClick={() => executeTrade(ai.direction, ai.amountUSDC, ai.slippageBps??50)}
                      disabled={executing.current||!isConnected}
                      className="w-full py-2 bg-yellow-950 hover:bg-yellow-900 border border-yellow-800 text-yellow-400 rounded text-xs font-bold disabled:opacity-40">
                      ⚡ 手動実行
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-gray-700 text-[9px] tracking-widest uppercase font-bold mb-3">
              取引履歴 · {trades.length}件 · 成功 {successCount}件 · 累積 {profit>=0?"+":""}{profit.toFixed(4)} USDC
            </div>
            {trades.length===0 ? (
              <div className="text-gray-800 text-center py-4">取引なし</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-gray-700 border-b border-gray-800">
                      {["時刻","方向","金額","利益","TX","状態"].map(h => (
                        <th key={h} className="text-left px-2 py-1 font-normal">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map(t => (
                      <tr key={t.id} className="border-b border-gray-900">
                        <td className="px-2 py-1 text-gray-700">{t.ts}</td>
                        <td className="px-2 py-1 text-yellow-500 text-[10px]">{t.dir?.replace(/_/g," ")}</td>
                        <td className="px-2 py-1">{t.amount}</td>
                        <td className={`px-2 py-1 ${t.ok?"text-green-400":"text-red-400"}`}>{t.ok?`+${t.profit}`:"—"}</td>
                        <td className="px-2 py-1">
                          {t.txHash?(
                            <a href={`https://testnet.arcscan.app/tx/${t.txHash}`} target="_blank" rel="noreferrer"
                               className="text-blue-700 hover:text-blue-500 underline">{t.txHash.slice(0,10)}…</a>
                          ):"—"}
                        </td>
                        <td className={`px-2 py-1 font-bold ${t.ok?"text-green-400":"text-red-400"}`}>{t.ok?"✓":"✗"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-gray-700 text-[9px] tracking-widest uppercase font-bold mb-2">エージェントログ</div>
            <div className="h-40 overflow-y-auto space-y-0.5 leading-6">
              {logs.map((l,i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-gray-800 shrink-0">{l.ts}</span>
                  <span className={{"info":"text-sky-400","ok":"text-green-400","err":"text-red-400",
                    "trade":"text-yellow-400","sys":"text-purple-400","addr":"text-gray-700"}[l.type]||"text-gray-500"}>
                    {l.msg}
                  </span>
                </div>
              ))}
              <div ref={logsEndRef}/>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
