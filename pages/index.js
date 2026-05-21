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

export default function Home() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState('taker');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');

  const { data: vaultStats } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'getVaultStats',
    watch: true,
  });

  const { data: userValue } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'getUserValue',
    args: [address],
    enabled: !!address,
    watch: true,
  });

  const { data: userShares } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'userShares',
    args: [address],
    enabled: !!address,
    watch: true,
  });

  const { writeContractAsync } = useWriteContract();

  const handleDeposit = async () => {
    if (!amount) return;
    try {
      setStatus('⏳ Approving USDC...');
      const parsedAmount = parseUnits(amount, 6);
      await writeContractAsync({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [VAULT_ADDRESS, parsedAmount],
      });
      setStatus('⏳ Depositing...');
      await writeContractAsync({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'deposit',
        args: [parsedAmount],
      });
      setStatus('✅ Deposit successful!');
      setAmount('');
    } catch (e) {
      setStatus('❌ Error: ' + e.message.slice(0, 100));
    }
  };

  const handleWithdraw = async () => {
    if (!userShares) return;
    try {
      setStatus('⏳ Withdrawing...');
      await writeContractAsync({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'withdraw',
        args: [userShares],
      });
      setStatus('✅ Withdrawal successful!');
    } catch (e) {
      setStatus('❌ Error: ' + e.message.slice(0, 100));
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">🤖 Arc Agent Vault</h1>
            <p className="text-gray-400 text-sm">AI-Powered Trading Vault on Arc Testnet</p>
          </div>
          <ConnectButton />
        </div>

        {/* Banner */}
        <div className="bg-blue-900 rounded-xl p-4 mb-6 text-sm">
          <p className="font-semibold text-blue-300">⚡ Powered by x402 Protocol + Coinbase AgentKit</p>
          <p className="text-gray-300 mt-1">Deposit USDC → AI agent trades automatically → Withdraw anytime</p>
        </div>

        {/* Vault Stats */}
        <div className="bg-gray-800 rounded-xl p-5 mb-6">
          <h2 className="text-lg font-semibold mb-4">📊 Vault Statistics</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-700 rounded-lg p-3">
              <p className="text-gray-400 text-xs">USDC Balance</p>
              <p className="text-xl font-bold">{vaultStats ? formatUnits(vaultStats[0], 6) : '0'} USDC</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-3">
              <p className="text-gray-400 text-xs">cirBTC Balance</p>
              <p className="text-xl font-bold">{vaultStats ? formatUnits(vaultStats[1], 8) : '0'} BTC</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-3">
              <p className="text-gray-400 text-xs">Total Trades</p>
              <p className="text-xl font-bold">{vaultStats ? vaultStats[3].toString() : '0'}</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-3">
              <p className="text-gray-400 text-xs">Position</p>
              <p className="text-xl font-bold">{vaultStats ? (vaultStats[4] ? '🟠 BTC' : '🟢 USDC') : '-'}</p>
            </div>
          </div>
        </div>

        {/* Strategy Tabs */}
        <div className="bg-gray-800 rounded-xl p-5 mb-6">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('taker')}
              className={`flex-1 py-2 rounded-lg font-semibold text-sm ${activeTab === 'taker' ? 'bg-blue-600' : 'bg-gray-700'}`}
            >
              📈 Taker+RSI
            </button>
            <button
              onClick={() => setActiveTab('dca')}
              className={`flex-1 py-2 rounded-lg font-semibold text-sm ${activeTab === 'dca' ? 'bg-purple-600' : 'bg-gray-700'}`}
            >
              😱 F&G DCA
            </button>
          </div>

          {activeTab === 'taker' && (
            <div className="bg-gray-700 rounded-lg p-3 text-sm space-y-1">
              <p className="font-semibold text-blue-300 mb-2">🧠 Active Strategy: Taker + RSI</p>
              <p className="text-green-400">✅ Buy: 1h Taker Buy Vol ≥ 2x AND Daily RSI ≤ 50</p>
              <p className="text-red-400">✅ Sell: Daily RSI ≥ 72 (Take Profit)</p>
              <p className="text-gray-400">⏰ Execution: Every 4 hours</p>
              <p className="text-gray-400">🔗 DEX: Curve Finance on Arc</p>
            </div>
          )}

          {activeTab === 'dca' && (
            <div className="bg-gray-700 rounded-lg p-3 text-sm space-y-1">
              <p className="font-semibold text-purple-300 mb-2">🧠 Active Strategy: Fear & Greed DCA</p>
              <p className="text-green-400">✅ All-in: Price ≤ $61,884 (Electricity cost)</p>
              <p className="text-green-400">✅ DCA 5%: Price ≤ $74,263 AND F&G ≤ 30</p>
              <p className="text-green-400">✅ DCA 2%: Price > $74,263 OR F&G < 30</p>
              <p className="text-red-400">✅ Sell: F&G ≥ 75 (Extreme Greed)</p>
              <p className="text-gray-400">⏰ Execution: Every 24 hours</p>
              <p className="text-gray-400">⛏️ Mining cost updated weekly</p>
            </div>
          )}
        </div>

        {/* User Balance */}
        {isConnected && (
          <div className="bg-gray-800 rounded-xl p-5 mb-6">
            <h2 className="text-lg font-semibold mb-2">💼 Your Balance</h2>
            <p className="text-2xl font-bold text-green-400">
              {userValue ? formatUnits(userValue, 6) : '0'} USDC
            </p>
          </div>
        )}

        {/* Deposit / Withdraw */}
        {isConnected ? (
          <div className="bg-gray-800 rounded-xl p-5">
            <h2 className="text-lg font-semibold mb-4">💰 Deposit / Withdraw</h2>
            <input
              type="number"
              placeholder="USDC amount (min 1)"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white mb-3"
            />
            <div className="flex gap-2">
              <button onClick={handleDeposit} className="flex-1 bg-green-600 hover:bg-green-700 rounded-lg py-3 font-semibold">
                Deposit
              </button>
              <button onClick={handleWithdraw} className="flex-1 bg-red-600 hover:bg-red-700 rounded-lg py-3 font-semibold">
                Withdraw All
              </button>
            </div>
            {status && <p className="mt-3 text-sm text-center">{status}</p>}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-xl p-5 text-center">
            <p className="text-gray-400">Connect your wallet to get started</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>Contract: {VAULT_ADDRESS}</p>
          <p className="mt-1">Built with x402 Protocol · Coinbase AgentKit · Curve Finance on Arc</p>
        </div>

      </div>
    </div>
  );
}
