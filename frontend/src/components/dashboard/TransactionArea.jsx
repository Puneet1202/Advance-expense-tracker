import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { fmt } from '../../utils/formatCurrency';

// ─── Currency Conversion Utility ────────────────────────────────────────────
const CACHE_KEY = 'currency_cache'; // shared with CurrencyWidget

const CURRENCIES = [
  { code: 'INR', symbol: '₹', flag: '🇮🇳' },
  { code: 'USD', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', flag: '🇬🇧' },
  { code: 'AED', symbol: 'د.إ', flag: '🇦🇪' },
  { code: 'SAR', symbol: '﷼', flag: '🇸🇦' },
  { code: 'JPY', symbol: '¥', flag: '🇯🇵' },
  { code: 'CAD', symbol: 'C$', flag: '🇨🇦' },
  { code: 'AUD', symbol: 'A$', flag: '🇦🇺' },
  { code: 'SGD', symbol: 'S$', flag: '🇸🇬' },
];

/**
 * Returns the INR equivalent of `amount` in `fromCurrency`.
 * Uses the same localStorage cache as CurrencyWidget (12h).
 * rates object from API is INR-based: { USD: 0.01193, EUR: 0.01076, ... }
 * Meaning: 1 INR = X foreign currency
 * So: 1 foreign = 1/rate INR
 */
const convertToINR = async (amount, fromCurrency) => {
  if (fromCurrency === 'INR') return amount;

  // Try cache first
  const cached = localStorage.getItem(CACHE_KEY);
  let rates = null;
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    const CACHE_DURATION = 12 * 60 * 60 * 1000;
    if (Date.now() - timestamp < CACHE_DURATION) {
      rates = data;
    }
  }

  // Fetch if no valid cache
  if (!rates) {
    const API_KEY = import.meta.env.VITE_EXCHANGE_RATE_API_KEY;
    const res = await fetch(`https://v6.exchangerate-api.com/v6/${API_KEY}/latest/INR`);
    const json = await res.json();
    if (json.result !== 'success') throw new Error('Currency API error');
    rates = json.conversion_rates;
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data: rates, timestamp: Date.now() }));
  }

  // rates[fromCurrency] = how many foreignCurrency per 1 INR
  // So 1 foreignCurrency = 1 / rates[fromCurrency] INR
  const inrPerForeign = 1 / rates[fromCurrency];
  return parseFloat((amount * inrPerForeign).toFixed(2));
};
// ────────────────────────────────────────────────────────────────────────────

