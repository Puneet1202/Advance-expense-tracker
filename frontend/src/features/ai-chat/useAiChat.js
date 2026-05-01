/**
 * useAiChat.js (frontend hook)
 * AI chatbot ka poora state + logic manage karta hai.
 *
 * BUG 3 FIX: Messages ab localStorage mein persist hote hain.
 *   Key: 'ai_chat_history' — max 50 messages, purane delete.
 *   clearHistory() function bhi expose kiya gaya hai.
 */

import { useState, useCallback, useEffect } from 'react';
import { sendChatMessage } from './chatApi';
import api from '../../api/axios';

const RULES_KEY   = 'ai_custom_instructions'; // AiConfigPanel se shared
const HISTORY_KEY = 'ai_chat_history';         // BUG 3: chat persist karne ke liye
const MAX_MSGS    = 50;

// localStorage se messages load karna
function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// localStorage mein messages save karna (max 50)
function saveHistory(msgs) {
  try {
    const trimmed = msgs.slice(-MAX_MSGS);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch { /* storage full — silently ignore */ }
}

export function useAiChat({ trackerData, fetchTrackerData }) {
  const { transactions = [], accounts = [] } = trackerData;
  const balances = accounts.map(a => ({ id: a.id, name: a.name, balance: a.balance }));

  // BUG 3: Mount pe localStorage se load karo
  const [messages, setMessages]         = useState(() => loadHistory());
  const [input, setInput]               = useState('');
  const [isLoading, setIsLoading]       = useState(false);
  const [activeTab, setActiveTab]       = useState('chat');
  const [actionStatus, setActionStatus] = useState(null);

  // BUG 3: Messages change hone pe localStorage sync karo
  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  // Message add karna
  const addMsg = useCallback((role, content, isAction = false) => {
    setMessages(prev => {
      const updated = [...prev, { role, content, isAction, ts: Date.now() }];
      return updated.slice(-MAX_MSGS); // Max 50 rakho
    });
  }, []);

  // ADD_TRANSACTION action handle karna
  const executeAction = useCallback(async (action) => {
    try {
      const { description, amount, type, account_name } = action.data;

      const account = accounts.find(a =>
        a.name.toLowerCase() === account_name?.toLowerCase()
      ) || accounts[0];

      if (!account) {
        addMsg('assistant', '⚠️ Koi account nahi mila. Pehle account add karo.');
        return;
      }

      const txnType = type === 'credit' || type === 'income' ? 'income' : 'expense';

      await api.post('/tracker/transaction', {
        type:        txnType,
        amount:      Math.abs(Number(amount)),
        description: description || 'AI Added',
        account_id:  account.id,
      });

      addMsg('assistant',
        `✅ Transaction add ho gaya!\n**${description}** — ₹${Number(amount).toLocaleString('en-IN')} (${txnType}) → ${account.name}`,
        true
      );

      setActionStatus({ type: 'success', text: `✅ ₹${amount} added to ${account.name}` });
      setTimeout(() => setActionStatus(null), 3000);

      fetchTrackerData?.();
    } catch (err) {
      addMsg('assistant', `❌ Transaction add nahi ho saka: ${err.response?.data?.message || err.message}`);
    }
  }, [accounts, fetchTrackerData, addMsg]);

  // Message bhejna
  const handleSend = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || isLoading) return;

    setInput('');
    addMsg('user', msg);
    setIsLoading(true);

    try {
      const history = messages.slice(-8).map(m => ({
        role:    m.role,
        content: m.content,
      }));

      const { reply, action } = await sendChatMessage(msg, transactions, balances, history);

      if (action?.action === 'ADD_TRANSACTION') {
        await executeAction(action);
      } else if (reply) {
        addMsg('assistant', reply);
      }
    } catch (err) {
      addMsg('assistant', `⚠️ Error: ${err.response?.data?.message || err.message || 'Kuch gadbad ho gayi'}`);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, transactions, balances, executeAction, addMsg]);

  // BUG 3: Chat history clear karna
  const clearHistory = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(HISTORY_KEY);
  }, []);

  // Rules tab (localStorage se)
  const [rules, setRules]       = useState(() => localStorage.getItem(RULES_KEY) || '');
  const [rulesSaved, setRulesSaved] = useState(false);

  const saveRules = () => {
    localStorage.setItem(RULES_KEY, rules);
    setRulesSaved(true);
    setTimeout(() => setRulesSaved(false), 2000);
  };

  return {
    messages,
    input, setInput,
    isLoading,
    activeTab, setActiveTab,
    actionStatus,
    handleSend,
    clearHistory,           // BUG 3: clear button ke liye
    rules, setRules, saveRules, rulesSaved,
  };
}
