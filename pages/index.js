import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { useState } from 'react';

const VAULT_ADDRESS = '0x07AD7bDE86371B5c28e0f0532fF52097d0D14162';
const USDC_ADDRESS = '0x3600000000000000000000000000000000000000';

const VAULT_ABI = [
  { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'shares', type: 'uint256' }], outputs: [] },
  { name: 'getUserValue', type: 'function', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'userShares', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'getVaultStats', type: 'function', stateMutability: 'view', inputs: [], outputs: [
    { name: 'usdcBalance', type: 'uint256' },
    { name: 'btcBalance', type: 'uint256' },
    { name: 'totalShares', type: 'uint256' },
    { name: 'totalTrades', type: 'uint256' },
    { name: 'isHoldingBTC', type: 'bool' },
  ]},
];

const ERC20_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
];

// ── タブコンテンツ ──────────────────────────────────

function ActiveTab({ vaultStats, userValue, userShares, amount, setAmount, handleDeposit, handleWithdraw, status, isConnected }) {
  return (
    <div className="space-y-4">
      {/* Vault Stats */}
      <div className="bg-gray-800 rounded-2xl p-5">
        <h2 className="text-sm text-gray-400 mb-3 uppercase tracking-wider">Vault Statistics</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-700 rounded-xl p-3">
            <p className="text-gray-400 text-xs mb-1">USDC Balance</p>
            <p className="text-xl font-bold">{vaultStats ? Number(formatUnits(vaultStats[0], 6)).toFixed(2) : '0.00'}</p>
            <p className="text-gray-400 text-xs">USDC</p>
          </div>
          <div className="bg-gray-700 rounded-xl p-3">
            <p className="text-gray-400 text-xs mb-1">cirBTC Balance</p>
            <p className="text-xl font-bold">{vaultStats ? Number(formatUnits(vaultStats[1], 8)).toFixed(6) : '0.000000'}</p>
            <p className="text-gray-400 text-xs">BTC</p>
          </div>
          <div className="bg-gray-700 rounded-xl p-3">
            <p className="text-gray-400 text-xs mb-1">Total Trades</p>
            <p className="text-xl font-bold">{vaultStats ? vaultStats[3].toString() : '0'}</p>
          </div>
          <div className="bg-gray-700 rounded-xl p-3">
            <p className="text-gray-400 text-xs mb-1">Position</p>
            <p className="text-lg font-bold">{vaultStats ? (vaultStats[4] ? '🟠 BTC' : '🟢 USDC') : '-'}</p>
          </div>
        </div>
      </div>

      {/* Strategy Info */}
      <div className="bg-gray-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-blue-600 text-xs px-2 py-1 rounded-full">ACTIVE</span>
          <h2 className="text-sm font-semibold">Taker + RSI Strategy</h2>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Buy Signal</span>
            <span className="text-green-400">Taker Buy ≥ 2x + RSI ≤ 50</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Sell Signal</span>
            <span className="text-red-400">Daily RSI ≥ 72</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Execution</span>
            <span className="text-white">Every 4 hours</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">DEX</span>
            <span className="text-white">Curve Finance on Arc</span>
          </div>
        </div>
      </div>

      {/* User Position */}
      {isConnected && (
        <div className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-2xl p-5">
          <p className="text-gray-300 text-sm mb-1">Your Position</p>
          <p className="text-3xl font-bold">{userValue ? Number(formatUnits(userValue, 6)).toFixed(2) : '0.00'} <span className="text-lg text-gray-300">USDC</span></p>
        </div>
      )}

      {/* Deposit/Withdraw */}
      {isConnected ? (
        <div className="bg-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold mb-3">Deposit / Withdraw</h2>
          <input
            type="number"
            placeholder="USDC amount (min 1)"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full bg-gray-700 rounded-xl px-4 py-3 text-white mb-3 outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button onClick={handleDeposit} className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-xl py-3 font-semibold transition">
              Deposit
            </button>
            <button onClick={handleWithdraw} className="flex-1 bg-gray-600 hover:bg-gray-500 rounded-xl py-3 font-semibold transition">
              Withdraw All
            </button>
          </div>
          {status && <p className="mt-3 text-sm text-center text-gray-300">{status}</p>}
        </div>
      ) : (
        <div className="bg-gray-800 rounded-2xl p-5 text-center">
          <p className="text-gray-400">Connect your wallet to deposit</p>
        </div>
      )}
    </div>
  );
}

