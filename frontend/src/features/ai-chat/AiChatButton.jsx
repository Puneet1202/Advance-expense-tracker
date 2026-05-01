/**
 * AiChatButton.jsx — Floating chat button (WhatsApp style)
 * position: fixed, bottom-right
 * Click pe AiChat panel toggle hota hai.
 * Props: trackerData, fetchTrackerData
 */

import { useState } from 'react';
import AiChat from './AiChat';

export default function AiChatButton({ trackerData, fetchTrackerData }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Chat Panel */}
      {open && (
        <AiChat
          trackerData={trackerData}
          fetchTrackerData={fetchTrackerData}
          onClose={() => setOpen(false)}
        />
      )}

      {/* Floating Button */}
      <button
        id="ai-chat-float-btn"
        onClick={() => setOpen(o => !o)}
        title="AI Finance Assistant"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          border: 'none',
          background: open
            ? 'var(--text-3)'
            : 'linear-gradient(135deg, #7c3aed, #5b5bd6)',
          color: '#fff',
          fontSize: '1.4rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 28px rgba(91,91,214,0.45)',
          zIndex: 9999,
          transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1), background 0.2s',
          transform: open ? 'scale(0.92)' : 'scale(1)',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.transform = 'scale(1.1)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = open ? 'scale(0.92)' : 'scale(1)'; }}
      >
        {open ? '✕' : '🤖'}
      </button>
    </>
  );
}
