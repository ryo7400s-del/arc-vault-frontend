"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Head from "next/head";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { parseUnits, formatUnits } from "viem";

const ARC_CHAIN_ID = 5042002;
const ADDR = {
  USDC: "0x3600000000000000000000000000000000000000",
  EURC: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  CURVE_POOL: "0x2d84d79c852f6842abe0304b70bbaa1506add457",
  STABLEFX_ESCROW: "0x867650F5eAe8df91445971f14d89fd84F0C9a9f8",
};
const CURVE_ABI = [
  { name: "get_dy", type: "function", stateMutability: "view",
    inputs: [{name:"i",type:"int128"},{name:"j",type:"int128"},{name:"dx",type:"uint256"}],
    outputs: [{name:"",type:"uint256"}] },
  { name: "exchange", type: "function", stateMutability: "nonpayable",
    inputs: [{name:"i",type:"int128"},{name:"j",type:"int128"},{name:"dx",type:"uint256"},{name:"min_dy",type:"uint256"}],
    outputs: [{name:"",type:"uint256"}] },
  { name: "balances", type: "function", stateMutability: "view",
    inputs: [{name:"i",type:"uint256"}], outputs: [{name:"",type:"uint256"}] },
  { name: "fee", type: "function", stateMutability: "view",
    inputs: [], outputs: [{name:"",type:"uint256"}] },
];
const ERC20_ABI = [
  { name: "approve", type: "function", stateMutability: "nonpayable",
    inputs: [{name:"spender",type:"address"},{name:"amount",type:"uint256"}],
    outputs: [{name:"",type:"bool"}] },
  { name: "balanceOf", type: "function", stateMutability: "view",
    inputs: [{name:"account",type:"address"}], outputs: [{name:"",type:"uint256"}] },
];
const CI = { USDC: 0n, EURC: 1n };

async function askAI(p) {
  const spread = p.curveRate && p.stablefxRate ? Math.abs(p.curveRate - p.stablefxRate) : 0;
  const prompt = `You are an arbitrage AI on Arc Testnet. Gas paid in USDC.
Curve rate: ${p.curveRate?.toFixed(6)??"?"}  StableFX: ${p.stablefxRate?.toFixed(6)??".?"}
Spread: ${(spread*100).toFixed(4)}%  USDC=${p.usdc}  EURC=${p.eurc}  Mode=${p.mode}
If spread>0.08% and USDC>5 respond TRADE else WAIT.
JSON only: {"action":"TRADE","direction":"BUY_EURC_ON_CURVE","amountUSDC":10,"expectedProfit":0.05,"confidence":0.8,"reason":"ok","slippageBps":50}`;
  try {
    const r = await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})});
    const d = await r.json();
    return JSON.parse(d.text.replace(/```json|```/g,"").trim());
  } catch(e) {
    return {action:"WAIT",reason:"err:"+e.message,confidence:0,amountUSDC:0,direction:null,slippageBps:50};
  }
}

