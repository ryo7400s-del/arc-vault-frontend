import Layout from '../components/Layout';
import { useVault } from '../components/useVault';
import { formatUnits } from 'viem';

export default function ActivePage() {
  const { isConnected, vaultStats, userValue, amount, setAmount, handleDeposit, handleWithdraw, status } = useVault();
  const fmt6 = v => v ? Number(formatUnits(v, 6)).toFixed(2) : '0.00';
  const fmt8 = v => v ? Number(formatUnits(v, 8)).toFixed(6) : '0.000000';

  return (
    <Layout>
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-5">
          <p className="text-xs text-blue-200 mb-1">ACTIVE STRATEGY</p>
          <h2 className="text-xl font-bold">Taker + RSI</h2>
          <p className="text-blue-200 text-sm mt-1">AI-powered momentum trading · Every 4 hours</p>
        </div>
        <div className="bg-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Vault Status</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-700 rounded-xl p-3">
              <p className="text-gray-400 text-xs">USDC</p>
              <p className="text-xl font-bold">{isConnected ? fmt6(vaultStats?.[0]) : "-.--"}</p>
            </div>
            <div className="bg-gray-700 rounded-xl p-3">
              <p className="text-gray-400 text-xs">cirBTC</p>
              <p className="text-xl font-bold">{isConnected ? fmt8(vaultStats?.[1]) : "-.------"}</p>
            </div>
            <div className="bg-gray-700 rounded-xl p-3">
              <p className="text-gray-400 text-xs">Trades</p>
              <p className="text-xl font-bold">{isConnected ? vaultStats?.[3]?.toString() ?? '0' : '-'}</p>
            </div>
            <div className="bg-gray-700 rounded-xl p-3">
              <p className="text-gray-400 text-xs">Position</p>
              <p className="text-lg font-bold">{isConnected ? (vaultStats ? (vaultStats[4] ? '🟠 BTC' : '🟢 USDC') : '-') : '-'}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Strategy Rules</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-700">
              <span className="text-gray-400">Buy</span>
              <span className="text-green-400 text-right">Taker Buy ≥ 2x + RSI ≤ 50</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-700">
              <span className="text-gray-400">Sell</span>
              <span className="text-red-400">Daily RSI ≥ 72</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-700">
              <span className="text-gray-400">Interval</span>
              <span>Every 4 hours</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-400">DEX</span>
              <span>Curve Finance · Arc</span>
            </div>
          </div>
        </div>
        {isConnected && (
          <div className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-2xl p-5">
            <p className="text-gray-300 text-sm">Your Position</p>
            <p className="text-3xl font-bold mt-1">{fmt6(userValue)} <span className="text-lg text-gray-300">USDC</span></p>
          </div>
        )}
        {isConnected ? (
          <div className="bg-gray-800 rounded-2xl p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Deposit / Withdraw</p>
            <input type="number" placeholder="USDC amount (min 1)" value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full bg-gray-700 rounded-xl px-4 py-3 text-white mb-3 outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="flex gap-2">
              <button onClick={handleDeposit} className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-xl py-3 font-semibold transition">Deposit</button>
              <button onClick={handleWithdraw} className="flex-1 bg-gray-600 hover:bg-gray-500 rounded-xl py-3 font-semibold transition">Withdraw All</button>
            </div>
            {status && <p className="mt-3 text-sm text-center text-gray-300">{status}</p>}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-2xl p-5 text-center">
            <p className="text-gray-400">Connect your wallet to deposit</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
