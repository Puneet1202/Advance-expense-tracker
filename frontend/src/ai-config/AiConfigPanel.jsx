/**
 * AiConfigPanel.jsx (Dynamic Layer)
 * Component jo user ki custom AI instructions ko seedha database mein update karta hai.
 */

import { useState, useEffect } from 'react';
import api from '../../api/axios'; // Tumhara global axios instance

export default function AiConfigPanel({ trackerData, fetchTrackerData, onClose }) {
  const [instructions, setInstructions] = useState('');
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Live state/trackerData se initial value load karo (No localStorage dependency!)
  useEffect(() => {
    if (trackerData?.custom_instructions) {
      setInstructions(trackerData.custom_instructions);
    }
  }, [trackerData]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      // Direct API hit to update user settings in database
      await api.post('/tracker/settings', {
        expense_limit: trackerData?.expense_limit || 0,
        is_saving_mode: !!trackerData?.is_saving_mode,
        custom_instructions: instructions.trim()
      });

      setSaved(true);
      fetchTrackerData?.(); // Pure dashboard ka state fresh reload karo!
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save AI instructions:", err);
      alert("⚠️ Settings save nahi ho payi. Kripya dubara try karein.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (window.confirm('Kya aap custom instructions ko clear karna chahte hain?')) {
      try {
        await api.post('/tracker/settings', {
          expense_limit: trackerData?.expense_limit || 0,
          is_saving_mode: !!trackerData?.is_saving_mode,
          custom_instructions: '' // Send empty string to clear out
        });
        setInstructions('');
        fetchTrackerData?.();
      } catch (err) {
        console.error("Failed to reset AI instructions:", err);
      }
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
              🧠 AI System Config Panel
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', lineHeight: 1.4 }}>
              Yahan custom instructions likho — Tumhara AI Engine live inhi rules ke hisaab se transact aur search karega.
            </p>
          </div>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Info Box */}
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
          💡 <strong>Best Practice Example:</strong> "Hamesha dosto ki tarah Hinglish mein baat karo. Meri cash transactions ki category default 'Personal' set karo, aur Zomato ko strictly 'Food' likho."
        </div>

        {/* Textarea */}
        <textarea
          id="ai-instructions-textarea"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Yahan apni rules ya preferences type karein..."
          rows={10}
          className="field"
          disabled={isSaving}
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

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            id="ai-save-instructions-btn"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isSaving}
            style={{ flex: 1, borderRadius: '12px', padding: '10px', fontSize: '0.85rem' }}
          >
            {isSaving ? '⏳ Saving...' : saved ? '✅ Saved Live!' : '💾 Save & Deploy'}
          </button>
          <button
            className="btn btn-ghost"
            onClick={handleReset}
            disabled={isSaving}
            style={{ padding: '10px 16px', fontSize: '0.82rem', color: 'var(--red)' }}
          >
            Reset
          </button>
        </div>

        <p style={{ fontSize: '0.72rem', color: 'var(--text-4)', marginTop: '0.75rem', textAlign: 'center' }}>
          ⚡ Live Sync Active: Yeh instructions seedha database layer se compute hoti hain.
        </p>
      </div>
    </div>
  );
}