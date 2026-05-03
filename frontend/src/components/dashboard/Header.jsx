import React, { useState, useEffect, useRef } from 'react';
import { downloadPDF, downloadExcel } from '../../utils/exportUtils';
import api from '../../api/axios';
import ImportStatement from '../../features/ai-import/ImportStatement';
import AnalyticsModal from './AnalyticsModal';

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

export default function Header({
  user, trackerData = { accounts: [] }, selectedAccountId, setIsLoggedIn,
  currentMonth, setCurrentMonth, availableMonths = [], darkMode, setDarkMode, fetchTrackerData
}) {
  const [reportOpen, setReportOpen]     = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [menuOpen, setMenuOpen]         = useState(false);
  const menuRef = useRef(null);

  const [rangeType, setRangeType] = useState('all');
  const [fromDate, setFromDate]   = useState('');
  const [toDate, setToDate]       = useState('');
  const [fromMonth, setFromMonth] = useState('');
  const [toMonth, setToMonth]     = useState('');

  const width     = useWindowWidth();
  const isMobile  = width < 480;
  const isTablet  = width >= 480 && width < 768;

  const now      = new Date();
  const maxMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const sorted   = [...availableMonths].sort();
  const minMonth = sorted[0] || maxMonth;
  const accounts = trackerData.accounts || [];

  const greeting = () => {
    const h = now.getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const download = async (fmt) => {
    try {
      const r    = await api.get('/tracker?month=');
      const args = [
        user, r.data?.transactions || [], accounts, selectedAccountId,
        rangeType, fromDate, toDate, fromMonth, toMonth
      ];
      fmt === 'pdf' ? downloadPDF(...args) : downloadExcel(...args);
      setReportOpen(false);
    } catch { alert('Failed to fetch report data'); }
  };

  // Close menu on outside click
  useEffect(() => {
    const fn = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  // ── Shared colors ──────────────────────────────────────────────────────────
  const bg      = darkMode ? '#1e293b' : '#ffffff';
  const border  = darkMode ? '#334155' : '#e2e8f0';
  const text1   = darkMode ? '#f8fafc'  : '#0f172a';
  const text2   = darkMode ? '#94a3b8'  : '#64748b';
  const menuBg  = darkMode ? '#0f172a'  : '#ffffff';

  // ── Button styles ──────────────────────────────────────────────────────────
  const iconBtn = {
    padding: '8px', background: 'transparent', border: 'none',
    cursor: 'pointer', fontSize: '1.15rem', borderRadius: '8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: text1,
  };

  const menuBtn = {
    padding: isMobile ? '7px 10px' : '8px 14px',
    fontSize: isMobile ? '0.78rem' : '0.85rem',
    display: 'flex', alignItems: 'center', gap: '5px',
    background: darkMode ? '#334155' : '#f1f5f9',
    color: text1, border: 'none', borderRadius: '8px',
    cursor: 'pointer', fontWeight: 600,
  };



  return (
    <>
      {analyticsOpen && (
        <AnalyticsModal trackerData={trackerData} onClose={() => setAnalyticsOpen(false)} />
      )}

      <header style={{
        position: 'relative',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: bg,
        padding: isMobile ? '12px 14px' : '14px 18px',
        borderRadius: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: `1px solid ${border}`,
        gap: '8px',
        flexWrap: 'nowrap',
        minWidth: 0,
      }}>

        {/* ── Left: Avatar + Greeting ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
          <div style={{
            width: isMobile ? '36px' : '40px',
            height: isMobile ? '36px' : '40px',
            borderRadius: '12px', background: '#3b82f6', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: isMobile ? '1rem' : '1.1rem', color: '#fff',
          }}>💳</div>

          <div style={{ minWidth: 0 }}>
            {/* On mobile: hide greeting, show only name */}
            {!isMobile && (
              <p style={{
                fontSize: '0.7rem', fontWeight: 500,
                color: text2, marginBottom: '1px',
                whiteSpace: 'nowrap',
              }}>{greeting()},</p>
            )}
            <h1 style={{
              fontSize: isMobile ? '0.95rem' : '1.05rem',
              fontWeight: 700, color: text1,
              letterSpacing: '-0.03em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              maxWidth: isMobile ? 'min(150px, calc(100vw - 130px))' : '200px',
            }}>
              {isMobile ? `${user?.name || 'User'} 👋` : `${user?.name || 'User'} 👋`}
            </h1>
          </div>
        </div>

        {/* ── Right: Actions ── */}
        <div style={{
          display: 'flex', alignItems: 'center',
          gap: isMobile ? '4px' : '8px',
          flexShrink: 0,
        }}>

          {/* Dark mode toggle */}
          <button onClick={() => setDarkMode(d => !d)} style={iconBtn} title="Toggle theme">
            {darkMode ? '☀️' : '🌙'}
          </button>

          {/* Menu dropdown */}
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button onClick={() => setMenuOpen(o => !o)} style={menuBtn}>
              ☰ {!isMobile && 'Menu'}
            </button>

            {menuOpen && (
              <div style={{
                position: 'fixed',
                top: isMobile ? '68px' : '74px',
                right: isMobile ? '12px' : '24px',
                background: menuBg, border: `1px solid ${border}`,
                borderRadius: '12px', padding: '8px', zIndex: 9999,
                display: 'flex', flexDirection: 'column', gap: '4px',
                minWidth: isMobile ? '200px' : '210px',
                maxWidth: 'calc(100vw - 24px)',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              }}>
                <ImportStatement
                  accounts={accounts}
                  onSuccess={() => { fetchTrackerData?.(); setMenuOpen(false); }}
                  darkMode={darkMode}
                />

                <MenuOption
                  icon="📊" label="Analytics" darkMode={darkMode} text1={text1}
                  onClick={() => { setAnalyticsOpen(true); setMenuOpen(false); }}
                />
                <MenuOption
                  icon="↓" label="Download Report" darkMode={darkMode} text1={text1}
                  onClick={() => { setReportOpen(true); setMenuOpen(false); }}
                />

                <div style={{ height: '1px', background: border, margin: '4px 0' }} />

                <MenuOption
                  icon="🔄" label="Reset Data" danger darkMode={darkMode} text1={text1}
                  onClick={async () => {
                    if (window.confirm('⚠️ Reset all data?')) {
                      try { await api.delete('/tracker/reset'); window.location.reload(); }
                      catch (e) { alert('Failed: ' + e.message); }
                    }
                    setMenuOpen(false);
                  }}
                />

                <div style={{ height: '1px', background: border, margin: '4px 0' }} />

                <MenuOption
                  icon="↩" label="Sign Out" danger darkMode={darkMode} text1={text1}
                  onClick={() => { setMenuOpen(false); setIsLoggedIn(false); }}
                />
              </div>
            )}
          </div>


        </div>
      </header>

      {/* ── Report Modal ── */}
      {reportOpen && (
        <div
          onClick={e => e.target === e.currentTarget && setReportOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.6)', zIndex: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div style={{
            maxWidth: '440px', width: '100%', padding: '1.75rem',
            background: bg, color: text1, borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Download Report</h2>
              <button onClick={() => setReportOpen(false)} style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: '1.2rem', color: text2,
              }}>✕</button>
            </div>

            {/* Range Tabs */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '1.25rem' }}>
              {[['all', 'All time'], ['month', 'By month'], ['date', 'By date']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setRangeType(v)} style={{
                  flex: 1, padding: '10px 6px', border: '1.5px solid',
                  borderRadius: '10px', fontWeight: 700, fontSize: '0.75rem',
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: rangeType === v ? '#3b82f6' : 'transparent',
                  borderColor: rangeType === v ? '#3b82f6' : border,
                  color: rangeType === v ? '#fff' : text2,
                }}>{l}</button>
              ))}
            </div>

            {/* Month Range */}
            {rangeType === 'month' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1.25rem' }}>
                <Label2 label="From month" darkMode={darkMode}>
                  <input type="month" value={fromMonth} min={minMonth} max={maxMonth}
                    onChange={e => setFromMonth(e.target.value)} className="field" style={{ width: '100%' }} />
                </Label2>
                <Label2 label="To month" darkMode={darkMode}>
                  <input type="month" value={toMonth} min={fromMonth || minMonth} max={maxMonth}
                    onChange={e => setToMonth(e.target.value)} className="field" style={{ width: '100%' }} />
                </Label2>
              </div>
            )}

            {/* Date Range */}
            {rangeType === 'date' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1.25rem' }}>
                <Label2 label="From date" darkMode={darkMode}>
                  <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                    className="field" style={{ width: '100%' }} />
                </Label2>
                <Label2 label="To date" darkMode={darkMode}>
                  <input type="date" value={toDate} min={fromDate} onChange={e => setToDate(e.target.value)}
                    className="field" style={{ width: '100%' }} />
                </Label2>
              </div>
            )}

            {/* Download Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button onClick={() => download('pdf')} style={{
                borderRadius: '12px', padding: '12px',
                background: '#ef4444', color: '#fff',
                border: 'none', cursor: 'pointer', fontWeight: 800, fontFamily: 'inherit',
              }}>📄 PDF</button>
              <button onClick={() => download('excel')} style={{
                borderRadius: '12px', padding: '12px',
                background: '#22c55e', color: '#fff',
                border: 'none', cursor: 'pointer', fontWeight: 800, fontFamily: 'inherit',
              }}>📊 Excel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Menu Option ──────────────────────────────────────────────────────────────
function MenuOption({ icon, label, onClick, danger, darkMode, text1 }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', textAlign: 'left',
        padding: '10px 12px', fontSize: '0.85rem',
        background: hover ? (darkMode ? '#1e293b' : '#f8fafc') : 'transparent',
        border: 'none', cursor: 'pointer', borderRadius: '8px',
        color: danger ? '#ef4444' : text1,
        display: 'flex', alignItems: 'center', gap: '8px',
        fontFamily: 'inherit', fontWeight: 500,
        transition: 'background 0.15s',
      }}
    >
      <span>{icon}</span> {label}
    </button>
  );
}

// ─── Label Helper ─────────────────────────────────────────────────────────────
function Label2({ label, children, darkMode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={{
        fontSize: '0.7rem', fontWeight: 700,
        color: darkMode ? '#94a3b8' : '#64748b',
        textTransform: 'uppercase',
      }}>{label}</span>
      {children}
    </div>
  );
}