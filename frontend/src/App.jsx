import React, { useState, useEffect } from 'react';
import api from './api/axios';
import AuthForm from './components/auth/AuthForm';
import Header from './components/dashboard/Header';
import Sidebar from './components/dashboard/Sidebar';
import TransactionArea from './components/dashboard/TransactionArea';
import AiChatButton from './features/ai-chat/AiChatButton';

// ─── Responsive Hook ──────────────────────────────────────────────────────────
function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const fn = () => setWidth(window.innerWidth);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return width;
}

export default function App() {
  const [isLoading, setIsLoading]     = useState(true);
  const [isLoggedIn, setIsLoggedIn]   = useState(false);
  const [user, setUser]               = useState(null);
  const [trackerData, setTrackerData] = useState({ transactions: [], accounts: [] });

  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('theme_guest') === 'dark'; }
    catch { return false; }
  });

  const dateObj = new Date();
  const [startDate, setStartDate] = useState(() =>
    `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-01`
  );
  const [endDate, setEndDate] = useState(() => {
    const lastDay = new Date(dateObj.getFullYear(), dateObj.getMonth()+1, 0);
    return `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(lastDay.getDate()).padStart(2,'0')}`;
  });
  const [filterType, setFilterType]   = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState(null);

  // Filter collapse on mobile
  const [filterOpen, setFilterOpen] = useState(true);

  const width    = useWindowWidth();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;

  const currentMonth  = startDate.substring(0, 7);
  const setCurrentMonth = () => {};

  const getThemeKey = () => user ? `theme_${user.id}` : 'theme_guest';

  useEffect(() => {
    if (user) {
      try {
        const t = localStorage.getItem(`theme_${user.id}`);
        if (t !== null) setDarkMode(t === 'dark');
      } catch {}
    }
  }, [user]);

  useEffect(() => {
    const key = getThemeKey();
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    try { localStorage.setItem(key, darkMode ? 'dark' : 'light'); } catch {}
  }, [darkMode, user]);

  const fetchTrackerData = async () => {
    try {
      const params = new URLSearchParams({ startDate, endDate, type: filterType, search: searchQuery }).toString();
      const res = await api.get(`/tracker?${params}`);
      setTrackerData(res.data);
      if (res.data.user) setUser(res.data.user);
      setIsLoggedIn(true);
    } catch (err) {
      if (err.response?.status === 401) setIsLoggedIn(false);
    } finally { setIsLoading(false); }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoggedIn || !isLoading) fetchTrackerData();
    }, 400);
    return () => clearTimeout(timer);
  }, [startDate, endDate, filterType, searchQuery]);

  useEffect(() => { fetchTrackerData(); }, []);

  // ── Loading Screen ────────────────────────────────────────────────────────
  if (isLoading) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:'1.25rem', background:'var(--bg)' }}>
      <div style={{ width:'52px', height:'52px', borderRadius:'16px', background:'var(--accent)',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.3rem',
        boxShadow:'0 8px 28px var(--accent-glow)', animation:'fadeUp 0.5s ease both' }}>💳</div>
      <div style={{ display:'flex', gap:'5px' }}>
        {[0,1,2].map(i=>(
          <div key={i} style={{ width:'7px', height:'7px', borderRadius:'50%', background:'var(--accent)',
            animation:`pulse 1.2s ease-in-out ${i*0.18}s infinite` }}/>
        ))}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:.25;transform:scale(.75)}50%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );

  if (!isLoggedIn) return (
    <AuthForm setIsLoggedIn={setIsLoggedIn} setUser={setUser} onLoginSuccess={fetchTrackerData}/>
  );

  // ── Shared input style ────────────────────────────────────────────────────
  const inputStyle = {
    width: '100%', padding: '10px', borderRadius: '8px', boxSizing: 'border-box',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    background: darkMode ? '#0f172a' : '#ffffff',
    color: darkMode ? '#f8fafc' : '#0f172a',
    fontSize: isMobile ? '0.8rem' : '0.875rem',
  };

  const labelStyle = {
    fontSize: '11px', fontWeight: '600',
    color: darkMode ? '#94a3b8' : '#64748b',
    marginBottom: '4px', display: 'block',
  };

  const totalBalance = (trackerData.accounts || []).reduce((s, a) => s + a.balance, 0);
  const net          = (trackerData.total_income || 0) - (trackerData.total_expenses || 0);

  return (
    <>
      <div style={{ minHeight:'100vh', background: darkMode ? '#0f172a' : '#f8fafc', transition:'background 0.3s' }}>
        <div style={{ maxWidth:'1280px', margin:'0 auto', padding: isMobile ? '0.6rem 0.6rem 3rem' : '1.25rem 1.25rem 3rem', boxSizing:'border-box', width:'100%', minWidth:0 }}>

          {/* ── Header ── */}
          <div style={{ marginBottom: '1rem' }}>
            <Header
              user={user} trackerData={trackerData}
              selectedAccountId={selectedAccountId} setIsLoggedIn={setIsLoggedIn}
              currentMonth={currentMonth} setCurrentMonth={setCurrentMonth}
              availableMonths={trackerData.available_months || []}
              darkMode={darkMode} setDarkMode={setDarkMode}
              fetchTrackerData={fetchTrackerData}
            />
          </div>

          {/* ── Filter Section ── */}
          <div style={{
            background: darkMode ? '#1e293b' : '#ffffff',
            padding: isMobile ? '14px' : '20px',
            borderRadius: '16px', marginBottom: '16px',
            border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
            borderLeft: '4px solid #3b82f6',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
          }}>
            {/* Filter Header — tap to collapse on mobile */}
            <div
              onClick={() => isMobile && setFilterOpen(o => !o)}
              style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                marginBottom: filterOpen ? '16px' : 0,
                cursor: isMobile ? 'pointer' : 'default', userSelect: 'none' }}
            >
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <span style={{ fontSize:'1.1rem' }}>🔍</span>
                <h2 style={{ fontSize: isMobile ? '14px' : '16px', fontWeight:'bold',
                  color: darkMode ? '#f8fafc' : '#0f172a', margin:0 }}>
                  Filter Your Dashboard
                </h2>
              </div>
              {isMobile && (
                <span style={{
                  fontSize:'0.75rem', color:'var(--text-4)',
                  transform: filterOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition:'transform 0.2s', display:'inline-block',
                }}>▼</span>
              )}
            </div>

            {filterOpen && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : '2fr 1fr 1.5fr',
                gap: isMobile ? '10px' : '16px',
              }}>
                {/* Date Range */}
                <div>
                  <label style={labelStyle}>Date Range (Kab se kab tak)</label>
                <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap: 'wrap' }}>
                    <input type="date" value={startDate}
                      onChange={e => setStartDate(e.target.value)} style={{...inputStyle, minWidth:0, flex:1}}/>
                    <span style={{ color: darkMode ? '#94a3b8' : '#64748b', flexShrink:0 }}>-</span>
                    <input type="date" value={endDate}
                      onChange={e => setEndDate(e.target.value)} style={{...inputStyle, minWidth:0, flex:1}}/>
                </div>
                </div>

                {/* Transaction Type */}
                <div>
                  <label style={labelStyle}>Transaction Type</label>
                  <select value={filterType} onChange={e => setFilterType(e.target.value)}
                    style={{ ...inputStyle, cursor:'pointer' }}>
                    <option value="all">All (Sabhi)</option>
                    <option value="income">Income (Aamdani)</option>
                    <option value="expense">Expense (Kharcha)</option>
                  </select>
                </div>

                {/* Search */}
                <div>
                  <label style={labelStyle}>Search Description/Account</label>
                  <input type="text" placeholder="e.g., Salary, Rent, HDFC..."
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    style={inputStyle}/>
                </div>
              </div>
            )}
          </div>

          {/* ── Summary Cards ── */}
          {isMobile ? (
            /* ── MOBILE: 1 big balance card + 3 mini chips ── */
            <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Balance — full width */}
              <div style={{
                background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                borderRadius: '14px', padding: '14px 16px', color: '#fff',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <p style={{ fontSize: '10px', opacity: 0.75, fontWeight: 600, marginBottom: '2px' }}>TOTAL BALANCE</p>
                  <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>
                    ₹{totalBalance.toLocaleString('en-IN')}
                  </h1>
                </div>
                <p style={{ fontSize: '11px', opacity: 0.65 }}>
                  {(trackerData.accounts||[]).length} accounts
                </p>
              </div>

              {/* Income + Expenses + Net — 3 chips in a row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {[
                  { label: 'INCOME', value: trackerData.total_income||0, color: '#22c55e', bg: darkMode ? '#052e16' : '#f0fdf4', border: darkMode ? '#14532d' : '#bbf7d0', icon: '↑' },
                  { label: 'EXPENSES', value: trackerData.total_expenses||0, color: '#ef4444', bg: darkMode ? '#450a0a' : '#fef2f2', border: darkMode ? '#7f1d1d' : '#fecaca', icon: '↓' },
                  { label: 'NET', value: Math.abs(net), prefix: net >= 0 ? '+' : '-', color: net >= 0 ? '#22c55e' : '#ef4444', bg: darkMode ? '#172554' : '#eff6ff', border: darkMode ? '#1e3a8a' : '#bfdbfe', icon: '⇕' },
                ].map(c => (
                  <div key={c.label} style={{
                    background: c.bg, borderRadius: '12px', padding: '10px 10px',
                    border: `1px solid ${c.border}`,
                    display: 'flex', flexDirection: 'column', gap: '3px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ fontSize: '9px', fontWeight: 700, color: c.color, margin: 0 }}>{c.label}</p>
                      <span style={{ fontSize: '0.7rem', color: c.color }}>{c.icon}</span>
                    </div>
                    <p style={{ fontSize: '13px', fontWeight: 800, color: c.color, margin: 0, letterSpacing: '-0.02em' }}>
                      {c.prefix || ''}₹{c.value.toLocaleString('en-IN')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ── DESKTOP/TABLET: 4 cards grid ── */
            <div style={{
              display: 'grid',
              gridTemplateColumns: isTablet ? '1fr 1fr' : 'repeat(4, 1fr)',
              gap: '16px', marginBottom: '24px',
            }}>
              <div style={{ background:'linear-gradient(135deg,#8b5cf6,#6366f1)', borderRadius:'16px', padding:'20px', color:'#fff', boxShadow:'0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                <p style={{ fontSize:'11px', opacity:0.8, marginBottom:'4px', fontWeight:600 }}>TOTAL BALANCE</p>
                <h1 style={{ fontSize:'28px', fontWeight:'bold', margin:'0 0 4px 0' }}>₹{totalBalance.toLocaleString('en-IN')}</h1>
                <p style={{ fontSize:'11px', opacity:0.7, margin:0 }}>{(trackerData.accounts||[]).length} accounts</p>
              </div>
              <div style={{ background: darkMode?'#052e16':'#f0fdf4', borderRadius:'16px', padding:'20px', border:`1px solid ${darkMode?'#14532d':'#bbf7d0'}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                  <p style={{ fontSize:'11px', fontWeight:'bold', color: darkMode?'#4ade80':'#15803d', margin:0 }}>INCOME</p>
                  <span style={{ color:'#22c55e' }}>↗</span>
                </div>
                <h2 style={{ fontSize:'24px', fontWeight:'bold', color: darkMode?'#f8fafc':'#0f172a', margin:0 }}>₹{(trackerData.total_income||0).toLocaleString('en-IN')}</h2>
              </div>
              <div style={{ background: darkMode?'#450a0a':'#fef2f2', borderRadius:'16px', padding:'20px', border:`1px solid ${darkMode?'#7f1d1d':'#fecaca'}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                  <p style={{ fontSize:'11px', fontWeight:'bold', color: darkMode?'#f87171':'#b91c1c', margin:0 }}>EXPENSES</p>
                  <span style={{ color:'#ef4444' }}>↘</span>
                </div>
                <h2 style={{ fontSize:'24px', fontWeight:'bold', color: darkMode?'#f8fafc':'#0f172a', margin:0 }}>₹{(trackerData.total_expenses||0).toLocaleString('en-IN')}</h2>
              </div>
              <div style={{ background: darkMode?'#172554':'#eff6ff', borderRadius:'16px', padding:'20px', border:`1px solid ${darkMode?'#1e3a8a':'#bfdbfe'}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                  <p style={{ fontSize:'11px', fontWeight:'bold', color: darkMode?'#60a5fa':'#1d4ed8', margin:0 }}>NET</p>
                  <span style={{ color:'#3b82f6' }}>⇕</span>
                </div>
                <h2 style={{ fontSize:'24px', fontWeight:'bold', color: net>=0?'#22c55e':'#ef4444', margin:0 }}>
                  {net>=0?'+':''}₹{net.toLocaleString('en-IN')}
                </h2>
              </div>
            </div>
          )}

          {/* ── Dashboard Grid ── */}
          <div className="dashboard-grid">
            <Sidebar
              trackerData={trackerData} fetchTrackerData={fetchTrackerData}
              selectedAccountId={selectedAccountId} setSelectedAccountId={setSelectedAccountId}
            />
            <TransactionArea
              trackerData={trackerData} fetchTrackerData={fetchTrackerData}
              selectedAccountId={selectedAccountId} setSelectedAccountId={setSelectedAccountId}
              currentMonth={currentMonth}
            />
          </div>

          <p style={{ textAlign:'center', color: darkMode ? '#94a3b8' : '#64748b',
            fontSize:'0.72rem', marginTop:'2.5rem', letterSpacing:'-0.01em' }}>
            ExpenseTracker · Built with care
          </p>
        </div>
      </div>

      <AiChatButton trackerData={trackerData} fetchTrackerData={fetchTrackerData}/>
    </>
  );
}