/**
 * CategoryChart.jsx
 * Category-wise expense breakdown chart — pure CSS, no external library.
 * Donut chart + legend bars dikhata hai.
 * Props: transactions (array from trackerData)
 */

// Category config — badge ke liye bhi yahi use hota hai
export const CATEGORY_CONFIG = {
  Food:      { emoji: '🍕', color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)',  label: 'Food'      },
  Shopping:  { emoji: '🛍️', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', label: 'Shopping'  },
  Bills:     { emoji: '💡', color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.3)',  label: 'Bills'     },
  Fuel:      { emoji: '⛽', color: '#eab308', bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.3)',   label: 'Fuel'      },
  Transport: { emoji: '🚗', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)', label: 'Transport' },
  Salary:    { emoji: '💰', color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)',  label: 'Salary'    },
  Transfer:  { emoji: '🔄', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)', label: 'Transfer'  },
  Other:     { emoji: '📦', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)', label: 'Other'     },
};

/**
 * Description se category guess karta hai (AI-imported transactions ke liye)
 * Ya transaction description mein category keyword dhundta hai
 */
export function guessCategory(t) {
  // Pehle agar description mein koi known category ka naam hai
  const desc = (t.description || '').toLowerCase();

  if (/salary|stipend|payroll/.test(desc)) return 'Salary';
  if (/swiggy|zomato|restaurant|food|cafe|hotel|eat|meal|biryani|pizza|burger/.test(desc)) return 'Food';
  if (/amazon|flipkart|myntra|shopping|mall|mart|store|shop/.test(desc)) return 'Shopping';
  if (/petrol|diesel|fuel|hp|bpcl|iocl|shell|indian oil/.test(desc)) return 'Fuel';
  if (/uber|ola|metro|bus|train|cab|auto|rapido|transport/.test(desc)) return 'Transport';
  if (/electricity|water|gas|dth|broadband|internet|bill|recharge|jio|airtel/.test(desc)) return 'Bills';
  if (/transfer|neft|imps|rtgs|upi|sent|received/.test(desc)) return 'Transfer';

  // income type ko Salary/Other mein rakhte hain
  if (t.type === 'income') return 'Salary';

  return 'Other';
}

// Fmt helper
const fmtNum = n => '₹' + Math.round(n).toLocaleString('en-IN');

export default function CategoryChart({ transactions }) {
  if (!transactions || transactions.length === 0) return null;

  // Sirf expenses count karo
  const expenseTxns = transactions.filter(t => t.type === 'expense');
  if (expenseTxns.length === 0) return null;

  // Category wise total nikalo
  const totals = {};
  let grandTotal = 0;
  expenseTxns.forEach(t => {
    const cat = guessCategory(t);
    totals[cat] = (totals[cat] || 0) + t.amount;
    grandTotal += t.amount;
  });

  // Sort by amount desc
  const sorted = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6); // max 6 categories dikhao

  if (sorted.length === 0 || grandTotal === 0) return null;

  // Donut chart — SVG se banate hain (pure, no lib)
  const SIZE = 120;
  const RADIUS = 46;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const cx = SIZE / 2, cy = SIZE / 2;

  let cumulativePct = 0;
  const slices = sorted.map(([cat, amt]) => {
    const pct = amt / grandTotal;
    const offset = CIRCUMFERENCE * (1 - cumulativePct);
    const dash = CIRCUMFERENCE * pct;
    cumulativePct += pct;
    const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.Other;
    return { cat, amt, pct, offset, dash, color: cfg.color };
  });

  return (
    <div className="card anim-up d4" style={{ padding: '1.25rem' }}>
      <p style={{ fontWeight: 700, fontSize: '0.875rem', letterSpacing: '-0.03em',
        color: 'var(--text-1)', marginBottom: '1rem' }}>
        📊 Category Breakdown
      </p>

      <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>

        {/* Donut Chart */}
        <div style={{ flexShrink: 0 }}>
          <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)' }}>
            {/* Background circle */}
            <circle cx={cx} cy={cy} r={RADIUS}
              fill="none" stroke="var(--border)" strokeWidth="16" />
            {/* Slices */}
            {slices.map(s => (
              <circle key={s.cat} cx={cx} cy={cy} r={RADIUS}
                fill="none"
                stroke={s.color}
                strokeWidth="16"
                strokeDasharray={`${s.dash} ${CIRCUMFERENCE - s.dash}`}
                strokeDashoffset={s.offset}
                style={{ transition: 'stroke-dasharray 0.6s ease' }}
              />
            ))}
            {/* Center text — rotated back */}
            <text x={cx} y={cy - 6} textAnchor="middle"
              style={{ transform: `rotate(90deg)`, transformOrigin: `${cx}px ${cy}px`,
                fill: 'var(--text-1)', fontSize: '11px', fontWeight: 700, fontFamily: 'inherit' }}>
              Expenses
            </text>
            <text x={cx} y={cy + 10} textAnchor="middle"
              style={{ transform: `rotate(90deg)`, transformOrigin: `${cx}px ${cy}px`,
                fill: 'var(--text-3)', fontSize: '9px', fontFamily: 'inherit' }}>
              {sorted.length} cats
            </text>
          </svg>
        </div>

        {/* Legend + bars */}
        <div style={{ flex: 1, minWidth: '140px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {sorted.map(([cat, amt]) => {
            const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.Other;
            const pct = (amt / grandTotal * 100).toFixed(0);
            return (
              <div key={cat}>
                <div style={{ display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: '3px' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-2)',
                    display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>{cfg.emoji}</span> {cat}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 500 }}>
                    {pct}% · {fmtNum(amt)}
                  </span>
                </div>
                {/* Bar */}
                <div style={{ height: '5px', borderRadius: '99px',
                  background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: '99px',
                    background: cfg.color,
                    width: `${pct}%`,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
