import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Bot, Trash2, CheckCircle2, AlertCircle, ArrowUp } from "lucide-react";
import { sendChatMessage } from "./chatApi";

export default function AiChat({ trackerData, fetchTrackerData, onClose }) {
  const { transactions = [], accounts = [] } = trackerData;

  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ai_chat_history') || '[]'); } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState(null);
  const scrollRef = useRef(null);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  // Save history
  useEffect(() => {
    try { localStorage.setItem('ai_chat_history', JSON.stringify(messages.slice(-50))); } catch {}
  }, [messages]);

  // Toast auto-clear
  useEffect(() => {
    if (actionStatus) {
      const t = setTimeout(() => setActionStatus(null), 3000);
      return () => clearTimeout(t);
    }
  }, [actionStatus]);

  const addMsg = (role, content) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), role, content, ts: Date.now() }].slice(-50));
  };

  const handleSend = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || isLoading) return;
    setInput("");
    addMsg("user", msg);
    setIsLoading(true);

    try {
      // Clean History Mapping
      const history = messages.slice(-6).map(m => ({ 
        role: m.role === 'ai' || m.role === 'assistant' ? 'assistant' : 'user', 
        content: m.content 
      }));

      // CLEAN ACTION: Sahi clean payload pass karo, heavy arrays bhejni band!
      const result = await sendChatMessage(msg, history);

      // Agar backend ne direct decision process karke reply diya (SQL response ya direct action success message)
      if (result.reply) {
        addMsg("assistant", result.reply);
        
        // Edge check: Agar reply mein backend ne bola ki transaction add/delete ho gayi, toh dashboard refresh maaro
        if (result.reply.includes("add kar diya") || result.reply.includes("remove") || result.reply.includes("Undo")) {
          setActionStatus({ type: "success", message: "Dashboard updated" });
          fetchTrackerData?.();
        }
      }

    } catch (err) {
      addMsg("assistant", `⚠️ ${err.response?.data?.message || err.message || 'Something went wrong. Please try again.'}`);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, fetchTrackerData]);

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem('ai_chat_history');
    setActionStatus({ type: "success", message: "History cleared" });
  };

  const parseMarkdown = (text) => {
    return text.split(/(\*\*.*?\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : part
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 30, scale: 0.95 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      style={{
        position: 'fixed', right: '24px', bottom: '90px',
        width: 'min(380px, calc(100vw - 48px))',
        height: 'min(80vh, 560px)',
        backgroundColor: 'var(--bg)', borderColor: 'var(--border)',
        zIndex: 9998, borderRadius: '24px', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        border: '1px solid var(--border)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--accent)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot size={22} color="#fff" />
          </div>
          <div>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.88rem', margin: 0 }}>Finance Assistant</p>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.65rem', margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Powered by AI</p>
          </div>
        </div>
        <button onClick={onClose} style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
            <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🤖</div>
            <p style={{ color: 'var(--text-4)', fontSize: '0.85rem', fontWeight: 500 }}>Ask me anything...</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={clearHistory} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-3)', fontSize: '0.68rem', cursor: 'pointer', fontWeight: 700 }}>
                <Trash2 size={11} /> Clear
              </button>
            </div>
            {messages.map(msg => (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%', padding: '10px 14px', fontSize: '0.83rem', lineHeight: 1.55,
                  borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                  background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-3)',
                  border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text-1)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {parseMarkdown(msg.content)}
                </div>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-4)', marginTop: '3px', padding: '0 4px' }}>
                  {new Date(msg.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </>
        )}

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ padding: '12px 16px', borderRadius: '20px 20px 20px 4px', background: 'var(--bg-3)', border: '1px solid var(--border)', display: 'flex', gap: '5px' }}>
              {[0, 0.2, 0.4].map((delay, i) => (
                <motion.div key={i} animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay }}
                  style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)', opacity: 0.5 }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      <AnimatePresence>
        {actionStatus && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            style={{ position: 'absolute', bottom: '80px', left: '50%', transform: 'translateX(-50%)', padding: '8px 16px', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '6px', background: actionStatus.type === 'success' ? 'var(--green)' : 'var(--red)', color: '#fff', fontSize: '0.75rem', fontWeight: 700, zIndex: 10, whiteSpace: 'nowrap' }}
          >
            {actionStatus.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {actionStatus.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-3)', borderRadius: '16px', padding: '4px 4px 4px 14px' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Type a message..."
            disabled={isLoading}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: '0.83rem', color: 'var(--text-1)', fontFamily: 'inherit' }}
          />
          <button onClick={() => handleSend()} disabled={!input.trim() || isLoading}
            style={{ width: '36px', height: '36px', borderRadius: '12px', border: 'none', background: input.trim() && !isLoading ? 'var(--accent)' : 'var(--border)', color: '#fff', cursor: input.trim() && !isLoading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.2s' }}>
            <ArrowUp size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}