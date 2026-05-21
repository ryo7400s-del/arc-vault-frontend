import Layout from '../components/Layout';
import { useVault } from '../components/useVault';
import DepositWithdraw from '../components/DepositWithdraw';
import { formatUnits } from 'viem';

export default function ActivePage() {
  const vaultData = useVault();
  const { isConnected, vaultStats, userValue } = vaultData;
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
              <p className="text-xl font-bold">{fmt6(vaultStats?.[0])}</p>
            </div>
            <div className="bg-gray-700 rounded-xl p-3">
              <p className="text-gray-400 text-xs">cirBTC</p>
              <p className="text-xl font-bold">{fmt8(vaultStats?.[1])}</p>
            </div>
            <div className="bg-gray-700 rounded-xl p-3">
              <p className="text-gray-400 text-xs">Trades</p>
              <p className="text-xl font-bold">{vaultStats?.[3]?.toString() ?? '0'}</p>
            </div>
            <div className="bg-gray-700 rounded-xl p-3">
              <p className="text-gray-400 text-xs">Position</p>
              <p className="text-lg font-bold">{vaultStats ? (vaultStats[4] ? '🟠 BTC' : '🟢 USDC') : '-'}</p>
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
        <DepositWithdraw useVaultData={vaultData} accentColor="blue" />
      </div>
    </Layout>
  );
}
