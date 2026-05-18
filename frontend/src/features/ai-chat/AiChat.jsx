/**
 * AiChat.jsx — AI Chatbot panel (3 tabs: Chat, Insights, Rules)
 * Floating chat panel — WhatsApp style.
 * Props: trackerData, fetchTrackerData, onClose
 */

import { useEffect, useRef } from 'react';
import { useAiChat } from './useAiChat';
import { CATEGORY_CONFIG } from '../../components/dashboard/CategoryChart';

// ── Formatting helpers ────────────────────────────────────────────────────────
const fmt = n => '₹' + Math.round(n).toLocaleString('en-IN');

function parseMarkdown(text) {
  // Bold **text** → <strong>
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : part
    );
}

// ── Suggested chips ────────────────────────────────────────────────────────────
const CHIPS = [
  'Is mahine faltu kharche?',
  'Kitna save karoon?',
  'Mera top expense category?',
  'SBI mein 500 Swiggy add karo',
];

// ── TAB 1: Chat ───────────────────────────────────────────────────────────────
function ChatTab({ messages, input, setInput, isLoading, handleSend, actionStatus, clearHistory }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Action status toast */}
      {actionStatus && (
        <div style={{
          background: actionStatus.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
          color: actionStatus.type === 'success' ? '#22c55e' : 'var(--red)',
          border: `1px solid ${actionStatus.type === 'success' ? 'rgba(34,197,94,0.3)' : 'var(--red)'}`,
          borderRadius: '10px', padding: '8px 12px', fontSize: '0.78rem',
          fontWeight: 600, textAlign: 'center', marginBottom: '8px', flexShrink: 0,
        }}>
          {actionStatus.text}
        </div>
      )}

      {/* Clear button — only when messages exist */}
      {messages.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px', flexShrink: 0 }}>
          <button onClick={clearHistory}
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: '8px',
              padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: '0.68rem', color: 'var(--text-4)', transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-4)'}
          >
            🗑 Clear
          </button>
        </div>
      )}

      {/* Message list */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex',
        flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>

        {/* Empty state + chips */}
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px' }}>
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '2rem', marginBottom: '6px' }}>🤖</div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-3)', fontWeight: 500 }}>
                Namaste! Main aapka finance assistant hoon.
              </p>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-4)', fontWeight: 600,
              letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '4px' }}>
              Suggested
            </p>
            {CHIPS.map(chip => (
              <button key={chip} onClick={() => handleSend(chip)}
                style={{
                  background: 'var(--bg-3)', border: '1px solid var(--border)',
                  borderRadius: '10px', padding: '9px 13px', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: '0.8rem', color: 'var(--text-2)',
                  textAlign: 'left', transition: 'all 0.15s', fontWeight: 500,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-glow)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        {messages.map((m, i) => {
          const isUser = m.role === 'user';
          return (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column',
              alignItems: isUser ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '88%', padding: '10px 13px', borderRadius: isUser
                  ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: isUser ? 'var(--accent)' : 'var(--bg-3)',
                border: isUser ? 'none' : '1px solid var(--border)',
                color: isUser ? '#fff' : 'var(--text-1)',
                fontSize: '0.83rem', lineHeight: 1.55, fontWeight: 450,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {parseMarkdown(m.content)}
              </div>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-4)',
                marginTop: '3px', paddingLeft: '4px', paddingRight: '4px' }}>
                {new Date(m.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}

        {/* Loading indicator */}
        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{
              background: 'var(--bg-3)', border: '1px solid var(--border)',
              borderRadius: '16px 16px 16px 4px', padding: '12px 16px',
              display: 'flex', gap: '5px', alignItems: 'center',
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: 'var(--accent)', opacity: 0.4,
                  animation: `chatBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: '8px', paddingTop: '10px',
        borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Message likho..."
          disabled={isLoading}
          className="field"
          style={{ flex: 1, padding: '9px 13px', fontSize: '0.83rem', borderRadius: '12px' }}
        />
        <button onClick={() => handleSend()} disabled={isLoading || !input.trim()}
          style={{
            width: '38px', height: '38px', borderRadius: '12px', border: 'none',
            background: input.trim() && !isLoading ? 'var(--accent)' : 'var(--border)',
            color: '#fff', cursor: input.trim() && !isLoading ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1rem', flexShrink: 0, transition: 'background 0.2s',
          }}>
          ↑
        </button>
      </div>

      <style>{`
        @keyframes chatBounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── TAB 2: Insights ───────────────────────────────────────────────────────────
function InsightsTab({ trackerData }) {
  const { transactions = [], total_income = 0, total_expenses = 0, accounts = [] } = trackerData;

  // Category breakdown
  const catMap = {};
  transactions.filter(t => t.type === 'expense').forEach(t => {
    const cat = t.category || 'General';
    catMap[cat] = (catMap[cat] || 0) + t.amount;
  });
  const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
  const ratio = total_income > 0 ? ((total_expenses / total_income) * 100).toFixed(0) : 0;
  const savings = total_income - total_expenses;
  const savingPct = total_income > 0 ? ((savings / total_income) * 100).toFixed(0) : 0;

  // Saving tip based on data
  let savingTip = '💡 Regular expense track karna hi sabse bada financial habit hai!';
  if (Number(ratio) > 90) savingTip = '⚠️ Expenses bahut zyada hain! Is mahine ek luxury kharcha band karo.';
  else if (topCat && topCat[0] === 'Food') savingTip = '🍕 Food pe zyada kharcha ho raha hai. Ghar ka khana try karo!';
  else if (topCat && topCat[0] === 'Shopping') savingTip = '🛍️ Shopping pe dhyan do. "24-hour rule" try karo — khareedne se pehle 1 din ruko.';
  else if (Number(savingPct) > 20) savingTip = `🎉 Badiya! Aap ${savingPct}% save kar rahe ho. Isko SIP mein invest karo!`;

  const stats = [
    { label: 'Is Mahine Expense', value: fmt(total_expenses), color: 'var(--red)', icon: '↓' },
    { label: 'Is Mahine Income', value: fmt(total_income), color: 'var(--green)', icon: '↑' },
    { label: 'Expense Ratio', value: `${ratio}%`, color: Number(ratio) > 80 ? 'var(--red)' : 'var(--accent)', icon: '📊' },
    { label: 'Savings', value: fmt(Math.max(0, savings)), color: savings >= 0 ? 'var(--green)' : 'var(--red)', icon: '💰' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
      {/* Stat cards */}
      {stats.map(s => (
        <div key={s.label} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '11px 13px', borderRadius: '12px',
          background: 'var(--bg-3)', border: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-3)', fontWeight: 600 }}>{s.label}</span>
          <span style={{ fontSize: '0.88rem', fontWeight: 800, color: s.color, letterSpacing: '-0.03em' }}>
            {s.icon} {s.value}
          </span>
        </div>
      ))}

      {/* Top category */}
      {topCat && (() => {
        const cfg = CATEGORY_CONFIG[topCat[0]] || CATEGORY_CONFIG.Other;
        return (
          <div style={{ padding: '11px 13px', borderRadius: '12px',
            background: cfg.bg, border: `1px solid ${cfg.border}` }}>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
              Top Expense Category
            </p>
            <p style={{ fontSize: '0.9rem', fontWeight: 800, color: cfg.color }}>
              {cfg.emoji} {topCat[0]} — {fmt(topCat[1])}
            </p>
          </div>
        );
      })()}

      {/* AI Saving Tip */}
      <div style={{ padding: '12px 13px', borderRadius: '12px',
        background: 'var(--accent-glow)', border: '1px solid rgba(91,91,214,0.22)' }}>
        <p style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px' }}>
          🤖 AI Tip
        </p>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.5 }}>
          {savingTip}
        </p>
      </div>
    </div>
  );
}

// ── TAB 3: Rules ──────────────────────────────────────────────────────────────
function RulesTab({ rules, setRules, saveRules, rulesSaved }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
      <p style={{ fontSize: '0.76rem', color: 'var(--text-3)', lineHeight: 1.5, flexShrink: 0 }}>
        💡 Yahan custom instructions likho — AI in rules ke hisaab se baat karega.
        <br />Example: "Hamesha INR mein baat kar" ya "Food pe zyada mat kharcho bolna"
      </p>
      <textarea
        value={rules}
        onChange={e => setRules(e.target.value)}
        placeholder="Apni instructions yahan likho..."
        rows={8}
        className="field"
        style={{ flex: 1, resize: 'none', fontFamily: 'inherit',
          fontSize: '0.82rem', lineHeight: 1.6, minHeight: '160px' }}
      />
      <button onClick={saveRules}
        style={{
          width: '100%', padding: '10px', borderRadius: '12px',
          border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          fontWeight: 700, fontSize: '0.85rem',
          background: rulesSaved ? 'var(--green)' : 'var(--accent)',
          color: '#fff', transition: 'background 0.3s', flexShrink: 0,
        }}>
        {rulesSaved ? '✅ Saved!' : '💾 Save Karo'}
      </button>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export default function AiChat({ trackerData, fetchTrackerData, onClose }) {
  const hook = useAiChat({ trackerData, fetchTrackerData });
  const TABS = [
    { id: 'chat',     label: '💬 Chat'     },
    { id: 'insights', label: '📈 Insights' },
    { id: 'rules',    label: '⚙️ Rules'    },
  ];

  return (
    <div style={{
      position: 'fixed', right: '24px', bottom: '90px',
      width: 'min(380px, calc(100vw - 48px))',
      height: 'min(80vh, 620px)',
      background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: '20px', boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      zIndex: 9998,
      animation: 'chatSlideUp 0.25s cubic-bezier(0.34,1.56,0.64,1) both',
    }}>
      <style>{`@keyframes chatSlideUp { from { opacity:0; transform:translateY(24px) scale(0.97); } to { opacity:1; transform:none; } }`}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px 10px',
        background: 'var(--accent)', flexShrink: 0, borderRadius: '20px 20px 0 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.2)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
            🤖
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.88rem', color: '#fff', letterSpacing: '-0.02em' }}>
              Finance Assistant
            </p>
            <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)' }}>
              Powered by Llama 3 & Supabase
            </p>
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.15)', border: 'none',
          color: '#fff', width: '28px', height: '28px', borderRadius: '8px',
          cursor: 'pointer', fontSize: '0.85rem', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>✕</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--bg-3)',
        borderBottom: '1px solid var(--border)', flexShrink: 0, padding: '4px 8px', gap: '2px' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => hook.setActiveTab(t.id)}
            style={{
              flex: 1, padding: '7px 4px', border: 'none', borderRadius: '9px',
              fontFamily: 'inherit', fontWeight: 600, fontSize: '0.72rem', cursor: 'pointer',
              transition: 'all 0.18s',
              background: hook.activeTab === t.id ? 'var(--surface)' : 'transparent',
              color: hook.activeTab === t.id ? 'var(--accent)' : 'var(--text-3)',
              boxShadow: hook.activeTab === t.id ? 'var(--shadow-sm)' : 'none',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '12px 14px', display: 'flex', flexDirection: 'column' }}>
        {hook.activeTab === 'chat' && (
          <ChatTab
            messages={hook.messages}
            input={hook.input} setInput={hook.setInput}
            isLoading={hook.isLoading}
            handleSend={hook.handleSend}
            actionStatus={hook.actionStatus}
            clearHistory={hook.clearHistory}
          />
        )}
        {hook.activeTab === 'insights' && (
          <InsightsTab trackerData={trackerData} />
        )}
        {hook.activeTab === 'rules' && (
          <RulesTab
            rules={hook.rules} setRules={hook.setRules}
            saveRules={hook.saveRules} rulesSaved={hook.rulesSaved}
          />
        )}
      </div>
    </div>
  );
}
