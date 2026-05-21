import Layout from '../components/Layout';
import { useVault } from '../components/useVault';
import DepositWithdraw from '../components/DepositWithdraw';
import { formatUnits } from 'viem';

export default function DCAPage() {
  const vaultData = useVault();
  const { isConnected, vaultStats, userValue } = vaultData;
  const fmt6 = v => v ? Number(formatUnits(v, 6)).toFixed(2) : '0.00';

  return (
    <Layout>
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-purple-600 to-pink-700 rounded-2xl p-5">
          <p className="text-xs text-purple-200 mb-1">DCA STRATEGY</p>
          <h2 className="text-xl font-bold">Fear & Greed DCA</h2>
          <p className="text-purple-200 text-sm mt-1">Buy the fear · Sell the greed · Daily execution</p>
        </div>
        <div className="bg-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Strategy Rules</p>
          <div className="space-y-3">
            <div className="bg-red-900 bg-opacity-40 border border-red-800 rounded-xl p-3">
              <p className="text-red-400 font-semibold text-sm">🚨 All-in Buy</p>
              <p className="text-gray-300 text-sm mt-1">Price ≤ $61,884 (Electricity cost floor)</p>
            </div>
            <div className="bg-yellow-900 bg-opacity-40 border border-yellow-800 rounded-xl p-3">
              <p className="text-yellow-400 font-semibold text-sm">📉 DCA 5% / day</p>
              <p className="text-gray-300 text-sm mt-1">Price ≤ $74,263 AND F&G ≤ 30</p>
            </div>
            <div className="bg-green-900 bg-opacity-40 border border-green-800 rounded-xl p-3">
              <p className="text-green-400 font-semibold text-sm">📈 DCA 2% / day</p>
              <p className="text-gray-300 text-sm mt-1">Price {'>'} $74,263 OR F&G {'<'} 30</p>
            </div>
            <div className="bg-blue-900 bg-opacity-40 border border-blue-800 rounded-xl p-3">
              <p className="text-blue-400 font-semibold text-sm">💰 Take Profit</p>
              <p className="text-gray-300 text-sm mt-1">F&G ≥ 75 (Extreme Greed) → Sell all</p>
            </div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-3 pt-3 border-t border-gray-700">
            <span>⏰ Every 24 hours</span>
            <span>⛏️ Mining cost updated weekly</span>
          </div>
        </div>
        <div className="bg-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Vault Status</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-700 rounded-xl p-3">
              <p className="text-gray-400 text-xs">USDC</p>
              <p className="text-xl font-bold">{fmt6(vaultStats?.[0])}</p>
            </div>
            <div className="bg-gray-700 rounded-xl p-3">
              <p className="text-gray-400 text-xs">Trades</p>
              <p className="text-xl font-bold">{vaultStats?.[3]?.toString() ?? '0'}</p>
            </div>
          </div>
        </div>
        {isConnected && (
          <div className="bg-gradient-to-r from-purple-900 to-pink-900 rounded-2xl p-5">
            <p className="text-gray-300 text-sm">Your Position</p>
            <p className="text-3xl font-bold mt-1">{fmt6(userValue)} <span className="text-lg text-gray-300">USDC</span></p>
          </div>
        )}
        <DepositWithdraw useVaultData={vaultData} accentColor="purple" />
      </div>
    </Layout>
  );
}