export default function ArbPage() {
  const {address,isConnected,chain} = useAccount();
  const publicClient = usePublicClient();
  const {data:walletClient} = useWalletClient();

  const [running,  setRunning]  = useState(false);
  const [mode,     setMode]     = useState("balanced");
  const [balances, setBalances] = useState({usdc:null,eurc:null});
  const [pool,     setPool]     = useState({curveRate:null,liqU:null,liqE:null,fee:null});
  const [sfxRate,  setSfxRate]  = useState(null);
  const [ai,       setAi]       = useState(null);
  const [trades,   setTrades]   = useState([]);
  const [profit,   setProfit]   = useState(0);
  const [logs,     setLogs]     = useState([]);
  const [tick,     setTick]     = useState(0);

  const logsEndRef  = useRef(null);
  const analyzingR  = useRef(false);
  const executingR  = useRef(false);
  const poolR       = useRef({curveRate:null});
  const sfxR        = useRef(null);
  const balR        = useRef({usdc:null,eurc:null});
  const modeR       = useRef("balanced");
  const tradesR     = useRef([]);

  const wrongChain = isConnected && chain?.id !== ARC_CHAIN_ID;

  const log = useCallback((msg,type="info") => {
    const ts = new Date().toLocaleTimeString("ja-JP");
    setLogs(l => [...l.slice(-120),{ts,msg,type}]);
  },[]);

  const fetchChain = useCallback(async () => {
    try {
      try {
        const [ur,er] = await Promise.all([
          publicClient.readContract({address:ADDR.USDC,abi:ERC20_ABI,functionName:"balanceOf",args:[address]}),
          publicClient.readContract({address:ADDR.EURC,abi:ERC20_ABI,functionName:"balanceOf",args:[address]}),
        ]);
        const b = {usdc:parseFloat(formatUnits(ur,6)),eurc:parseFloat(formatUnits(er,6))};
        setBalances(b); balR.current = b;
      } catch(e) { log("残高エラー:"+e.message.slice(0,50),"err"); }
      const ain = parseUnits("1000",6);
      const [dy,pu,pe,fr] = await Promise.all([
        publicClient.readContract({address:ADDR.CURVE_POOL,abi:CURVE_ABI,functionName:"get_dy",args:[CI.USDC,CI.EURC,ain]}),
        publicClient.readContract({address:ADDR.CURVE_POOL,abi:CURVE_ABI,functionName:"balances",args:[0n]}),
        publicClient.readContract({address:ADDR.CURVE_POOL,abi:CURVE_ABI,functionName:"balances",args:[1n]}),
        publicClient.readContract({address:ADDR.CURVE_POOL,abi:CURVE_ABI,functionName:"fee",args:[]}),
      ]);
      const inv = 1000/parseFloat(formatUnits(dy,6));
      const p = {curveRate:inv,liqU:parseFloat(formatUnits(pu,6)),liqE:parseFloat(formatUnits(pe,6)),fee:Number(fr)/1e10*100};
      setPool(p); poolR.current = p;
      const sfx = inv+(Math.random()-0.5)*0.002;
      setSfxRate(sfx); sfxR.current = sfx;
      setTick(t=>t+1);
    } catch(e) { log("価格エラー:"+e.message.slice(0,60),"err"); }
  },[publicClient,isConnected,address,log]);

  const execTrade = useCallback(async (dir,amt,slip) => {
    executingR.current = true;
    try {
      const buy = dir==="BUY_EURC_ON_CURVE";
      const tok = buy?ADDR.USDC:ADDR.EURC;
      const ci  = buy?CI.USDC:CI.EURC;
      const cj  = buy?CI.EURC:CI.USDC;
      const raw = parseUnits(amt.toString(),6);
      log("Approve...","trade");
      const at = await walletClient.writeContract({address:tok,abi:ERC20_ABI,functionName:"approve",args:[ADDR.CURVE_POOL,raw]});
      await publicClient.waitForTransactionReceipt({hash:at});
      log("Approve ✓","ok");
      const eo = await publicClient.readContract({address:ADDR.CURVE_POOL,abi:CURVE_ABI,functionName:"get_dy",args:[ci,cj,raw]});
      const minDy = eo*BigInt(10000-slip)/10000n;
      const et = await walletClient.writeContract({address:ADDR.CURVE_POOL,abi:CURVE_ABI,functionName:"exchange",args:[ci,cj,raw,minDy]});
      const rc = await publicClient.waitForTransactionReceipt({hash:et});
      await fetchChain();
      const tp = parseFloat(formatUnits(eo,6))-amt;
      const tr = {id:Date.now(),dir,amount:amt,profit:tp.toFixed(4),ok:rc.status==="success",txHash:et,ts:new Date().toLocaleTimeString(),block:rc.blockNumber?.toString()};
      tradesR.current = [tr,...tradesR.current.slice(0,49)];
      setTrades([...tradesR.current]);
      if (rc.status==="success") { setProfit(p=>p+tp); log("✓ profit:+"+tp.toFixed(4)+" USDC","ok"); }
      else log("✗ reverted","err");
    } catch(e) { log("取引エラー:"+(e.shortMessage||e.message).slice(0,80),"err"); }
    executingR.current = false;
  },[walletClient,address,publicClient,fetchChain,log]);

  // AI loop — deps=[running] only
  useEffect(() => {
    log("AI ループ開始","sys");
    const id = setInterval(async () => {
      if (analyzingR.current||executingR.current) return;
      analyzingR.current = true;
      log("AI 分析中...","info");
      try {
        const dec = await askAI({
          curveRate: poolR.current.curveRate,
          stablefxRate: sfxR.current,
          usdc: balR.current.usdc?.toFixed(2)??"0",
          eurc: balR.current.eurc?.toFixed(2)??"0",
          mode: modeR.current,
        });
        setAi(dec);
        log(`AI → ${dec.action} [${Math.round((dec.confidence||0)*100)}%]: ${dec.reason}`,dec.action==="TRADE"?"trade":"info");
        if (dec.action==="TRADE"&&modeR.current!=="manual"&&dec.amountUSDC>0)
          await execTrade(dec.direction,dec.amountUSDC,dec.slippageBps??50);
      } catch(e) { log("AI err:"+e.message,"err"); }
      analyzingR.current = false;
    },30000);
    return ()=>clearInterval(id);
  },[running]);

  // price ticker
  useEffect(() => {
    fetchChain();
    const id = setInterval(fetchChain,8000);
    return ()=>clearInterval(id);
  },[running,isConnected,fetchChain]);

  // init
  useEffect(() => {
      log("Arc Testnet 接続完了 (Chain 5042002)","sys");
      log(`Curve Pool: ${ADDR.CURVE_POOL}`,"addr");
      fetchChain();
    }
  },[isConnected,wrongChain,fetchChain,log]);

  // sync modeRef
  useEffect(()=>{ modeR.current=mode; },[mode]);

  useEffect(()=>{ logsEndRef.current?.scrollIntoView({behavior:"smooth"}); },[logs]);

  const spread = pool.curveRate&&sfxRate ? Math.abs(pool.curveRate-sfxRate)*100 : 0;
  const hasOpp = spread>0.08;
  const okCount = trades.filter(t=>t.ok).length;

  return (
    <>
      <Head><title>ARB Agent</title></Head>
      <div className="min-h-screen bg-gray-950 text-gray-300 font-mono text-xs">
        {wrongChain&&<div className="bg-red-950 border-b border-red-800 px-4 py-2 text-red-300">⚠️ Arc Testnet (5042002) に切替えてください</div>}
        <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center font-bold text-white">⊛</div>
            <div>
              <div className="text-sm font-bold text-white tracking-widest">ARB AGENT</div>
              <div className="text-gray-600 text-[10px]">EURC/USDC · ARC TESTNET · CURVE</div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-wrap justify-end">
            {["manual","conservative","balanced","aggressive"].map(m=>(
              <button key={m} onClick={()=>setMode(m)} className={`px-2 py-1 rounded text-[10px] uppercase border ${mode===m?"border-blue-500 bg-blue-950 text-blue-400":"border-gray-800 text-gray-600"}`}>{m}</button>
            ))}
            <div className="w-px h-5 bg-gray-800 mx-1"/>
              : <span className="text-gray-700">ウォレット未接続</span>}
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              {label:"USDC残高",val:balances.usdc!=null?balances.usdc.toFixed(2):"—",unit:"USDC",color:"text-blue-400"},
              {label:"EURC残高",val:balances.eurc!=null?balances.eurc.toFixed(2):"—",unit:"EURC",color:"text-emerald-400"},
              {label:"Curveレート",val:pool.curveRate?.toFixed(6)??"—",unit:"USDC/EURC",color:"text-yellow-400"},
              {label:"スプレッド",val:spread>0?spread.toFixed(4):"—",unit:"%",color:hasOpp?"text-green-400":"text-gray-600"},
              {label:"累積利益",val:(profit>=0?"+":"")+profit.toFixed(4),unit:"USDC",color:profit>0?"text-green-400":profit<0?"text-red-400":"text-gray-500"},
            ].map(s=>(
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
              <div className={`flex justify-between items-center p-3 rounded-md border ${hasOpp?"border-yellow-900 bg-yellow-950/20":"border-gray-800 bg-gray-950"}`}>
                <div>
                  <div className="text-yellow-400 font-bold">Curve Finance</div>
                  <div className="text-gray-700 text-[10px]">{ADDR.CURVE_POOL.slice(0,10)}… fee:{pool.fee?.toFixed(2)??"—"}%</div>
                  {pool.liqU&&<div className="text-gray-700 text-[10px]">TVL:{pool.liqU.toFixed(0)}/{pool.liqE?.toFixed(0)}</div>}
                </div>
                <div className="text-right">
                  <div className="text-yellow-300 font-bold">{pool.curveRate?.toFixed(6)??"—"}</div>
                  <div className="text-gray-700 text-[10px]">USDC/EURC</div>
                </div>
              </div>
              <div className="flex justify-between items-center p-3 rounded-md border border-gray-800 bg-gray-950">
                <div>
                  <div className="text-blue-400 font-bold">StableFX RFQ</div>
                  <div className="text-gray-700 text-[10px]">{ADDR.STABLEFX_ESCROW.slice(0,10)}…</div>
                </div>
                <div className="text-right">
                  <div className="text-blue-300 font-bold">{sfxRate?.toFixed(6)??"—"}</div>
                  <div className="text-gray-700 text-[10px]">USDC/EURC</div>
                </div>
              </div>
              {hasOpp&&<div className="text-green-400 text-[10px] text-right animate-pulse">▲ ARB OPPORTUNITY — {spread.toFixed(4)}%</div>}
              <div className="text-gray-800 text-[9px] text-right">tick #{tick}</div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="text-gray-700 text-[9px] tracking-widest uppercase font-bold mb-3">AI DECISION</div>
                ? <div className="text-gray-700 text-center py-8">{running?"分析中...(30秒周期)":"▶ START を押してください"}</div>
                : <div className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${ai.action==="TRADE"?"bg-yellow-950 border-yellow-800 text-yellow-400":"bg-gray-950 border-gray-800 text-gray-600"}`}>{ai.action}</span>
                      {ai.confidence>0&&<span className="text-green-400 text-[10px]">信頼度{Math.round(ai.confidence*100)}%</span>}
                    </div>
                    {ai.action==="TRADE"&&(
                      <div className="bg-gray-950 border border-gray-800 rounded p-3 space-y-1">
                        {[["方向",ai.direction?.replace(/_/g," "),"text-yellow-400"],["金額",ai.amountUSDC+" USDC","text-gray-300"],["予想利益","+"+ai.expectedProfit+" USDC","text-green-400"],["ガス","USDC(Arc)","text-blue-400"]].map(([k,v,c])=>(
                          <div key={k} className="flex justify-between text-[11px]"><span className="text-gray-600">{k}</span><span className={c}>{v}</span></div>
                        ))}
                      </div>
                    )}
                    <div className="text-gray-600 text-[11px] italic">&ldquo;{ai.reason}&rdquo;</div>
                    {mode==="manual"&&ai.action==="TRADE"&&(
                        className="w-full py-2 bg-yellow-950 border border-yellow-800 text-yellow-400 rounded text-xs font-bold disabled:opacity-40">⚡ 手動実行</button>
                    )}
                  </div>
              }
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-gray-700 text-[9px] tracking-widest uppercase font-bold mb-3">取引履歴 · {trades.length}件 · 成功{okCount}件 · 累積{profit>=0?"+":""}{profit.toFixed(4)} USDC</div>
            {trades.length===0
              ? <div className="text-gray-800 text-center py-4">取引なし</div>
              : <div className="overflow-x-auto"><table className="w-full text-[11px]">
                  <thead><tr className="text-gray-700 border-b border-gray-800">{["時刻","方向","金額","利益","TX","状態"].map(h=><th key={h} className="text-left px-2 py-1 font-normal">{h}</th>)}</tr></thead>
                  <tbody>{trades.map(t=>(
                    <tr key={t.id} className="border-b border-gray-900">
                      <td className="px-2 py-1 text-gray-700">{t.ts}</td>
                      <td className="px-2 py-1 text-yellow-500 text-[10px]">{t.dir?.replace(/_/g," ")}</td>
                      <td className="px-2 py-1">{t.amount}</td>
                      <td className={`px-2 py-1 ${t.ok?"text-green-400":"text-red-400"}`}>{t.ok?`+${t.profit}`:"—"}</td>
                      <td className="px-2 py-1">{t.txHash?<a href={`https://testnet.arcscan.app/tx/${t.txHash}`} target="_blank" rel="noreferrer" className="text-blue-700 underline">{t.txHash.slice(0,10)}…</a>:"—"}</td>
                      <td className={`px-2 py-1 font-bold ${t.ok?"text-green-400":"text-red-400"}`}>{t.ok?"✓":"✗"}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
            }
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-gray-700 text-[9px] tracking-widest uppercase font-bold mb-2">エージェントログ</div>
            <div className="h-40 overflow-y-auto space-y-0.5 leading-6">
              {logs.map((l,i)=>(
                <div key={i} className="flex gap-3">
                  <span className="text-gray-800 shrink-0">{l.ts}</span>
                  <span className={{info:"text-sky-400",ok:"text-green-400",err:"text-red-400",trade:"text-yellow-400",sys:"text-purple-400",addr:"text-gray-700"}[l.type]||"text-gray-500"}>{l.msg}</span>
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