function DCATab({ vaultStats, userValue, amount, setAmount, handleDeposit, handleWithdraw, status, isConnected }) {
  return (
    <div className="space-y-4">
      {/* Vault Stats */}
      <div className="bg-gray-800 rounded-2xl p-5">
        <h2 className="text-sm text-gray-400 mb-3 uppercase tracking-wider">Vault Statistics</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-700 rounded-xl p-3">
            <p className="text-gray-400 text-xs mb-1">USDC Balance</p>
            <p className="text-xl font-bold">{vaultStats ? Number(formatUnits(vaultStats[0], 6)).toFixed(2) : '0.00'}</p>
            <p className="text-gray-400 text-xs">USDC</p>
          </div>
          <div className="bg-gray-700 rounded-xl p-3">
            <p className="text-gray-400 text-xs mb-1">Total Trades</p>
            <p className="text-xl font-bold">{vaultStats ? vaultStats[3].toString() : '0'}</p>
          </div>
        </div>
      </div>

      {/* DCA Strategy */}
      <div className="bg-gray-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-purple-600 text-xs px-2 py-1 rounded-full">DCA</span>
          <h2 className="text-sm font-semibold">Fear & Greed Strategy</h2>
        </div>
        <div className="space-y-3 text-sm">
          <div className="bg-gray-700 rounded-xl p-3">
            <p className="text-red-400 font-semibold mb-1">🚨 All-in Condition</p>
            <p className="text-gray-300">Price ≤ $61,884 (Electricity cost floor)</p>
          </div>
          <div className="bg-gray-700 rounded-xl p-3">
            <p className="text-yellow-400 font-semibold mb-1">📉 DCA 5%</p>
            <p className="text-gray-300">Price ≤ $74,263 AND F&G ≤ 30</p>
          </div>
          <div className="bg-gray-700 rounded-xl p-3">
            <p className="text-green-400 font-semibold mb-1">📈 DCA 2%</p>
            <p className="text-gray-300">Price {'>'} $74,263 OR F&G {'<'} 30</p>
          </div>
          <div className="bg-gray-700 rounded-xl p-3">
            <p className="text-blue-400 font-semibold mb-1">💰 Take Profit</p>
            <p className="text-gray-300">F&G ≥ 75 (Extreme Greed)</p>
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>⏰ Execution: Every 24 hours</span>
            <span>⛏️ Cost updated weekly</span>
          </div>
        </div>
      </div>

      {/* User Position */}
      {isConnected && (
        <div className="bg-gradient-to-r from-purple-900 to-pink-900 rounded-2xl p-5">
          <p className="text-gray-300 text-sm mb-1">Your Position</p>
          <p className="text-3xl font-bold">{userValue ? Number(formatUnits(userValue, 6)).toFixed(2) : '0.00'} <span className="text-lg text-gray-300">USDC</span></p>
        </div>
      )}

      {/* Deposit/Withdraw */}
      {isConnected ? (
        <div className="bg-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold mb-3">Deposit / Withdraw</h2>
          <input
            type="number"
            placeholder="USDC amount (min 1)"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full bg-gray-700 rounded-xl px-4 py-3 text-white mb-3 outline-none focus:ring-2 focus:ring-purple-500"
          />
          <div className="flex gap-2">
            <button onClick={handleDeposit} className="flex-1 bg-purple-600 hover:bg-purple-700 rounded-xl py-3 font-semibold transition">
              Deposit
            </button>
            <button onClick={handleWithdraw} className="flex-1 bg-gray-600 hover:bg-gray-500 rounded-xl py-3 font-semibold transition">
              Withdraw All
            </button>
          </div>
          {status && <p className="mt-3 text-sm text-center text-gray-300">{status}</p>}
        </div>
      ) : (
        <div className="bg-gray-800 rounded-2xl p-5 text-center">
          <p className="text-gray-400">Connect your wallet to deposit</p>
        </div>
      )}
    </div>
  );
}

function PerpTab() {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 space-y-4">
      <div className="text-6xl">🔮</div>
      <h2 className="text-2xl font-bold">Perp Trading</h2>
      <div className="bg-gray-800 rounded-2xl px-8 py-4">
        <p className="text-gray-400 text-center">Coming Soon</p>
      </div>
      <p className="text-gray-500 text-sm text-center max-w-xs">Perpetual futures trading powered by AI agents is under development</p>
    </div>
  );
}

