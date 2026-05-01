/**
 * useImportStatement.js
 * Yeh custom hook AI import ka poora logic handle karta hai.
 * State: loading, error, success, selectedFile, selectedAccountId
 * Actions: handleFileChange, handleSubmit, reset
 */

import { useState } from 'react';
import { uploadStatement } from './importApi';

export function useImportStatement({ accounts, onSuccess }) {
  const [selectedFile, setSelectedFile]         = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [isLoading, setIsLoading]               = useState(false);
  const [error, setError]                       = useState(null);
  const [result, setResult]                     = useState(null); // Success result

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
      onSuccess?.(); // Dashboard refresh karo
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
    setIsLoading(false);
  };

  return {
    selectedFile,
    selectedAccountId,
    setSelectedAccountId,
    isLoading,
    error,
    result,
    handleFileChange,
    handleSubmit,
    reset,
  };
}
