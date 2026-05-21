import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { useState } from 'react';

export const VAULT_ADDRESS = '0x07AD7bDE86371B5c28e0f0532fF52097d0D14162';
export const USDC_ADDRESS = '0x3600000000000000000000000000000000000000';

export const VAULT_ABI = [
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

export const ERC20_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
];

export function useVault() {
  const { address, isConnected } = useAccount();
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

  const fmt = (val, dec) => val ? Number(formatUnits(val, dec)).toFixed(dec === 6 ? 2 : 6) : '0.00';

  return {
    address, isConnected, vaultStats, userValue, userShares,
    amount, setAmount, status, handleDeposit, handleWithdraw, fmt,
  };
}
