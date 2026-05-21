import { formatUnits, parseUnits } from 'viem';

export default function DepositWithdraw({ useVaultData, accentColor = 'blue' }) {
  const {
    isConnected, walletUSDC, userValue, userShares,
    amount, setAmount, status, handleDeposit, handleWithdraw,
  } = useVaultData;

  const walletBal = walletUSDC ? Number(formatUnits(walletUSDC, 6)) : 0;
  const vaultBal = userValue ? Number(formatUnits(userValue, 6)) : 0;

  const setPercent = (pct) => {
    const val = (walletBal * pct / 100).toFixed(2);
    setAmount(val);
  };

  const colorMap = {
    blue: {
      btn: 'bg-blue-600 hover:bg-blue-700',
      pct: 'bg-blue-900 hover:bg-blue-800 text-blue-300',
      ring: 'focus:ring-blue-500',
    },
    purple: {
      btn: 'bg-purple-600 hover:bg-purple-700',
      pct: 'bg-purple-900 hover:bg-purple-800 text-purple-300',
      ring: 'focus:ring-purple-500',
    },
    green: {
      btn: 'bg-green-600 hover:bg-green-700',
      pct: 'bg-green-900 hover:bg-green-800 text-green-300',
      ring: 'focus:ring-green-500',
    },
  };
  const c = colorMap[accentColor] || colorMap.blue;

  if (!isConnected) {
    return (
      <div className="bg-gray-800 rounded-2xl p-5 text-center">
        <p className="text-gray-400">Connect your wallet to deposit</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-2xl p-5 space-y-4">

      {/* Deposit Section */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Deposit</p>
          <p className="text-xs text-gray-400">Wallet: <span className="text-white font-semibold">{walletBal.toFixed(2)} USDC</span></p>
        </div>

        {/* Percent Buttons */}
        <div className="flex gap-2 mb-2">
          {[10, 25, 50, 100].map(pct => (
            <button
              key={pct}
              onClick={() => setPercent(pct)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${c.pct}`}
            >
              {pct === 100 ? 'MAX' : `${pct}%`}
            </button>
          ))}
        </div>

        <div className="relative">
          <input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className={`w-full bg-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 ${c.ring} pr-16`}
          />
          <span className="absolute right-4 top-3 text-gray-400 text-sm">USDC</span>
        </div>

        <button
          onClick={handleDeposit}
          className={`w-full ${c.btn} rounded-xl py-3 font-semibold transition mt-2`}
        >
          Deposit
        </button>
      </div>

      <div className="border-t border-gray-700" />

      {/* Withdraw Section */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Withdraw</p>
          <p className="text-xs text-gray-400">Vault: <span className="text-white font-semibold">{vaultBal.toFixed(2)} USDC</span></p>
        </div>

        {/* Percent Buttons */}
        <div className="flex gap-2">
          {[10, 25, 50, 100].map(pct => (
            <button
              key={pct}
              onClick={() => handleWithdraw(pct)}
              className="flex-1 py-2 rounded-lg text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-gray-300 transition"
            >
              <span className="block">{pct === 100 ? 'ALL' : `${pct}%`}</span>
              <span className="block text-gray-400 text-xs mt-0.5">
                {pct === 100 ? `${vaultBal.toFixed(2)}` : `${(vaultBal * pct / 100).toFixed(2)}`}
              </span>
            </button>
          ))}
        </div>
      </div>

      {status && <p className="text-sm text-center text-gray-300 pt-2">{status}</p>}
    </div>
  );
}
