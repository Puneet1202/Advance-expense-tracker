/**
 * useImportStatement.js
 * Yeh custom hook AI import ka poora logic handle karta hai.
 * State: loading, error, success, selectedFile, selectedAccountId
 * Actions: handleFileChange, handleSubmit, reset
 */

import { useState } from 'react';
import { uploadStatement, confirmBalance } from './importApi';

export function useImportStatement({ accounts, onSuccess }) {
  const [selectedFile, setSelectedFile]         = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [isLoading, setIsLoading]               = useState(false);
  const [error, setError]                       = useState(null);
  const [result, setResult]                     = useState(null);
  // Balance confirmation step: null jab tak import na ho, phir { closing_balance, account_name, account_id } 
  const [pendingBalance, setPendingBalance]      = useState(null);
  const [balanceLoading, setBalanceLoading]      = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setError(null);
    setResult(null);

    if (!file) { setSelectedFile(null); return; }

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'pdf'].includes(ext)) {
      setError('Sirf CSV ya PDF file allowed hai.');
      setSelectedFile(null);
      return;
    }

    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      setError('File 10MB se badi hai. Choti file try karo.');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = async () => {
    if (!selectedFile) { setError('Pehle file select karo.'); return; }
    if (!selectedAccountId) { setError('Account select karo.'); return; }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await uploadStatement(selectedFile, selectedAccountId);
      setResult(data);
      // Balance confirm karne ke baad hi dashboard refresh hoga
      if (data.closing_balance != null) {
        setPendingBalance({
          closing_balance: data.closing_balance,
          account_name: data.account_name,
          account_id: data.account_id,
        });
      } else {
        onSuccess?.(); // Agar balance nahi aya to seedha refresh
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Import fail ho gaya. Retry karo.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setSelectedFile(null);
    setSelectedAccountId('');
    setError(null);
    setResult(null);
    setPendingBalance(null);
    setBalanceLoading(false);
    setIsLoading(false);
  };

  // User ne "Yes" dabaya — balance adjust karo
  const handleBalanceConfirm = async () => {
    if (!pendingBalance) return;
    setBalanceLoading(true);
    try {
      await confirmBalance(pendingBalance.account_id, pendingBalance.closing_balance);
    } catch (err) {
      // Silent fail — balance adjustment optional hai
      console.warn('Balance adjust failed:', err.message);
    } finally {
      setBalanceLoading(false);
      setPendingBalance(null);
      onSuccess?.(); // Ab dashboard refresh karo
    }
  };

  // User ne "No" dabaya — balance mat badlo, sirf refresh karo
  const handleBalanceSkip = () => {
    setPendingBalance(null);
    onSuccess?.();
  };

  return {
    selectedFile,
    selectedAccountId,
    setSelectedAccountId,
    isLoading,
    error,
    result,
    pendingBalance,
    balanceLoading,
    handleFileChange,
    handleSubmit,
    handleBalanceConfirm,
    handleBalanceSkip,
    reset,
  };
}
