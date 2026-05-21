import Layout from '../components/Layout';
import { useVault, VAULT_ADDRESS } from '../components/useVault';
import { formatUnits } from 'viem';

export default function DashboardPage() {
  const { isConnected, vaultStats, userValue, userShares, amount, setAmount, handleDeposit, handleWithdraw, status } = useVault();
  const fmt6 = v => v ? Number(formatUnits(v, 6)).toFixed(2) : '0.00';
  const fmt8 = v => v ? Number(formatUnits(v, 8)).toFixed(6) : '0.000000';

  const isHoldingBTC = vaultStats?.[4];
  const usdcBal = fmt6(vaultStats?.[0]);
  const btcBal = fmt8(vaultStats?.[1]);
  const totalTrades = vaultStats?.[3]?.toString() ?? '0';

  return (
    <Layout>
      <div className="space-y-4">

        {/* Your Portfolio */}
        {isConnected ? (
          <>
            <div className="bg-gradient-to-r from-green-900 to-teal-900 rounded-2xl p-5">
              <p className="text-gray-300 text-sm mb-1">Your Total Value</p>
              <p className="text-4xl font-bold">{fmt6(userValue)}</p>
              <p className="text-gray-300 text-lg">USDC</p>
              <p className="text-gray-400 text-xs mt-2">Shares: {userShares?.toString() ?? '0'}</p>
            </div>

            {/* Position Status */}
            <div className="bg-gray-800 rounded-2xl p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Current Position</p>
              <div className={`rounded-xl p-4 ${isHoldingBTC ? 'bg-orange-900 bg-opacity-40 border border-orange-800' : 'bg-green-900 bg-opacity-40 border border-green-800'}`}>
                <p className="text-2xl font-bold mb-1">{isHoldingBTC ? '🟠 Holding cirBTC' : '🟢 Holding USDC'}</p>
                {isHoldingBTC ? (
                  <p className="text-gray-300 text-sm">cirBTC Balance: {btcBal} BTC</p>
                ) : (
                  <p className="text-gray-300 text-sm">USDC Balance: {usdcBal} USDC</p>
                )}
                <p className="text-gray-400 text-xs mt-2">Total Trades Executed: {totalTrades}</p>
              </div>
            </div>

            {/* Deposit/Withdraw */}
            <div className="bg-gray-800 rounded-2xl p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Manage Position</p>
              <input type="number" placeholder="USDC amount (min 1)" value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full bg-gray-700 rounded-xl px-4 py-3 text-white mb-3 outline-none focus:ring-2 focus:ring-green-500" />
              <div className="flex gap-2">
                <button onClick={handleDeposit} className="flex-1 bg-green-600 hover:bg-green-700 rounded-xl py-3 font-semibold transition">
                  Deposit
                </button>
                <button onClick={handleWithdraw} className="flex-1 bg-red-700 hover:bg-red-600 rounded-xl py-3 font-semibold transition">
                  Withdraw All
                </button>
              </div>
              {status && <p className="mt-3 text-sm text-center text-gray-300">{status}</p>}
            </div>
          </>
        ) : (
          <div className="bg-gray-800 rounded-2xl p-8 text-center">
            <p className="text-4xl mb-3">👛</p>
            <p className="text-gray-300 font-semibold mb-1">Connect Your Wallet</p>
            <p className="text-gray-400 text-sm">Connect to view your portfolio and manage deposits</p>
          </div>
        )}

        {/* Vault Info */}
        <div className="bg-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Vault Info</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-700">
              <span className="text-gray-400">Contract</span>
              <a href={`https://testnet.arcscan.app/address/${VAULT_ADDRESS}`} target="_blank" rel="noreferrer"
                className="text-blue-400 font-mono">0x07AD...4162 ↗</a>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-700">
              <span className="text-gray-400">Network</span>
              <span>Arc Testnet</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-700">
              <span className="text-gray-400">DEX</span>
              <span>Curve Finance</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-400">Powered by</span>
              <span>x402 + AgentKit</span>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
