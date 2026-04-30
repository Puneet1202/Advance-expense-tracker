import { useState } from 'react';
import { downloadPDF, downloadExcel } from '../../utils/exportUtils';
import api from '../../api/axios';

export default function Header({ user, trackerData, selectedAccountId, setIsLoggedIn,
  currentMonth, setCurrentMonth, availableMonths, darkMode, setDarkMode }) {

  const [reportOpen, setReportOpen] = useState(false);
  const [rangeType, setRangeType]   = useState('all');
  const [fromDate, setFromDate]     = useState('');
  const [toDate, setToDate]         = useState('');
  const [fromMonth, setFromMonth]   = useState('');
  const [toMonth, setToMonth]       = useState('');

  const now = new Date();
  const maxMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const sorted = [...(availableMonths||[])].sort();
  const minMonth = sorted[0] || maxMonth;
  const { accounts } = trackerData;

  const greeting = () => {
    const h = now.getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const download = async (fmt) => {
    try {
      const r = await api.get('/tracker?month=');
      const args = [user, r.data.transactions||[], accounts, selectedAccountId,
        rangeType, fromDate, toDate, fromMonth, toMonth];
      fmt==='pdf' ? downloadPDF(...args) : downloadExcel(...args);
      setReportOpen(false);
    } catch { alert('Failed to fetch report data'); }
  };

  return (
    <>
      <header style={{
        background:'var(--surface)', border:'1px solid var(--border)',
        borderRadius:'var(--radius-lg)', padding:'1rem 1.5rem',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        flexWrap:'wrap', gap:'0.75rem', boxShadow:'var(--shadow-sm)',
        transition:'background 0.3s, border-color 0.3s'
      }}>
        {/* Left */}
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <div style={{
            width:'40px', height:'40px', borderRadius:'12px',
            background:'var(--accent)', display:'flex', alignItems:'center',
            justifyContent:'center', fontSize:'1.1rem', flexShrink:0,
            boxShadow:'0 4px 12px var(--accent-glow)'
          }}>💳</div>
          <div>
            <p style={{ fontSize:'0.72rem', fontWeight:500, color:'var(--text-3)', marginBottom:'1px', letterSpacing:'0.01em' }}>
              {greeting()},
            </p>
            <h1 style={{ fontSize:'1.05rem', fontWeight:700, color:'var(--text-1)',
              letterSpacing:'-0.03em', lineHeight:1.2 }}>
              {user?.name || 'User'} 👋
            </h1>
          </div>
        </div>

        {/* Right controls */}
        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>

          {/* Month picker */}
          <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
            <input type="month" value={currentMonth}
              onChange={e=>setCurrentMonth(e.target.value)}
              min={minMonth} max={maxMonth}
              className="field"
              style={{ width:'auto', padding:'8px 12px', fontSize:'0.82rem' }}
            />
            {currentMonth && (
              <button className="btn btn-ghost" onClick={()=>setCurrentMonth('')}
                style={{ padding:'8px 12px', fontSize:'0.82rem' }}>All</button>
            )}
          </div>

          {/* Report */}
          <button className="btn btn-ghost" onClick={()=>setReportOpen(true)}
            style={{ padding:'8px 14px', fontSize:'0.82rem' }}>
            ↓ Report
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={()=>setDarkMode(d=>!d)}
            className="btn btn-ghost"
            style={{ padding:'8px 12px', fontSize:'1rem', minWidth:'38px' }}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>

          {/* Reset */}
          <button className="btn btn-ghost"
            onClick={async()=>{
              if(window.confirm('⚠️ Reset all data?')) {
                try { await api.delete('/tracker/reset'); window.location.reload(); }
                catch(e){ alert('Failed: '+e.message); }
              }
            }}
            style={{ padding:'8px 12px', fontSize:'0.82rem', color:'var(--red)' }}>
            Reset
          </button>

          {/* Logout */}
          <button className="btn btn-ghost" onClick={()=>setIsLoggedIn(false)}
            style={{ padding:'8px 14px', fontSize:'0.82rem' }}>
            Sign out
          </button>
        </div>
      </header>

      {/* Report Modal */}
      {reportOpen && (
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setReportOpen(false)}>
          <div className="card anim-card" style={{
            maxWidth:'440px', width:'100%', padding:'1.75rem',
            boxShadow:'var(--shadow-xl)'
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
              <h2 style={{ fontSize:'1rem', fontWeight:700, letterSpacing:'-0.03em' }}>Download Report</h2>
              <button className="btn btn-icon" onClick={()=>setReportOpen(false)}>✕</button>
            </div>

            {/* Range tabs */}
            <div style={{ display:'flex', gap:'6px', marginBottom:'1.25rem' }}>
              {[['all','All time'],['month','By month'],['date','By date']].map(([v,l])=>(
                <button key={v} type="button"
                  onClick={()=>setRangeType(v)}
                  style={{
                    flex:1, padding:'8px 6px', border:'1.5px solid', borderRadius:'10px',
                    fontFamily:'inherit', fontWeight:600, fontSize:'0.78rem', cursor:'pointer',
                    letterSpacing:'-0.01em', transition:'all 0.2s',
                    background: rangeType===v ? 'var(--accent-glow)' : 'var(--bg-3)',
                    borderColor: rangeType===v ? 'var(--accent)' : 'var(--border)',
                    color: rangeType===v ? 'var(--accent)' : 'var(--text-3)',
                  }}
                >{l}</button>
              ))}
            </div>

            {rangeType==='month' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'1.25rem' }}>
                <Label2 label="From month"><input type="month" className="field" value={fromMonth} min={minMonth} max={maxMonth} onChange={e=>setFromMonth(e.target.value)}/></Label2>
                <Label2 label="To month"><input type="month" className="field" value={toMonth} min={fromMonth||minMonth} max={maxMonth} onChange={e=>setToMonth(e.target.value)}/></Label2>
              </div>
            )}
            {rangeType==='date' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'1.25rem' }}>
                <Label2 label="From date"><input type="date" className="field" value={fromDate} onChange={e=>setFromDate(e.target.value)}/></Label2>
                <Label2 label="To date"><input type="date" className="field" value={toDate} min={fromDate} onChange={e=>setToDate(e.target.value)}/></Label2>
              </div>
            )}
            {rangeType==='all' && (
              <p style={{ color:'var(--text-3)', fontSize:'0.84rem', marginBottom:'1.25rem',
                background:'var(--bg-3)', padding:'10px 14px', borderRadius:'10px',
                border:'1px solid var(--border)' }}>
                Your complete transaction history will be exported.
              </p>
            )}

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              <button className="btn btn-red" onClick={()=>download('pdf')} style={{borderRadius:'12px'}}>PDF</button>
              <button className="btn btn-green" onClick={()=>download('excel')} style={{borderRadius:'12px'}}>Excel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Label2({ label, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
      <span style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--text-3)' }}>{label}</span>
      {children}
    </div>
  );
}
