import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { useState } from 'react';

const VAULT_ADDRESS = '0x06431c7834d70c520BA00D3fF2C33889E93aB7B9';
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
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
];

export default function Home() {
  const { address, isConnected } = useAccount();
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
      setStatus('⏳ Approve中...');
      const parsedAmount = parseUnits(amount, 6);
      await writeContractAsync({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [VAULT_ADDRESS, parsedAmount],
      });
      setStatus('⏳ 入金中...');
      await writeContractAsync({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'deposit',
        args: [parsedAmount],
      });
      setStatus('✅ 入金完了！');
    } catch (e) {
      setStatus('❌ エラー: ' + e.message);
    }
  };

  const handleWithdraw = async () => {
    if (!userShares) return;
    try {
      setStatus('⏳ 引き出し中...');
      await writeContractAsync({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'withdraw',
        args: [userShares],
      });
      setStatus('✅ 引き出し完了！');
    } catch (e) {
      setStatus('❌ エラー: ' + e.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-lg mx-auto">

        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold">🤖 X402AeroVault</h1>
            <p className="text-gray-400 text-sm">AI自動売買 on Arc Testnet</p>
          </div>
          <ConnectButton />
        </div>

        {/* Vault統計 */}
        <div className="bg-gray-800 rounded-xl p-5 mb-6">
          <h2 className="text-lg font-semibold mb-4">📊 Vault統計</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-700 rounded-lg p-3">
              <p className="text-gray-400 text-xs">USDC残高</p>
              <p className="text-xl font-bold">
                {vaultStats ? formatUnits(vaultStats[0], 6) : '0'} USDC
              </p>
            </div>
            <div className="bg-gray-700 rounded-lg p-3">
              <p className="text-gray-400 text-xs">cirBTC残高</p>
              <p className="text-xl font-bold">
                {vaultStats ? formatUnits(vaultStats[1], 8) : '0'} BTC
              </p>
            </div>
            <div className="bg-gray-700 rounded-lg p-3">
              <p className="text-gray-400 text-xs">総取引数</p>
              <p className="text-xl font-bold">
                {vaultStats ? vaultStats[3].toString() : '0'}
              </p>
            </div>
            <div className="bg-gray-700 rounded-lg p-3">
              <p className="text-gray-400 text-xs">現在のポジション</p>
              <p className="text-xl font-bold">
                {vaultStats ? (vaultStats[4] ? '🟠 BTC保有' : '🟢 USDC待機') : '-'}
              </p>
            </div>
          </div>
        </div>

        {/* AI戦略 */}
        <div className="bg-gray-800 rounded-xl p-5 mb-6">
          <h2 className="text-lg font-semibold mb-3">🧠 AI戦略</h2>
          <div className="bg-gray-700 rounded-lg p-3 text-sm">
            <p className="text-green-400">✅ 買い条件: 1h Taker買い ≥ 2倍 AND 日足RSI ≤ 50</p>
            <p className="text-red-400 mt-1">✅ 売り条件: 日足RSI ≥ 72（利確）</p>
            <p className="text-gray-400 mt-1">⏰ 判断頻度: 4時間ごと</p>
          </div>
        </div>

        {/* ユーザーの残高 */}
        {isConnected && (
          <div className="bg-gray-800 rounded-xl p-5 mb-6">
            <h2 className="text-lg font-semibold mb-3">💼 あなたの残高</h2>
            <p className="text-2xl font-bold text-green-400">
              {userValue ? formatUnits(userValue, 6) : '0'} USDC
            </p>
          </div>
        )}

        {/* 入金・引き出し */}
        {isConnected ? (
          <div className="bg-gray-800 rounded-xl p-5">
            <h2 className="text-lg font-semibold mb-4">💰 入金 / 引き出し</h2>
            <div className="flex gap-2 mb-4">
              <input
                type="number"
                placeholder="USDC金額 (最小1)"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="flex-1 bg-gray-700 rounded-lg px-4 py-2 text-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDeposit}
                className="flex-1 bg-green-600 hover:bg-green-700 rounded-lg py-3 font-semibold"
              >
                入金
              </button>
              <button
                onClick={handleWithdraw}
                className="flex-1 bg-red-600 hover:bg-red-700 rounded-lg py-3 font-semibold"
              >
                全額引き出し
              </button>
            </div>
            {status && <p className="mt-3 text-sm text-center">{status}</p>}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-xl p-5 text-center">
            <p className="text-gray-400">ウォレットを接続してください</p>
          </div>
        )}

      </div>
    </div>
  );
}
