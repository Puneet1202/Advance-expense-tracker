import { useState } from 'react';
import api from '../../api/axios';

const TransactionArea = ({ trackerData, fetchTrackerData, selectedAccountId, setSelectedAccountId, currentMonth }) => {
  const { total_income, total_expenses, expense_limit, is_saving_mode, transactions, accounts } = trackerData;
  const [txnForm, setTxnForm] = useState({ type: 'expense', amount: '', description: '', account_id: '' });

  // History Filters
  const [historyTypeFilter, setHistoryTypeFilter] = useState('all'); // all, income, expense
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

  const handleAddTxn = async (e) => {
    e.preventDefault();
    try {
      await api.post('/tracker/transaction', {
        type: txnForm.type,
        amount: Number(txnForm.amount),
        description: txnForm.description,
        account_id: txnForm.account_id ? Number(txnForm.account_id) : null
      });
      setTxnForm({ type: 'expense', amount: '', description: '', account_id: '' });
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

  return (
    <div className="md:col-span-2 space-y-6">
      
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow border-l-4 border-green-500">
          <p className="text-sm text-gray-500">Total Income</p>
          <h3 className="text-2xl font-bold text-gray-800">₹{total_income}</h3>
        </div>
        <div className="bg-white p-6 rounded-xl shadow border-l-4 border-red-500">
          <p className="text-sm text-gray-500">Total Expenses</p>
          <h3 className="text-2xl font-bold text-gray-800">₹{total_expenses}</h3>
        </div>
        <div className="bg-white p-6 rounded-xl shadow border-l-4 border-blue-500">
          <p className="text-sm text-gray-500">Remaining Balance</p>
          <h3 className={`text-2xl font-bold ${remaining < 0 ? 'text-red-500' : 'text-blue-600'}`}>₹{remaining}</h3>
        </div>
      </div>

      {/* Progress Bar (If saving mode on) */}
      {is_saving_mode && expense_limit > 0 && (
        <div className="bg-white p-6 rounded-xl shadow">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-semibold text-gray-600">Budget Limit: ₹{expense_limit}</span>
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
        <div className="bg-white p-6 rounded-xl shadow h-[400px] flex flex-col">
          <h2 className="text-lg font-semibold mb-4">Add Transaction</h2>
          <form onSubmit={handleAddTxn} className="flex-1 space-y-4">
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
            <div>
              <input type="text" value={txnForm.description} onChange={e => setTxnForm({...txnForm, description: e.target.value})} className="w-full border px-3 py-2 rounded-md" placeholder="Description (Optional, e.g. Salary, Rent)" />
            </div>
            <div>
              <input type="number" value={txnForm.amount} onChange={e => setTxnForm({...txnForm, amount: e.target.value})} className="w-full border px-3 py-2 rounded-md" placeholder="Amount (₹)" min="1" required />
            </div>
            <div>
              <select value={txnForm.account_id} onChange={e => setTxnForm({...txnForm, account_id: e.target.value})} className="w-full border px-3 py-2 rounded-md" required>
                <option value="" disabled>-- Select an Account --</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>
            <button type="submit" className={`w-full py-2 text-white font-semibold rounded-md transition-colors mt-auto ${txnForm.type === 'income' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
              Add {txnForm.type === 'income' ? 'Income' : 'Expense'}
            </button>
          </form>
        </div>

        {/* History */}
        <div className="bg-white p-6 rounded-xl shadow h-[400px] flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold">
              {selectedAccountId ? `${accounts.find(a => a.id === selectedAccountId)?.name || ''} History` : 'Transaction History'}
            </h2>
            {selectedAccountId && (
              <button onClick={() => setSelectedAccountId(null)} className="text-sm text-blue-500 hover:underline">
                Show All
              </button>
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
              <button 
                onClick={() => { setHistoryTypeFilter('all'); setHistorySearch(''); }}
                className="text-xs text-red-500 hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pr-2">
            {filteredTransactions.length === 0 ? (
              <p className="text-gray-500 text-sm">No transactions found.</p>
            ) : (
              <ul className="space-y-3">
                {filteredTransactions.map(txn => (
                  <li key={txn.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border hover:shadow-sm transition-shadow">
                    <div>
                      <p className="font-semibold text-gray-800">{txn.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{txn.account_name || 'General'}</span>
                        <span className="text-xs text-gray-400">{new Date(txn.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`font-bold ${txn.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {txn.type === 'income' ? '+' : '-'}₹{txn.amount}
                      </span>
                      <button onClick={() => deleteTxn(txn.id)} className="text-gray-400 hover:text-red-500 transition-colors">🗑️</button>
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
