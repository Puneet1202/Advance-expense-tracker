import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { fmt } from '../../utils/formatCurrency';
import { CATEGORY_CONFIG } from './CategoryChart';
import { createPortal } from 'react-dom';

// ─── Currency Config ─────────────────────────────────────────────────────────
const CACHE_KEY = 'currency_cache';

const CURRENCIES = [
  { code: 'INR', symbol: '₹', flag: '🇮🇳' },
  { code: 'USD', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', flag: '🇬🇧' },
  { code: 'AED', symbol: 'د.إ', flag: '🇦🇪' },
  { code: 'SAR', symbol: '﷼', flag: '🇸🇦' },
  { code: 'JPY', symbol: '¥', flag: '🇯🇵' },
  { code: 'CAD', symbol: 'C$', flag: '🇨🇦' },
  { code: 'AUD', symbol: 'A$', flag: '🇦🇺' },
  { code: 'SGD', symbol: 'S$', flag: '🇸🇬' },
];

const convertToINR = async (amount, fromCurrency) => {
  if (fromCurrency === 'INR') return amount;
  const cached = localStorage.getItem(CACHE_KEY);
  let rates = null;
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < 12 * 60 * 60 * 1000) rates = data;
  }
  if (!rates) {
    const API_KEY = import.meta.env.VITE_EXCHANGE_RATE_API_KEY;
    const res = await fetch(`https://v6.exchangerate-api.com/v6/${API_KEY}/latest/INR`);
    const json = await res.json();
    if (json.result !== 'success') throw new Error('Currency API error');
    rates = json.conversion_rates;
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data: rates, timestamp: Date.now() }));
  }
  return parseFloat((amount * (1 / rates[fromCurrency])).toFixed(2));
};

