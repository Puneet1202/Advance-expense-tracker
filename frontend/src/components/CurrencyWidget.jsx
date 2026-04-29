import { useState, useEffect } from 'react';

const CACHE_KEY = 'currency_cache';
const CACHE_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

const CURRENCIES = [
  { code: 'USD', symbol: '$', flag: '🇺🇸', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', flag: '🇪🇺', name: 'Euro' },
  { code: 'GBP', symbol: '£', flag: '🇬🇧', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', flag: '🇦🇪', name: 'UAE Dirham' },
  { code: 'SAR', symbol: '﷼', flag: '🇸🇦', name: 'Saudi Riyal' },
  { code: 'JPY', symbol: '¥', flag: '🇯🇵', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'C$', flag: '🇨🇦', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', flag: '🇦🇺', name: 'Australian Dollar' },
  { code: 'SGD', symbol: 'S$', flag: '🇸🇬', name: 'Singapore Dollar' },
  { code: 'CHF', symbol: '₣', flag: '🇨🇭', name: 'Swiss Franc' },
];

const CurrencyWidget = () => {
  const [rates, setRates] = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      // Check localStorage cache
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION_MS) {
          setRates(data);
          setLastUpdated(new Date(timestamp));
          setLoading(false);
          return;
        }
      }

      // Fetch fresh rates
      const API_KEY = import.meta.env.VITE_EXCHANGE_RATE_API_KEY;
      const res = await fetch(`https://v6.exchangerate-api.com/v6/${API_KEY}/latest/INR`);
      if (!res.ok) throw new Error('Failed to fetch rates');
      const json = await res.json();

      if (json.result !== 'success') throw new Error(json['error-type'] || 'API error');

      const now = Date.now();
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: json.conversion_rates, timestamp: now }));
      setRates(json.conversion_rates);
      setLastUpdated(new Date(now));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    localStorage.removeItem(CACHE_KEY);
    setLoading(true);
    setError(null);
    fetchRates();
  };

  const currency = CURRENCIES.find(c => c.code === selectedCurrency);
  
  // rates are INR-based: 1 INR = X foreign
  // So: 1 foreign = 1/rate INR
  const rateINRperForeign = rates ? (1 / rates[selectedCurrency]) : null;
  const rateForeinPerINR = rates ? rates[selectedCurrency] : null;

  return (
    <div className="bg-white rounded-xl shadow p-5 border border-gray-100">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">💱</span>
          <h3 className="font-bold text-gray-800 text-base">Live Exchange Rates</h3>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="text-xs text-blue-500 hover:text-blue-700 hover:underline disabled:opacity-40"
          title="Force refresh (ignores cache)"
        >
          {loading ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Currency Selector */}
      <div className="mb-4">
        <select
          value={selectedCurrency}
          onChange={e => setSelectedCurrency(e.target.value)}
          className="w-full border border-gray-200 px-3 py-2 rounded-lg text-sm text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
        >
          {CURRENCIES.map(c => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.code} — {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Rate Display */}
      {loading && (
        <div className="flex items-center justify-center py-6">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-2 text-sm text-gray-400">Fetching live rates...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
          ⚠️ {error}
        </div>
      )}

      {!loading && !error && rates && (
        <div className="space-y-3">
          {/* Main Rate */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
            <p className="text-xs text-gray-500 mb-1 font-medium">EXCHANGE RATE</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-gray-900">
                {currency.symbol}1
              </span>
              <span className="text-gray-500 text-sm">=</span>
              <span className="text-2xl font-bold text-blue-600">
                ₹{rateINRperForeign?.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {currency.flag} 1 {currency.code} = ₹{rateINRperForeign?.toFixed(2)} INR
            </p>
          </div>

          {/* Purchasing Power */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-100">
            <p className="text-xs text-gray-500 mb-1 font-medium">PURCHASING POWER</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-gray-900">₹1</span>
              <span className="text-gray-500 text-sm">=</span>
              <span className="text-2xl font-bold text-green-600">
                {currency.symbol}{rateForeinPerINR?.toFixed(4)}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              🇮🇳 ₹1 INR = {currency.symbol}{rateForeinPerINR?.toFixed(4)} {currency.code}
            </p>
          </div>

          {/* Last Updated */}
          {lastUpdated && (
            <p className="text-xs text-center text-gray-400 pt-1">
              🕐 Last updated: {lastUpdated.toLocaleDateString()} {lastUpdated.toLocaleTimeString()} 
              <span className="ml-1 text-gray-300">• Cached for 12h</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default CurrencyWidget;
