/**
 * AnalyticsModal.jsx
 * Full-screen analytics modal — category-wise donut chart,
 * ranked category list with progress bars, and monthly income vs expense bar chart.
 * Uses CATEGORY_CONFIG + guessCategory from CategoryChart.jsx.
 * Props: trackerData, onClose
 */

import { CATEGORY_CONFIG, guessCategory } from './CategoryChart';

const fmt = n => '₹' + Math.round(n).toLocaleString('en-IN');

// ── Donut Chart (SVG) ─────────────────────────────────────────────────────────
function DonutChart({ slices, total }) {
  const SIZE = 200, R = 78, CX = 100, CY = 100;
  const CIRC = 2 * Math.PI * R;
  let cum = 0;

  const paths = slices.map(s => {
    const pct = s.amt / total;
    const offset = CIRC * (1 - cum);
    const dash = CIRC * pct;
    cum += pct;
    return { ...s, offset, dash };
  });

  return (
    <div style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}>
      <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border)" strokeWidth="22" />
        {paths.map(s => (
          <circle key={s.cat} cx={CX} cy={CY} r={R}
            fill="none" stroke={s.color} strokeWidth="22"
            strokeDasharray={`${s.dash} ${CIRC - s.dash}`}
            strokeDashoffset={s.offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.7s ease' }}
          />
        ))}
      </svg>
      {/* Centre label */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Total</span>
        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.04em' }}>{fmt(total)}</span>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-4)' }}>expenses</span>
      </div>
    </div>
  );
}

// ── Monthly Bar Chart (pure CSS) ──────────────────────────────────────────────
function MonthlyBarChart({ transactions }) {
  // Group by YYYY-MM
  const byMonth = {};
  transactions.forEach(t => {
    const m = (t.created_at || '').substring(0, 7);
    if (!m) return;
    if (!byMonth[m]) byMonth[m] = { income: 0, expense: 0 };
    if (t.type === 'income') byMonth[m].income += t.amount;
    else byMonth[m].expense += t.amount;
  });

  const months = Object.keys(byMonth).sort().slice(-6); // last 6 months
  if (months.length === 0) return null;

  const maxVal = Math.max(...months.flatMap(m => [byMonth[m].income, byMonth[m].expense]), 1);

  const monthLabel = m => {
    const [y, mo] = m.split('-');
    return new Date(Number(y), Number(mo) - 1).toLocaleString('en-IN', { month: 'short', year: '2-digit' });
  };

  return (
    <div>
      <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-1)',
        letterSpacing: '-0.02em', marginBottom: '1rem' }}>
        📅 Monthly Income vs Expense
      </p>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', height: '140px' }}>
        {months.map(m => {
          const { income, expense } = byMonth[m];
          const inPct = (income / maxVal) * 100;
          const exPct = (expense / maxVal) * 100;
          return (
            <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: '3px', height: '100%', justifyContent: 'flex-end' }}>
              {/* Bars */}
              <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', width: '100%', height: '110px' }}>
                <div style={{ flex: 1, borderRadius: '4px 4px 0 0',
                  background: 'var(--green)', height: `${inPct}%`, minHeight: income > 0 ? '3px' : 0,
                  transition: 'height 0.6s ease', title: fmt(income) }} />
                <div style={{ flex: 1, borderRadius: '4px 4px 0 0',
                  background: 'var(--red)', height: `${exPct}%`, minHeight: expense > 0 ? '3px' : 0,
                  transition: 'height 0.6s ease' }} />
              </div>
              {/* Month label */}
              <span style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 600,
                whiteSpace: 'nowrap' }}>{monthLabel(m)}</span>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '10px', justifyContent: 'center' }}>
        {[['var(--green)', 'Income'], ['var(--red)', 'Expense']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: c }} />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 600 }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function AnalyticsModal({ trackerData, onClose }) {
  const { transactions = [] } = trackerData;

  // Category totals (expenses only)
  const expenseTxns = transactions.filter(t => t.type === 'expense');
  const grandTotal = expenseTxns.reduce((s, t) => s + t.amount, 0);

  const totalsMap = {};
  expenseTxns.forEach(t => {
    const cat = guessCategory(t);
    totalsMap[cat] = (totalsMap[cat] || 0) + t.amount;
  });
  const sorted = Object.entries(totalsMap)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => ({ cat, amt, cfg: CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.Other }));

  const hasExpenses = grandTotal > 0;

  return (
    <div
      className="modal-bg"
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ zIndex: 9999, alignItems: 'flex-start', overflowY: 'auto', padding: '1.5rem' }}
    >
      <div
        className="card anim-card"
        style={{
          width: '100%', maxWidth: '680px', margin: 'auto',
          padding: '1.75rem 2rem', boxShadow: 'var(--shadow-xl)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '1.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800,
              letterSpacing: '-0.04em', color: 'var(--text-1)', marginBottom: '2px' }}>
              📊 Analytics
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
              {transactions.length} transactions · Category breakdown
            </p>
          </div>
          <button id="analytics-close-btn" className="btn btn-icon"
            onClick={onClose} style={{ fontSize: '1rem' }}>✕</button>
        </div>

        {!hasExpenses ? (
          <div style={{ textAlign: 'center', padding: '3rem 0',
            color: 'var(--text-4)', fontSize: '0.9rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📭</div>
            Koi expense nahi mila abhi tak.
          </div>
        ) : (
          <>
            {/* ── Section 1: Donut + Category list ── */}
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap',
              alignItems: 'center', marginBottom: '2rem' }}>

              {/* Donut */}
              <DonutChart
                slices={sorted.map(s => ({ cat: s.cat, amt: s.amt, color: s.cfg.color }))}
                total={grandTotal}
              />

              {/* Category list */}
              <div style={{ flex: 1, minWidth: '220px', display: 'flex',
                flexDirection: 'column', gap: '10px' }}>
                {sorted.map(({ cat, amt, cfg }) => {
                  const pct = grandTotal > 0 ? (amt / grandTotal * 100) : 0;
                  return (
                    <div key={cat}>
                      <div style={{ display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px',
                          fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-1)' }}>
                          <span style={{
                            background: cfg.bg, border: `1px solid ${cfg.border}`,
                            color: cfg.color, padding: '2px 7px', borderRadius: '7px',
                            fontSize: '0.75rem',
                          }}>
                            {cfg.emoji} {cat}
                          </span>
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-2)',
                          fontWeight: 700, letterSpacing: '-0.02em' }}>
                          {fmt(amt)}{' '}
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-4)',
                            fontWeight: 500 }}>
                            {pct.toFixed(0)}%
                          </span>
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div style={{ height: '6px', borderRadius: '99px',
                        background: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: '99px',
                          background: cfg.color, width: `${pct}%`,
                          transition: 'width 0.7s ease',
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px solid var(--border)', marginBottom: '1.75rem' }} />

            {/* ── Section 2: Monthly bar chart ── */}
            <MonthlyBarChart transactions={transactions} />
          </>
        )}
      </div>
    </div>
  );
}