const fmtDate = s => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// ─── Transaction Item (with category tag + delete) ────────────────────────────
const TransactionItem = ({ t, onDelete }) => {
  const cat = t.category || 'General';
  const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.Other;

  return (
    <div className="anim-up" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '11px 13px', borderRadius: '12px',
      background: 'var(--surface-2)', border: '1px solid var(--border)', gap: '8px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0, flex: 1 }}>
        <div style={{
          width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: t.type === 'income' ? 'var(--green-bg)' : 'var(--red-bg)',
          border: `1px solid ${t.type === 'income' ? 'var(--green-border)' : 'var(--red-border)'}`
        }}>
          {t.type === 'income' ? '↑' : '↓'}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-1)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          }}>{t.description}</p>
          <p style={{
            fontSize: '0.72rem', color: 'var(--text-4)', marginTop: '2px',
            display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap'
          }}>
            <span style={{
              background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
              padding: '1px 7px', borderRadius: '6px', fontWeight: 600, fontSize: '0.68rem',
              display: 'flex', alignItems: 'center', gap: '3px'
            }}>
              {cfg.emoji} {cat}
            </span>
            <span style={{
              background: 'var(--bg-4)', padding: '1px 7px',
              borderRadius: '6px', color: 'var(--text-3)', fontWeight: 500
            }}>{t.account_name}</span>
            <span>{fmtDate(t.created_at)}</span>
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <span className="num" style={{
          fontWeight: 800, fontSize: '0.88rem',
          color: t.type === 'income' ? 'var(--green)' : 'var(--red)'
        }}>
          {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
        </span>
        <button type="button" onClick={() => onDelete(t.id)} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)',
          fontSize: '0.85rem', padding: '2px 4px', borderRadius: '6px'
        }}>✕</button>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TransactionArea({
  trackerData, fetchTrackerData,
  selectedAccountId, setSelectedAccountId, currentMonth
}) {
  const { total_income, total_expenses, expense_limit, is_saving_mode, transactions, accounts } = trackerData;

  const [form, setForm] = useState({
    type: 'expense', amount: '', description: '', account_id: '', currency: 'INR'
  });
  const [busy, setBusy] = useState(false);
  const [inrPreview, setInrPreview] = useState(null);
  const [converting, setConverting] = useState(false);
  const [showAll, setShowAll] = useState(false);


  const [deleteModal, setDeleteModal] = useState({ open: false, id: null });

  const VISIBLE_COUNT = 6;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── INR Preview (debounced) ──────────────────────────────────────────────
  useEffect(() => {
    const amount = parseFloat(form.amount);
    if (!amount || form.currency === 'INR') { setInrPreview(null); return; }
    const timer = setTimeout(async () => {
      setConverting(true);
      try {
        const inr = await convertToINR(amount, form.currency);
        setInrPreview(inr);
      } catch { setInrPreview(null); }
      finally { setConverting(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [form.amount, form.currency]);

  // ── Add Transaction ──────────────────────────────────────────────────────
  const addTxn = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      let finalAmount = parseFloat(form.amount);
      if (form.currency !== 'INR') finalAmount = await convertToINR(finalAmount, form.currency);
      const currencyNote = form.currency !== 'INR' ? ` (${form.currency} ${form.amount})` : '';
      const description = form.description || (form.type === 'income' ? 'Income' : 'Expense');
      await api.post('/tracker/transaction', {
        type: form.type, amount: finalAmount,
        description: description + currencyNote,
        account_id: form.account_id ? Number(form.account_id) : null
      });
      setForm({ type: form.type, amount: '', description: '', account_id: '', currency: 'INR' });
      setInrPreview(null);
      fetchTrackerData();
    } catch (err) { alert(err.response?.data?.message || 'Failed'); }
    finally { setBusy(false); }
  };

  // ── Delete Transaction ───────────────────────────────────────────────────
 const delTxn = async (id) => {
  setDeleteModal({ open: true, id });
};

const confirmDelete = async () => {
  await api.delete(`/tracker/transaction/${deleteModal.id}`);
  fetchTrackerData();
  setDeleteModal({ open: false, id: null });
};

  const filtered = transactions.filter(t => !selectedAccountId || t.account_id === selectedAccountId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

    {deleteModal.open && createPortal(
  <div style={{
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 99999
  }}>
    <div style={{
      background: 'var(--bg-card)', borderRadius: '12px',
      padding: '24px', minWidth: '280px', textAlign: 'center'
    }}>
      <p style={{ marginBottom: '16px', fontWeight: 600 }}>Remove this transaction?</p>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <button onClick={confirmDelete} style={{
          background: 'var(--red)', color: '#fff',
          border: 'none', borderRadius: '8px', padding: '8px 20px', cursor: 'pointer'
        }}>OK</button>
        <button onClick={() => setDeleteModal({ open: false, id: null })} style={{
          background: 'var(--bg-2)', border: 'none',
          borderRadius: '8px', padding: '8px 20px', cursor: 'pointer'
        }}>Cancel</button>
      </div>
    </div>
  </div>,
  document.body
)}




      {/* ── Budget Bar ── */}
      {is_saving_mode && expense_limit > 0 && (
        <div className="card anim-up" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <p style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-1)' }}>
              Budget limit — <span className="num">{fmt(expense_limit)}</span>
            </p>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{
              width: `${Math.min((total_expenses / expense_limit) * 100, 100)}%`,
              background: total_expenses >= expense_limit ? 'var(--red)' : 'var(--green)'
            }} />
          </div>
        </div>
      )}

      <div className="content-grid">

        {/* ── Add Transaction Form ── */}
        <div className="card anim-up" style={{ padding: '1.5rem' }}>
          <p style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '1.25rem' }}>Add Transaction</p>
          <form onSubmit={addTxn} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Expense / Income Toggle */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px',
              background: 'var(--bg-3)', borderRadius: '12px', padding: '4px',
              border: '1px solid var(--border)'
            }}>
              {['expense', 'income'].map(t => (
                <button key={t} type="button" onClick={() => set('type', t)} style={{
                  padding: '9px', borderRadius: '9px', border: 'none',
                  fontFamily: 'inherit', fontWeight: 700, fontSize: '0.82rem',
                  cursor: 'pointer',
                  background: form.type === t
                    ? (t === 'expense' ? 'var(--red)' : 'var(--green)')
                    : 'transparent',
                  color: form.type === t ? '#fff' : 'var(--text-3)'
                }}>
                  {t === 'expense' ? '↓ Expense' : '↑ Income'}
                </button>
              ))}
            </div>

            {/* Description */}
            <input
              type="text" className="field" placeholder="Description"
              value={form.description} onChange={e => set('description', e.target.value)}
            />

            {/* Amount + Currency Selector */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="number" className="field" placeholder="0"
                value={form.amount} onChange={e => set('amount', e.target.value)}
                required style={{ flex: 1, minWidth: 0 }}
              />
              <select
                className="field" value={form.currency}
                onChange={e => set('currency', e.target.value)}
                style={{ width: 'auto', flexShrink: 0 }}
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                ))}
              </select>
            </div>

            {/* INR Preview */}
            {converting && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-4)' }}>💱 Converting…</div>
            )}
            {inrPreview && !converting && (
              <div style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>
                💱 Approx: {fmt(inrPreview)}
              </div>
            )}

            {/* Account Select */}
            <select
              className="field" value={form.account_id}
              onChange={e => set('account_id', e.target.value)} required
            >
              <option value="" disabled>Select account</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>

            {/* Submit */}
            <button
              type="submit" disabled={busy}
              style={{
                width: '100%', padding: '12px', borderRadius: '12px', border: 'none',
                fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                background: form.type === 'income' ? 'var(--green)' : 'var(--red)',
                color: '#fff', opacity: busy ? 0.7 : 1
              }}
            >
              {busy ? 'Adding…' : `Add ${form.type === 'income' ? 'Income' : 'Expense'}`}
            </button>
          </form>
        </div>

        {/* ── Transactions List ── */}
        <div className="card anim-up" style={{
          padding: '1.5rem', display: 'flex', flexDirection: 'column', minHeight: '300px'
        }}>
          <p style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '1rem' }}>
            Transactions <span className="badge badge-accent">{filtered.length}</span>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            {filtered.slice(0, VISIBLE_COUNT).map(t => (
              <TransactionItem key={t.id} t={t} onDelete={delTxn} />
            ))}
            {filtered.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--text-4)', marginTop: '2rem' }}>
                No transactions found
              </p>
            )}
          </div>

          {/* View All Button */}
          {filtered.length > VISIBLE_COUNT && (
            <button
              onClick={() => setShowAll(true)}
              style={{
                background: 'var(--bg-3)', border: '1.5px solid var(--border)',
                borderRadius: '12px', padding: '10px', cursor: 'pointer',
                fontWeight: 700, color: 'var(--accent)', marginTop: '12px',
                textAlign: 'center', width: '100%', fontFamily: 'inherit'
              }}
            >
              View all {filtered.length} transactions →
            </button>
          )}
        </div>
      </div>

      {/* ── Show All Popup Modal ── */}
      {showAll && (
        <div
          className="modal-bg"
          style={{ zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) setShowAll(false); }}
        >
          <div className="card anim-card" style={{
            width: '90%', maxWidth: '600px',
            maxHeight: '85vh', minHeight: '200px',
            display: 'flex', flexDirection: 'column',
            padding: '1.5rem',
            margin: '0 auto'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: '1.25rem', flexShrink: 0
            }}>
              <h3 style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-1)' }}>
                All Transactions
                <span className="badge badge-accent" style={{ marginLeft: '8px' }}>
                  {filtered.length}
                </span>
              </h3>
              <button
                onClick={() => setShowAll(false)}
                style={{
                  background: 'var(--bg-3)', border: '1px solid var(--border)',
                  borderRadius: '8px', padding: '6px 12px', cursor: 'pointer',
                  fontWeight: 600, color: 'var(--text-2)', fontFamily: 'inherit', fontSize: '0.82rem'
                }}
              >
                Close ✕
              </button>
            </div>

            {/* Scrollable List */}
            <div style={{
              flex: 1, overflowY: 'auto', display: 'flex',
              flexDirection: 'column', gap: '8px', paddingRight: '4px'
            }}>
              {filtered.map(t => (
                <TransactionItem key={t.id} t={t} onDelete={delTxn} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}