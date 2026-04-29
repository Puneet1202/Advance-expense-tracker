import { useState } from 'react';
import { downloadPDF, downloadExcel } from '../../utils/exportUtils';
import api from '../../api/axios';

const Header = ({ user, trackerData, selectedAccountId, setIsLoggedIn, currentMonth, setCurrentMonth, availableMonths }) => {
  const [showReportModal, setShowReportModal] = useState(false);
  const [rangeType, setRangeType] = useState('all'); // all, date, month
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [fromMonth, setFromMonth] = useState('');
  const [toMonth, setToMonth] = useState('');

  const now = new Date();
  const maxMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const sortedMonths = [...(availableMonths || [])].sort();
  const minMonth = sortedMonths.length > 0 ? sortedMonths[0] : maxMonth;

  const { accounts } = trackerData;

  const handleDownload = async (format) => {
    try {
      // Fetch ALL transactions (no month filter) for report
      const res = await api.get('/tracker?month=');
      const allTxns = res.data.transactions || [];
      const args = [user, allTxns, accounts, selectedAccountId, rangeType, fromDate, toDate, fromMonth, toMonth];
      if (format === 'pdf') downloadPDF(...args);
      else downloadExcel(...args);
      setShowReportModal(false);
    } catch (err) {
      alert("Failed to fetch data for report");
    }
  };

  return (
    <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow relative flex-wrap gap-4">
      <h1 className="text-2xl font-bold text-gray-800">Hi, {user?.name || 'User'} 👋</h1>
      <div className="flex items-center gap-3 flex-wrap">

        {/* Month Calendar Picker */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 font-semibold hidden md:block">Month:</label>
          <input 
            type="month" 
            value={currentMonth} 
            onChange={(e) => setCurrentMonth(e.target.value)}
            min={minMonth}
            max={maxMonth}
            className="border px-3 py-1.5 rounded-md text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer bg-white"
          />
          {currentMonth && (
            <button 
              onClick={() => setCurrentMonth('')} 
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              All Time
            </button>
          )}
        </div>

        {/* Reset */}
        <button 
          onClick={async () => {
             if (window.confirm("⚠️ TESTING MODE: Saara data permanently delete ho jayega. Continue?")) {
                 try {
                     await api.delete('/tracker/reset');
                     window.location.reload();
                 } catch (err) {
                     alert("Failed: " + (err.response?.data?.error || err.response?.data?.message || err.message));
                 }
             }
          }}
          className="px-3 py-1.5 bg-red-100 text-red-700 font-bold border border-red-300 rounded-md hover:bg-red-200 transition-colors text-xs shadow-sm"
        >
          ⚙️ Reset
        </button>

        {/* Report Button */}
        <button 
          onClick={() => setShowReportModal(true)} 
          className="px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 shadow-sm transition-colors flex items-center gap-2"
        >
          📥 Download Report
        </button>

        {/* Logout */}
        <button 
          onClick={() => setIsLoggedIn(false)} 
          className="px-4 py-2 bg-gray-200 rounded-md text-gray-700 hover:bg-gray-300 font-medium"
        >
          Logout
        </button>
      </div>

      {/* Report Download Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold mb-4">📥 Download Report</h3>

            {/* Range Type Selection */}
            <div className="flex gap-2 mb-4">
              {[
                { val: 'all', label: 'All Time' },
                { val: 'month', label: 'Month Range' },
                { val: 'date', label: 'Date Range' },
              ].map(opt => (
                <button
                  key={opt.val}
                  onClick={() => setRangeType(opt.val)}
                  className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors ${
                    rangeType === opt.val 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Month Range Inputs */}
            {rangeType === 'month' && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs text-gray-500 font-medium mb-1 block">From Month</label>
                  <input 
                    type="month" value={fromMonth} onChange={e => setFromMonth(e.target.value)}
                    min={minMonth} max={maxMonth}
                    className="w-full border px-3 py-2 rounded-md"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium mb-1 block">To Month</label>
                  <input 
                    type="month" value={toMonth} onChange={e => setToMonth(e.target.value)}
                    min={fromMonth || minMonth} max={maxMonth}
                    className="w-full border px-3 py-2 rounded-md"
                  />
                </div>
              </div>
            )}

            {/* Date Range Inputs */}
            {rangeType === 'date' && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs text-gray-500 font-medium mb-1 block">From Date</label>
                  <input 
                    type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                    className="w-full border px-3 py-2 rounded-md"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium mb-1 block">To Date</label>
                  <input 
                    type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                    min={fromDate}
                    className="w-full border px-3 py-2 rounded-md"
                  />
                </div>
              </div>
            )}

            {rangeType === 'all' && (
              <p className="text-sm text-gray-500 mb-4">Saare months ka combined report download hoga.</p>
            )}

            {/* Download Buttons */}
            <div className="flex gap-3 mb-3">
              <button 
                onClick={() => handleDownload('pdf')} 
                className="flex-1 py-3 bg-red-500 text-white font-semibold rounded-md hover:bg-red-600 flex items-center justify-center gap-2"
              >
                📄 PDF Download
              </button>
              <button 
                onClick={() => handleDownload('excel')} 
                className="flex-1 py-3 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 flex items-center justify-center gap-2"
              >
                📊 Excel Download
              </button>
            </div>

            <button 
              onClick={() => setShowReportModal(false)} 
              className="w-full py-2 text-gray-500 hover:bg-gray-100 rounded-md text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Header;