function DashboardTab({ vaultStats, userValue, userShares, isConnected }) {
  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-2xl p-5">
        <h2 className="text-sm text-gray-400 mb-4 uppercase tracking-wider">Protocol Overview</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-400">Total USDC</span>
            <span className="font-semibold">{vaultStats ? Number(formatUnits(vaultStats[0], 6)).toFixed(2) : '0.00'} USDC</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-400">Total cirBTC</span>
            <span className="font-semibold">{vaultStats ? Number(formatUnits(vaultStats[1], 8)).toFixed(6) : '0.000000'} BTC</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-400">Total Trades</span>
            <span className="font-semibold">{vaultStats ? vaultStats[3].toString() : '0'}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-400">Current Position</span>
            <span className="font-semibold">{vaultStats ? (vaultStats[4] ? '🟠 Holding BTC' : '🟢 Holding USDC') : '-'}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-400">Total Shares</span>
            <span className="font-semibold">{vaultStats ? vaultStats[2].toString() : '0'}</span>
          </div>
        </div>
      </div>

      {isConnected && (
        <div className="bg-gray-800 rounded-2xl p-5">
          <h2 className="text-sm text-gray-400 mb-4 uppercase tracking-wider">Your Portfolio</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-700">
              <span className="text-gray-400">Your Value</span>
              <span className="font-semibold text-green-400">{userValue ? Number(formatUnits(userValue, 6)).toFixed(2) : '0.00'} USDC</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-400">Your Shares</span>
              <span className="font-semibold">{userShares ? userShares.toString() : '0'}</span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-800 rounded-2xl p-5">
        <h2 className="text-sm text-gray-400 mb-4 uppercase tracking-wider">Contract Info</h2>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Vault</span>
            <span className="text-blue-400 font-mono">0x07AD...4162</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Network</span>
            <span>Arc Testnet</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">DEX</span>
            <span>Curve Finance</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Powered by</span>
            <span>x402 + AgentKit</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── メインコンポーネント ──────────────────────────────

export default function Home() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState('active');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');

  const { data: vaultStats } = useReadContract({
    address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'getVaultStats', watch: true,
  });
  const { data: userValue } = useReadContract({
    address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'getUserValue',
    args: [address], enabled: !!address, watch: true,
  });
  const { data: userShares } = useReadContract({
    address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'userShares',
    args: [address], enabled: !!address, watch: true,
  });
  const { writeContractAsync } = useWriteContract();

  const handleDeposit = async () => {
    if (!amount) return;
    try {
      setStatus('⏳ Approving USDC...');
      const parsedAmount = parseUnits(amount, 6);
      await writeContractAsync({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'approve', args: [VAULT_ADDRESS, parsedAmount] });
      setStatus('⏳ Depositing...');
      await writeContractAsync({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'deposit', args: [parsedAmount] });
      setStatus('✅ Deposit successful!');
      setAmount('');
    } catch (e) { setStatus('❌ ' + e.message.slice(0, 80)); }
  };

  const handleWithdraw = async () => {
    if (!userShares) return;
    try {
      setStatus('⏳ Withdrawing...');
      await writeContractAsync({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'withdraw', args: [userShares] });
      setStatus('✅ Withdrawal successful!');
    } catch (e) { setStatus('❌ ' + e.message.slice(0, 80)); }
  };

  const tabs = [
    { id: 'active', label: 'Active', icon: '📈' },
    { id: 'dca', label: 'DCA', icon: '😱' },
    { id: 'perp', label: 'Perp', icon: '🔮' },
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="flex justify-between items-center max-w-lg mx-auto">
          <div>
            <h1 className="text-lg font-bold">🤖 Arc Agent Vault</h1>
            <p className="text-gray-400 text-xs">AI-Powered Trading on Arc Testnet</p>
          </div>
          <ConnectButton />
        </div>
      </div>

      {/* Top Tabs */}
      <div className="sticky top-16 z-10 bg-gray-900 border-b border-gray-800 px-4">
        <div className="flex max-w-lg mx-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setStatus(''); }}
              className={`flex-1 py-3 text-sm font-semibold border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-gray-400'
              }`}
            >
              <span className="mr-1">{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 max-w-lg mx-auto w-full pb-24">
        {activeTab === 'active' && (
          <ActiveTab
            vaultStats={vaultStats} userValue={userValue} userShares={userShares}
            amount={amount} setAmount={setAmount}
            handleDeposit={handleDeposit} handleWithdraw={handleWithdraw}
            status={status} isConnected={isConnected}
          />
        )}
        {activeTab === 'dca' && (
          <DCATab
            vaultStats={vaultStats} userValue={userValue}
            amount={amount} setAmount={setAmount}
            handleDeposit={handleDeposit} handleWithdraw={handleWithdraw}
            status={status} isConnected={isConnected}
          />
        )}
        {activeTab === 'perp' && <PerpTab />}
        {activeTab === 'dashboard' && (
          <DashboardTab
            vaultStats={vaultStats} userValue={userValue}
            userShares={userShares} isConnected={isConnected}
          />
        )}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-4 py-2">
        <div className="flex max-w-lg mx-auto">
          {[
            { id: 'active', icon: '📈', label: 'Active' },
            { id: 'dca', icon: '😱', label: 'DCA' },
            { id: 'perp', icon: '🔮', label: 'Perp' },
            { id: 'dashboard', icon: '📊', label: 'Dashboard' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setStatus(''); }}
              className={`flex-1 flex flex-col items-center py-2 transition ${
                activeTab === tab.id ? 'text-blue-400' : 'text-gray-500'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="text-xs mt-1">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