const TransactionArea = ({ trackerData, fetchTrackerData, selectedAccountId, setSelectedAccountId, currentMonth }) => {
  const { total_income, total_expenses, expense_limit, is_saving_mode, transactions, accounts } = trackerData;
  
  const [txnForm, setTxnForm] = useState({ 
    type: 'expense', amount: '', description: '', account_id: '', currency: 'INR' 
  });
  const [inrPreview, setInrPreview] = useState(null);
  const [converting, setConverting] = useState(false);

  // History Filters
  const [historyTypeFilter, setHistoryTypeFilter] = useState('all');
  const [historySearch, setHistorySearch] = useState('');

  const remaining = total_income - total_expenses;
  const progressPercent = expense_limit > 0 ? Math.min((total_expenses / expense_limit) * 100, 100) : 0;
  
  let progressColor = "bg-green-500";
  let alertMsg = "";
  if (is_saving_mode && expense_limit > 0) {
    if (total_expenses > expense_limit) {
      progressColor = "bg-red-500";
      alertMsg = "⚠️ Limit Exceeded! You have spent more than your budget.";
    } else if (total_expenses >= expense_limit * 0.8) {
      progressColor = "bg-yellow-500";
      alertMsg = "⚠️ Warning: Approaching your budget limit!";
    }
  }

  // Real-time INR preview whenever amount or currency changes
  useEffect(() => {
    const amount = parseFloat(txnForm.amount);
    if (!amount || txnForm.currency === 'INR') {
      setInrPreview(null);
      return;
    }
    const timer = setTimeout(async () => {
      setConverting(true);
      try {
        const inr = await convertToINR(amount, txnForm.currency);
        setInrPreview(inr);
      } catch {
        setInrPreview(null);
      } finally {
        setConverting(false);
      }
    }, 400); // debounce 400ms
    return () => clearTimeout(timer);
  }, [txnForm.amount, txnForm.currency]);

  const handleAddTxn = async (e) => {
    e.preventDefault();
    try {
      let finalAmount = parseFloat(txnForm.amount);

      // Convert to INR before sending to backend
      if (txnForm.currency !== 'INR') {
        finalAmount = await convertToINR(finalAmount, txnForm.currency);
      }

      const currencyNote = txnForm.currency !== 'INR' 
        ? ` (${txnForm.currency} ${txnForm.amount})` 
        : '';
      const description = txnForm.description || (txnForm.type === 'income' ? 'Income' : 'Expense');

      await api.post('/tracker/transaction', {
        type: txnForm.type,
        amount: finalAmount,
        description: description + currencyNote,
        account_id: txnForm.account_id ? Number(txnForm.account_id) : null
      });

      setTxnForm({ type: 'expense', amount: '', description: '', account_id: '', currency: 'INR' });
      setInrPreview(null);
      fetchTrackerData();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add transaction");
    }
  };

  const deleteTxn = async (id) => {
    if(!window.confirm("Hide this from history?")) return;
    await api.delete(`/tracker/transaction/${id}`);
    fetchTrackerData();
  };

  // Apply all history filters
  const filteredTransactions = transactions.filter(t => {
    if (selectedAccountId && t.account_id !== selectedAccountId) return false;
    if (historyTypeFilter !== 'all' && t.type !== historyTypeFilter) return false;
    if (historySearch && !t.description.toLowerCase().includes(historySearch.toLowerCase())) return false;
    return true;
  });

  const selectedCurrencyInfo = CURRENCIES.find(c => c.code === txnForm.currency);

  return (
    <div className="md:col-span-2 space-y-6">
      
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow border-l-4 border-green-500">
          <p className="text-sm text-gray-500">Total Income</p>
          <h3 className="text-2xl font-bold text-gray-800">{fmt(total_income)}</h3>
        </div>
        <div className="bg-white p-6 rounded-xl shadow border-l-4 border-red-500">
          <p className="text-sm text-gray-500">Total Expenses</p>
          <h3 className="text-2xl font-bold text-gray-800">{fmt(total_expenses)}</h3>
        </div>
        <div className="bg-white p-6 rounded-xl shadow border-l-4 border-blue-500">
          <p className="text-sm text-gray-500">Remaining Balance</p>
          <h3 className={`text-2xl font-bold ${remaining < 0 ? 'text-red-500' : 'text-blue-600'}`}>{fmt(remaining)}</h3>
        </div>
      </div>

      {/* Progress Bar */}
      {is_saving_mode && expense_limit > 0 && (
        <div className="bg-white p-6 rounded-xl shadow">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-semibold text-gray-600">Budget Limit: {fmt(expense_limit)}</span>
            <span className="text-sm font-semibold text-gray-600">{progressPercent.toFixed(1)}% Used</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div className={`${progressColor} h-3 rounded-full transition-all duration-500`} style={{ width: `${progressPercent}%` }}></div>
          </div>
          {alertMsg && <p className={`mt-2 text-sm font-semibold ${progressColor === 'bg-red-500' ? 'text-red-600' : 'text-yellow-600'}`}>{alertMsg}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Add Transaction Form */}
        <div className="bg-white p-6 rounded-xl shadow flex flex-col">
          <h2 className="text-lg font-semibold mb-4">Add Transaction</h2>
          <form onSubmit={handleAddTxn} className="flex-1 space-y-3">
            {/* Type Radio */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="type" value="expense" checked={txnForm.type === 'expense'} onChange={e => setTxnForm({...txnForm, type: e.target.value})} className="accent-red-500" />
                <span className="text-red-600 font-medium">Expense</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="type" value="income" checked={txnForm.type === 'income'} onChange={e => setTxnForm({...txnForm, type: e.target.value})} className="accent-green-500" />
                <span className="text-green-600 font-medium">Income</span>
              </label>
            </div>

            {/* Description */}
            <input 
              type="text" 
              value={txnForm.description} 
              onChange={e => setTxnForm({...txnForm, description: e.target.value})} 
              className="w-full border px-3 py-2 rounded-md text-sm" 
              placeholder="Description (Optional, e.g. Salary, Rent)" 
            />

            {/* Amount + Currency Row */}
            <div className="flex gap-2">
              <div className="flex-1">
                <input 
                  type="number" 
                  value={txnForm.amount} 
                  onChange={e => setTxnForm({...txnForm, amount: e.target.value})} 
                  className="w-full border px-3 py-2 rounded-md text-sm" 
                  placeholder={`Amount (${selectedCurrencyInfo?.symbol || '₹'})`}
                  min="0.01" 
                  step="0.01"
                  required 
                />
              </div>
              <select 
                value={txnForm.currency}
                onChange={e => setTxnForm({...txnForm, currency: e.target.value})}
                className="border px-2 py-2 rounded-md text-sm bg-white text-gray-700 cursor-pointer"
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                ))}
              </select>
            </div>

            {/* Live INR Preview */}
            {txnForm.currency !== 'INR' && txnForm.amount && (
              <div className={`text-xs px-3 py-2 rounded-md flex items-center gap-2 ${
                converting ? 'bg-gray-50 text-gray-400' : 
                inrPreview ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-red-50 text-red-500'
              }`}>
                {converting ? (
                  <>⏳ Converting...</>
                ) : inrPreview ? (
                  <>
                    💱 Equivalent to <strong>{fmt(inrPreview)}</strong> — this amount will be saved in database
                  </>
                ) : (
                  <>⚠️ Could not fetch rate. Check API key.</>
                )}
              </div>
            )}

            {/* Account Select */}
            <select 
              value={txnForm.account_id} 
              onChange={e => setTxnForm({...txnForm, account_id: e.target.value})} 
              className="w-full border px-3 py-2 rounded-md text-sm" 
              required
            >
              <option value="" disabled>-- Select an Account --</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name} ({fmt(acc.balance)})</option>
              ))}
            </select>

            <button 
              type="submit" 
              disabled={converting}
              className={`w-full py-2.5 text-white font-semibold rounded-md transition-colors disabled:opacity-60 ${txnForm.type === 'income' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {converting ? '⏳ Converting...' : `Add ${txnForm.type === 'income' ? 'Income' : 'Expense'}`}
              {txnForm.currency !== 'INR' && inrPreview ? ` (${fmt(inrPreview)})` : ''}
            </button>
          </form>
        </div>

        {/* History */}
        <div className="bg-white p-6 rounded-xl shadow h-[430px] flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold">
              {selectedAccountId ? `${accounts.find(a => a.id === selectedAccountId)?.name || ''} History` : 'Transaction History'}
            </h2>
            {selectedAccountId && (
              <button onClick={() => setSelectedAccountId(null)} className="text-sm text-blue-500 hover:underline">Show All</button>
            )}
          </div>

          {/* History Filters */}
          <div className="flex gap-2 mb-3 flex-wrap">
            <select 
              value={historyTypeFilter} 
              onChange={e => setHistoryTypeFilter(e.target.value)}
              className="border px-2 py-1 rounded text-xs text-gray-600"
            >
              <option value="all">All Types</option>
              <option value="income">Income Only</option>
              <option value="expense">Expense Only</option>
            </select>
            <input 
              type="text" 
              placeholder="🔍 Search description..." 
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              className="border px-2 py-1 rounded text-xs flex-1 min-w-[120px]"
            />
            {(historyTypeFilter !== 'all' || historySearch) && (
              <button onClick={() => { setHistoryTypeFilter('all'); setHistorySearch(''); }} className="text-xs text-red-500 hover:underline">Clear</button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            {filteredTransactions.length === 0 ? (
              <p className="text-gray-500 text-sm">No transactions found.</p>
            ) : (
              <ul className="space-y-2">
                {filteredTransactions.map(txn => (
                  <li key={txn.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border hover:shadow-sm transition-shadow">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{txn.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{txn.account_name || 'General'}</span>
                        <span className="text-xs text-gray-400">{new Date(txn.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-bold text-sm ${txn.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {txn.type === 'income' ? '+' : '-'}{fmt(txn.amount)}
                      </span>
                      <button onClick={() => deleteTxn(txn.id)} className="text-gray-300 hover:text-red-500 transition-colors text-sm">🗑️</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default TransactionArea;
