/**
 * ImportStatement.jsx
 * Yeh component "Import Statement" button aur modal UI render karta hai.
 * User yahan CSV ya PDF upload karta hai aur account select karta hai.
 * Props:
 *   - accounts: array of { id, name } — user ke accounts
 *   - onSuccess: function — dashboard refresh callback
 */

import { useRef, useState } from 'react';
import { useImportStatement } from './useImportStatement';

export default function ImportStatement({ accounts, onSuccess }) {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef(null);

  const {
    selectedFile,
    selectedAccountId,
    setSelectedAccountId,
    isLoading,
    error,
    result,
    pendingBalance,
    balanceLoading,
    handleFileChange,
    handleSubmit,
    handleBalanceConfirm,
    handleBalanceSkip,
    reset,
  } = useImportStatement({ accounts, onSuccess });

  const handleClose = () => {
    reset();
    setOpen(false);
  };

  const handleImportClick = async () => {
    await handleSubmit();
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        id="import-statement-btn"
        className="btn btn-ghost"
        onClick={() => setOpen(true)}
        style={{ padding: '8px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
        title="AI se bank statement import karo"
      >
        🤖 Import Statement
      </button>

      {/* Modal */}
      {open && (
        <div
          className="modal-bg"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
          style={{ zIndex: 9999 }}
        >
          <div
            className="card anim-card"
            style={{ maxWidth: '460px', width: '100%', padding: '1.75rem', boxShadow: 'var(--shadow-xl)' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '2px' }}>
                  🤖 AI Statement Import
                </h2>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                  Powered by Google Gemini Flash
                </p>
              </div>
              <button className="btn btn-icon" onClick={handleClose}>✕</button>
            </div>

            {/* ── Balance Confirmation Step ─────────────────────────── */}
            {result && pendingBalance && (
              <div style={{
                background: 'var(--bg-3)',
                border: '1.5px solid var(--accent)',
                borderRadius: '14px',
                padding: '1.25rem',
                marginBottom: '1rem',
              }}>
                {/* Import summary line */}
                <p style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '8px' }}>
                  ✅ {result.imported} transactions import hue
                  {result.skipped > 0 && <span style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--text-3)', marginLeft: '6px' }}>({result.skipped} duplicate skip)</span>}
                </p>

                {/* Balance confirmation question */}
                <div style={{
                  background: 'var(--accent-glow)',
                  border: '1px solid var(--accent)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '1rem',
                }}>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: '4px', fontWeight: 600 }}>
                    💰 Balance Update Karna Hai?
                  </p>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-1)', fontWeight: 700 }}>
                    {pendingBalance.account_name} balance{' '}
                    <span style={{ color: 'var(--accent)' }}>
                      ₹{pendingBalance.closing_balance.toLocaleString('en-IN')}
                    </span>{' '}
                    update kiya — Sahi hai?
                  </p>
                </div>

                {/* Yes / No buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    id="balance-confirm-yes"
                    className="btn btn-primary"
                    onClick={handleBalanceConfirm}
                    disabled={balanceLoading}
                    style={{ borderRadius: '12px', padding: '10px', fontSize: '0.88rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    {balanceLoading ? (
                      <span style={{
                        display: 'inline-block', width: '13px', height: '13px',
                        border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                      }} />
                    ) : '✅'} Haan, Update Karo
                  </button>
                  <button
                    id="balance-confirm-no"
                    className="btn btn-ghost"
                    onClick={handleBalanceSkip}
                    disabled={balanceLoading}
                    style={{ borderRadius: '12px', padding: '10px', fontSize: '0.88rem' }}
                  >
                    ❌ Nahi, Rehne Do
                  </button>
                </div>
              </div>
            )}

            {/* ── Final Done State (after Yes/No chosen, no pending balance) ── */}
            {result && !pendingBalance && (
              <div style={{
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid #22c55e',
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '1rem',
              }}>
                <p style={{ fontWeight: 700, color: '#22c55e', fontSize: '0.95rem', marginBottom: '4px' }}>
                  ✅ {result.imported} transactions import ho gaye!
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>
                  {result.skipped} duplicate skip • Total {result.total}
                </p>
                <button
                  className="btn btn-ghost"
                  onClick={handleClose}
                  style={{ marginTop: '0.75rem', width: '100%', fontSize: '0.82rem' }}
                >
                  Dashboard dekhein →
                </button>
              </div>
            )}

            {/* Form — hide after import */}
            {!result && (
              <>
                {/* Account Select */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: '6px' }}>
                    Account select karo *
                  </label>
                  <select
                    id="import-account-select"
                    className="field"
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    style={{ width: '100%' }}
                    disabled={isLoading}
                  >
                    <option value="">— Account chunein —</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                </div>

                {/* File Upload */}
                <div
                  onClick={() => !isLoading && fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${selectedFile ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: '12px',
                    padding: '1.5rem',
                    textAlign: 'center',
                    cursor: isLoading ? 'default' : 'pointer',
                    background: selectedFile ? 'var(--accent-glow)' : 'var(--bg-3)',
                    transition: 'all 0.2s',
                    marginBottom: '1rem',
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="import-file-input"
                    accept=".csv,.pdf"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    disabled={isLoading}
                  />
                  {selectedFile ? (
                    <>
                      <p style={{ fontSize: '1.5rem', marginBottom: '4px' }}>📄</p>
                      <p style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--accent)' }}>{selectedFile.name}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: '2rem', marginBottom: '6px' }}>☁️</p>
                      <p style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-2)' }}>
                        Click karke CSV ya PDF upload karo
                      </p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '4px' }}>
                        SBI / HDFC format • Max 10MB
                      </p>
                    </>
                  )}
                </div>

                {/* Error */}
                {error && (
                  <div style={{
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid var(--red)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    marginBottom: '1rem',
                    fontSize: '0.82rem',
                    color: 'var(--red)',
                  }}>
                    ⚠️ {error}
                    {error.includes('fail') && (
                      <button
                        className="btn btn-ghost"
                        onClick={handleImportClick}
                        style={{ marginLeft: '8px', fontSize: '0.75rem', padding: '3px 10px' }}
                        disabled={isLoading}
                      >
                        Retry
                      </button>
                    )}
                  </div>
                )}

                {/* Info box */}
                <div style={{
                  background: 'var(--bg-3)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '0.76rem',
                  color: 'var(--text-3)',
                  marginBottom: '1.25rem',
                  lineHeight: 1.5,
                }}>
                  💡 Gemini AI aapki statement padh ke automatically transactions categorize karega.
                  Duplicate transactions automatically skip ho jaenge.
                </div>

                {/* Submit Button */}
                <button
                  id="import-submit-btn"
                  className="btn btn-primary"
                  onClick={handleImportClick}
                  disabled={isLoading || !selectedFile || !selectedAccountId}
                  style={{
                    width: '100%',
                    borderRadius: '12px',
                    padding: '12px',
                    fontSize: '0.9rem',
                    opacity: (!selectedFile || !selectedAccountId || isLoading) ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  {isLoading ? (
                    <>
                      <span style={{
                        display: 'inline-block', width: '14px', height: '14px',
                        border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff',
                        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                      }} />
                      Gemini se parse ho raha hai...
                    </>
                  ) : (
                    '🚀 Import Karo'
                  )}
                </button>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
