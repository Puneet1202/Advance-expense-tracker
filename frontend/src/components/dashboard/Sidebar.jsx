import { useState } from 'react';
import api from '../../api/axios';
import CurrencyWidget from '../CurrencyWidget';

const Sidebar = ({ trackerData, fetchTrackerData, selectedAccountId, setSelectedAccountId }) => {
  const { is_saving_mode, expense_limit, accounts } = trackerData;
  const [accountForm, setAccountForm] = useState({ name: '' });
  const [limitInput, setLimitInput] = useState(expense_limit || '');
  const [transferModal, setTransferModal] = useState(null);

  const toggleSavingMode = async () => {
    const newVal = !is_saving_mode;
    await api.post('/tracker/settings', { 
      expense_limit: Number(limitInput),
      is_saving_mode: newVal
    });
    fetchTrackerData();
  };

  const handleSettingsUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/tracker/settings', { 
        expense_limit: Number(limitInput),
        is_saving_mode
      });
      fetchTrackerData();
    } catch (err) {
      alert("Failed to update settings");
    }
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();
    try {
      await api.post('/tracker/account', { name: accountForm.name });
      setAccountForm({ name: '' });
      fetchTrackerData();
    } catch (err) {
      alert("Failed to add account");
    }
  };

  const deleteAccount = async (id, name, confirmOnly = false, transferTo = null, autoCreateName = null) => {
    if (!confirmOnly && !window.confirm(`Delete account ${name}?`)) return;
    try {
      await api.delete(`/tracker/account/${id}`, { data: { transfer_account_id: transferTo, auto_create_account_name: autoCreateName } });
      setTransferModal(null);
      if (selectedAccountId === id) setSelectedAccountId(null);
      fetchTrackerData();
    } catch (err) {
      if (err.response?.data?.message === "BALANCE_REMAINING") {
        const otherAccounts = accounts.filter(a => a.id !== id);
        setTransferModal({
           id,
           name,
           balance: err.response.data.balance,
           otherAccounts,
           selectedTarget: otherAccounts.length > 0 ? otherAccounts[0].id : 'new_account',
           newAccountName: ''
        });
      } else {
        alert(err.response?.data?.message || "Failed to delete account");
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Saving Mode Toggle & Limit */}
      <div className="bg-white p-6 rounded-xl shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Saving Mode</h2>
          <button 
            onClick={toggleSavingMode}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${is_saving_mode ? 'bg-green-500' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${is_saving_mode ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {is_saving_mode && (
          <form onSubmit={handleSettingsUpdate} className="flex gap-2">
            <input 
              type="number" 
              placeholder="Set Limit (₹)" 
              value={limitInput} 
              onChange={e => setLimitInput(e.target.value)} 
              className="flex-1 border px-3 py-2 rounded-md" 
              required 
            />
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">Save</button>
          </form>
        )}
      </div>

      {/* Manage Accounts */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-4">Payment Accounts</h2>
        <form onSubmit={handleAddAccount} className="flex gap-2 mb-4">
          <input 
            type="text" 
            placeholder="e.g. Cash, UPI, HDFC" 
            value={accountForm.name} 
            onChange={e => setAccountForm({name: e.target.value})} 
            className="flex-1 border px-3 py-2 rounded-md" 
            required 
          />
          <button type="submit" className="px-3 py-2 bg-green-600 text-white rounded-md">+</button>
        </form>
        <ul className="space-y-2 max-h-40 overflow-y-auto">
          {accounts.map(acc => (
            <li 
              key={acc.id} 
              onClick={() => setSelectedAccountId(selectedAccountId === acc.id ? null : acc.id)}
              className={`flex justify-between items-center p-2 rounded border cursor-pointer transition-colors ${selectedAccountId === acc.id ? 'bg-blue-100 border-blue-400' : 'bg-gray-50 hover:bg-gray-100'}`}
            >
              <div>
                <span className="font-medium text-gray-800">{acc.name}</span>
                <span className={`ml-2 text-xs font-bold ${acc.balance < 0 ? 'text-red-500' : 'text-green-600'}`}>
                  ₹{acc.balance || 0}
                </span>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); deleteAccount(acc.id, acc.name); }} 
                className="text-red-500 hover:text-red-700 text-sm"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Transfer Modal */}
      {transferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold mb-2">Transfer Balance</h3>
            <p className="text-sm text-gray-600 mb-4">
              Account <strong>{transferModal.name}</strong> has a balance of <strong className="text-blue-600">₹{transferModal.balance}</strong>.<br/> 
              {transferModal.otherAccounts.length > 0 ? "Please select where to transfer this money before deleting:" : ""}
            </p>
            
            {transferModal.otherAccounts.length > 0 ? (
              <select 
                className="w-full border px-3 py-2 rounded-md mb-4"
                value={transferModal.selectedTarget}
                onChange={(e) => setTransferModal({...transferModal, selectedTarget: Number(e.target.value)})}
              >
                {transferModal.otherAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name} (Balance: ₹{a.balance})</option>
                ))}
              </select>
            ) : (
              <div className="mb-4">
                <p className="text-sm text-red-600 mb-2">You must create a new account to hold this balance.</p>
                <input 
                  type="text" 
                  placeholder="New Account Name (e.g. Bank, Cash)"
                  className="w-full border px-3 py-2 rounded-md outline-none focus:ring-2 focus:ring-blue-500"
                  value={transferModal.newAccountName}
                  onChange={e => setTransferModal({...transferModal, newAccountName: e.target.value})}
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => setTransferModal(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md">Cancel</button>
              <button 
                onClick={() => {
                  const target = transferModal.selectedTarget === 'new_account' ? null : transferModal.selectedTarget;
                  const autoName = transferModal.selectedTarget === 'new_account' ? transferModal.newAccountName.trim() : null;
                  
                  if (transferModal.selectedTarget === 'new_account' && !autoName) {
                    alert("Please enter a name for the new account.");
                    return;
                  }
                  
                  deleteAccount(transferModal.id, transferModal.name, true, target, autoName);
                }} 
                className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium"
              >
                Confirm & Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Live Currency Widget */}
      <CurrencyWidget />

    </div>
  );
};

export default Sidebar;
