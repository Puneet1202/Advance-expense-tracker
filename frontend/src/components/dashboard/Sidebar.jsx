import { useState, useEffect } from 'react';
import api from '../../api/axios';
import CurrencyWidget from '../CurrencyWidget';
import { fmt } from '../../utils/formatCurrency';

const ICONS = { cash:'💵', upi:'📱', gpay:'📱', phonepe:'📱', hdfc:'🏦', sbi:'🏦',
  bank:'🏦', axis:'🏦', card:'💳', credit:'💳', debit:'💳', wallet:'👝', salary:'💼' };
const getIcon = (name='') => {
  const n = name.toLowerCase();
  return Object.entries(ICONS).find(([k])=>n.includes(k))?.[1] ?? '💰';
};

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

export default function Sidebar({ trackerData, fetchTrackerData, selectedAccountId, setSelectedAccountId }) {
  const { is_saving_mode, expense_limit, accounts } = trackerData;
  const [accName, setAccName]       = useState('');
  const [limitVal, setLimitVal]     = useState(expense_limit || '');
  const [addingAcc, setAddingAcc]   = useState(false);
  const [transferModal, setTransferModal] = useState(null);
  const [showRates, setShowRates]   = useState(() => localStorage.getItem('show_rates') === '1');

  // Mobile mein sections collapse ho sakein
  const [openSection, setOpenSection] = useState(null); // 'saving' | 'accounts' | 'rates'

  const width    = useWindowWidth();
  const isMobile = width < 768;

  const toggleSection = (key) => {
    if (!isMobile) return; // desktop pe hamesha open
    setOpenSection(prev => prev === key ? null : key);
  };

  useEffect(() => {
    if (expense_limit) setLimitVal(expense_limit);
  }, [expense_limit]);

  // Desktop pe default open, mobile pe band
  const isOpen = (key) => !isMobile || openSection === key;

  const toggleSaving = async () => {
    try {
      await api.post('/tracker/settings', { expense_limit: Number(limitVal) || 0, is_saving_mode: !is_saving_mode });
      fetchTrackerData();
    } catch (err) {
      alert('Failed to toggle saving mode: ' + (err.response?.data?.message || err.message));
    }
  };

  const saveLimit = async (e) => {
    e.preventDefault();
    await api.post('/tracker/settings', { expense_limit: Number(limitVal), is_saving_mode });
    fetchTrackerData();
  };

  const addAcc = async (e) => {
    e.preventDefault(); if (!accName.trim()) return;
    setAddingAcc(true);
    try { await api.post('/tracker/account', { name: accName }); setAccName(''); fetchTrackerData(); }
    catch { alert('Failed'); } finally { setAddingAcc(false); }
  };

  const delAcc = async (id, name, ok = false, transferTo = null, autoName = null) => {
    if (!ok && !window.confirm(`Delete "${name}"?`)) return;
    try {
      await api.delete(`/tracker/account/${id}`, { data: { transfer_account_id: transferTo, auto_create_account_name: autoName } });
      setTransferModal(null);
      if (selectedAccountId === id) setSelectedAccountId(null);
      fetchTrackerData();
    } catch (err) {
      if (err.response?.data?.message === 'BALANCE_REMAINING') {
        const others = accounts.filter(a => a.id !== id);
        const isCash = name.toLowerCase() === 'cash';
        setTransferModal({
          id, name, balance: err.response.data.balance, others,
          target: others.length > 0 ? others[0].id : 'new',
          newName: isCash ? '' : 'cash'
        });
      } else {
        alert(`Failed: ${err.response?.data?.details || err.response?.data?.message || err.message}`);
      }
    }
  };

  // ── Section Header (mobile pe tap to expand) ──────────────────────────────
  const SectionHeader = ({ label, sectionKey, extra }) => (
    <div
      onClick={() => toggleSection(sectionKey)}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        cursor: isMobile ? 'pointer' : 'default',
        marginBottom: isOpen(sectionKey) ? '1rem' : 0,
        userSelect: 'none',
      }}
    >
      <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
        {label}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {extra}
        {isMobile && (
          <span style={{
            fontSize: '0.75rem', color: 'var(--text-4)',
            transform: isOpen(sectionKey) ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            display: 'inline-block',
          }}>▼</span>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* ── Saving Mode ── */}
        <div className="card anim-up d1" style={{ padding: '1.25rem' }}>
          <SectionHeader
            label="Saving Mode"
            sectionKey="saving"
            extra={
              <button
                className={`toggle ${is_saving_mode ? 'on' : ''}`}
                onClick={(e) => { e.stopPropagation(); toggleSaving(); }}
              />
            }
          />
          {isOpen('saving') && (
            <>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: is_saving_mode ? '1rem' : 0 }}>
                {is_saving_mode ? 'Budget active' : 'Disabled'}
              </p>
              {is_saving_mode && (
                <form onSubmit={saveLimit} style={{ display: 'flex', gap: '8px', marginTop: '0.5rem' }}>
                  <input
                    type="number" className="field" placeholder="Monthly limit (₹)"
                    value={limitVal} onChange={e => setLimitVal(e.target.value)} required
                    style={{ fontSize: '0.85rem' }}
                  />
                  <button type="submit" className="btn btn-accent"
                    style={{ padding: '10px 14px', borderRadius: '10px', flexShrink: 0 }}>
                    Save
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        {/* ── Accounts ── */}
        <div className="card anim-up d2" style={{ padding: '1.25rem' }}>
          <SectionHeader
            label={`Accounts ${accounts.length > 0 ? `(${accounts.length})` : ''}`}
            sectionKey="accounts"
          />

          {isOpen('accounts') && (
            <>
              {/* Add account form */}
              <form onSubmit={addAcc} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="text" className="field" placeholder="e.g. Cash, HDFC, UPI"
                  value={accName} onChange={e => setAccName(e.target.value)} required
                  style={{ fontSize: '0.85rem' }}
                />
                <button type="submit" className="btn btn-accent"
                  disabled={addingAcc}
                  style={{ padding: '10px 14px', borderRadius: '10px', flexShrink: 0, fontSize: '1.1rem' }}>
                  +
                </button>
              </form>

              {/* Account list */}
              <div style={{
                display: 'flex', flexDirection: 'column', gap: '6px',
                maxHeight: isMobile ? '200px' : '260px', overflowY: 'auto'
              }}>
                {accounts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-4)', fontSize: '0.82rem' }}>
                    No accounts yet
                  </div>
                ) : accounts.map(acc => {
                  const selected = selectedAccountId === acc.id;
                  return (
                    <div key={acc.id} role="button" tabIndex={0}
                      onClick={() => setSelectedAccountId(selected ? null : acc.id)}
                      onKeyDown={e => { if (e.key === 'Enter') setSelectedAccountId(selected ? null : acc.id); }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', borderRadius: '12px', cursor: 'pointer',
                        border: selected ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                        background: selected ? 'var(--accent-glow)' : 'var(--bg-3)',
                        transition: 'all 0.2s ease', width: '100%', fontFamily: 'inherit',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <span style={{ fontSize: '1.1rem' }}>{getIcon(acc.name)}</span>
                        <div style={{ minWidth: 0 }}>
                          <p style={{
                            fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-1)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                          }}>{acc.name}</p>
                          <p className="num" style={{
                            fontSize: '0.78rem', fontWeight: 700,
                            color: acc.balance < 0 ? 'var(--red)' : 'var(--green)'
                          }}>{fmt(Math.abs(acc.balance || 0))}{acc.balance < 0 ? ' ↓' : ''}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); delAcc(acc.id, acc.name); }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-4)', fontSize: '0.8rem', padding: '4px',
                          borderRadius: '6px', transition: 'color 0.2s', flexShrink: 0,
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-4)'}
                      >✕</button>
                    </div>
                  );
                })}
              </div>

              {selectedAccountId && (
                <button className="btn btn-ghost" onClick={() => setSelectedAccountId(null)}
                  style={{ width: '100%', marginTop: '8px', fontSize: '0.8rem', padding: '8px' }}>
                  Clear filter
                </button>
              )}
            </>
          )}
        </div>

        {/* ── Live Rates ── */}
        <div className="card anim-up d3" style={{ padding: '1.25rem' }}>
          <SectionHeader
            label="Live Rates"
            sectionKey="rates"
            extra={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.1rem' }}>💱</span>
                <button
                  className={`toggle ${showRates ? 'on' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = !showRates;
                    setShowRates(next);
                    localStorage.setItem('show_rates', next ? '1' : '0');
                  }}
                />
              </div>
            }
          />
          {isOpen('rates') && !showRates && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-4)', marginTop: '6px' }}>
              Toggle on to view live exchange rates
            </p>
          )}
        </div>

        {showRates && <CurrencyWidget />}
      </div>

      {/* ── Transfer Modal ── */}
      {transferModal && (
        <div className="modal-bg">
          <div className="card anim-card" style={{
            maxWidth: '380px', width: '90%', padding: '1.75rem',
            boxShadow: 'var(--shadow-xl)'
          }}>
            <h3 style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.03em', marginBottom: '0.75rem' }}>
              Transfer balance
            </h3>
            <p style={{ color: 'var(--text-3)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              <b style={{ color: 'var(--text-1)' }}>{transferModal.name}</b> has {fmt(transferModal.balance)}.
              {transferModal.others.length > 0 ? ' Select where to transfer it:' : ''}
            </p>

            {transferModal.others.length > 0 ? (
              <select className="field" style={{ marginBottom: '1.25rem' }}
                value={transferModal.target}
                onChange={e => setTransferModal({ ...transferModal, target: Number(e.target.value) })}>
                {transferModal.others.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({fmt(a.balance)})</option>
                ))}
              </select>
            ) : (
              <input type="text" className="field" placeholder="New account name"
                style={{ marginBottom: '1.25rem' }}
                value={transferModal.newName}
                onChange={e => setTransferModal({ ...transferModal, newName: e.target.value })} />
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setTransferModal(null)}>Cancel</button>
              <button className="btn btn-red" onClick={() => {
                const to = transferModal.target === 'new' ? null : transferModal.target;
                const an = transferModal.target === 'new' ? transferModal.newName.trim() : null;
                if (transferModal.target === 'new' && !an) { alert('Enter account name'); return; }
                if (transferModal.target === 'new' && an.toLowerCase() === transferModal.name.toLowerCase()) {
                  alert(`You cannot use the same name "${an}" for the new account.`); return;
                }
                delAcc(transferModal.id, transferModal.name, true, to, an);
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}