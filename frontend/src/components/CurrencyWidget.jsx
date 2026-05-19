import { useState, useEffect } from 'react';

const CACHE_KEY = 'currency_cache';
const CACHE_DURATION_MS = 12 * 60 * 60 * 1000;

const CURRENCIES = [
  { code: 'USD', symbol: '$',   flag: '🇺🇸', name: 'US Dollar' },
  { code: 'EUR', symbol: '€',   flag: '🇪🇺', name: 'Euro' },
  { code: 'GBP', symbol: '£',   flag: '🇬🇧', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', flag: '🇦🇪', name: 'UAE Dirham' },
  { code: 'SAR', symbol: '﷼',   flag: '🇸🇦', name: 'Saudi Riyal' },
  { code: 'JPY', symbol: '¥',   flag: '🇯🇵', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'C$',  flag: '🇨🇦', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$',  flag: '🇦🇺', name: 'Australian Dollar' },
  { code: 'SGD', symbol: 'S$',  flag: '🇸🇬', name: 'Singapore Dollar' },
  { code: 'CHF', symbol: '₣',   flag: '🇨🇭', name: 'Swiss Franc' },
];

export default function CurrencyWidget() {
  const [rates, setRates]                   = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [lastUpdated, setLastUpdated]       = useState(null);

  const fetchRates = async () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION_MS) {
          setRates(data); setLastUpdated(new Date(timestamp)); setLoading(false); return;
        }
      }
      const res = await fetch('/api/currency/rates');
      if (!res.ok) throw new Error('Failed to fetch rates');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const now = Date.now();
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: json.conversion_rates, timestamp: now }));
      setRates(json.conversion_rates);
      setLastUpdated(new Date(now));
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchRates(); }, []);

  const handleRefresh = () => {
    localStorage.removeItem(CACHE_KEY);
    setLoading(true); setError(null);
    fetchRates();
  };

  const currency = CURRENCIES.find(c => c.code === selectedCurrency);
  const rateINRperForeign = rates ? (1 / rates[selectedCurrency]) : null;
  const rateForeignPerINR = rates ? rates[selectedCurrency] : null;

  return (
    <div className="card anim-up d3" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.1rem' }}>💱</span>
          <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-1)' }}>Live Rates</p>
        </div>
        <button onClick={handleRefresh} disabled={loading} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500, color: 'var(--accent)', opacity: loading ? 0.4 : 1, fontFamily: 'inherit' }}>
          {loading ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      <select className="field" value={selectedCurrency} onChange={e => setSelectedCurrency(e.target.value)} style={{ fontSize: '0.82rem', marginBottom: '12px' }}>
        {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</option>)}
      </select>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 0', gap: '8px' }}>
          <div style={{ width: '18px', height: '18px', border: '2px solid var(--accent)', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-4)' }}>Fetching live rates...</span>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {error && <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: '10px', padding: '10px 14px', fontSize: '0.82rem', color: 'var(--red)' }}>⚠️ {error}</div>}

      {!loading && !error && rates && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ background: 'var(--accent-glow)', borderRadius: '12px', padding: '14px', border: '1px solid rgba(91,91,214,0.22)' }}>
            <p style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '6px' }}>EXCHANGE RATE</p>
            <div className="num" style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-1)' }}>{currency.symbol}1</span>
              <span style={{ color: 'var(--text-4)', fontSize: '0.82rem' }}>=</span>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent)' }}>₹{rateINRperForeign?.toFixed(2)}</span>
            </div>
          </div>

          <div style={{ background: 'var(--green-bg)', borderRadius: '12px', padding: '14px', border: '1px solid var(--green-border)' }}>
            <p style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '6px' }}>PURCHASING POWER</p>
            <div className="num" style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-1)' }}>₹1</span>
              <span style={{ color: 'var(--text-4)', fontSize: '0.82rem' }}>=</span>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--green)' }}>{currency.symbol}{rateForeignPerINR?.toFixed(4)}</span>
            </div>
          </div>

          {lastUpdated && (
            <p style={{ fontSize: '0.68rem', textAlign: 'center', color: 'var(--text-4)' }}>
              🕐 {lastUpdated.toLocaleDateString()} {lastUpdated.toLocaleTimeString()} · 12h cache
            </p>
          )}
        </div>
      )}
    </div>
  );
}