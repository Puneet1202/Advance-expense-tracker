/**
 * AiConfigPanel.jsx
 * Yeh component ek simple UI deta hai jahan aap PROMPT.md mein
 * apni AI instructions likh sakte ho.
 * Future mein: yeh instructions Gemini API call mein add hongi.
 * 
 * Props:
 *   - onClose: function — panel band karne ke liye
 */

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'ai_custom_instructions';

export default function AiConfigPanel({ onClose }) {
  const [instructions, setInstructions] = useState('');
  const [saved, setSaved] = useState(false);

  // localStorage se load karo
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) || '';
    setInstructions(stored);
  }, []);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, instructions);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    if (window.confirm('Custom instructions reset karein?')) {
      setInstructions('');
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <div
      className="modal-bg"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{ zIndex: 9999 }}
    >
      <div
        className="card anim-card"
        style={{ maxWidth: '560px', width: '100%', padding: '1.75rem', boxShadow: 'var(--shadow-xl)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '3px' }}>
              🧠 AI Instructions
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', lineHeight: 1.4 }}>
              Yahan custom instructions likho — AI in instructions ke hisaab se kaam karega.
            </p>
          </div>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Info */}
        <div style={{
          background: 'var(--bg-3)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '10px 14px',
          fontSize: '0.76rem',
          color: 'var(--text-3)',
          marginBottom: '1rem',
          lineHeight: 1.5,
        }}>
          💡 Example: "Meri SBI statement mein UPI transfers ko 'Transfer' category mein daalo,
          aur Zomato/Swiggy ko 'Food' mein."
        </div>

        {/* Textarea */}
        <textarea
          id="ai-instructions-textarea"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Yahan apni instructions likho..."
          rows={10}
          className="field"
          style={{
            width: '100%',
            resize: 'vertical',
            fontFamily: 'inherit',
            fontSize: '0.85rem',
            lineHeight: 1.6,
            marginBottom: '1rem',
            minHeight: '200px',
          }}
        />

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            id="ai-save-instructions-btn"
            className="btn btn-primary"
            onClick={handleSave}
            style={{ flex: 1, borderRadius: '12px', padding: '10px', fontSize: '0.85rem' }}
          >
            {saved ? '✅ Saved!' : '💾 Save Karo'}
          </button>
          <button
            className="btn btn-ghost"
            onClick={handleReset}
            style={{ padding: '10px 16px', fontSize: '0.82rem', color: 'var(--red)' }}
          >
            Reset
          </button>
        </div>

        <p style={{ fontSize: '0.72rem', color: 'var(--text-4)', marginTop: '0.75rem', textAlign: 'center' }}>
          Instructions browser mein save hoti hain · PROMPT.md se sync hogi future mein
        </p>
      </div>
    </div>
  );
}
