/**
 * useAiChat.js (frontend hook)
 * AI chatbot ka poora state + logic manage karta hai.
 * - Messages history
 * - Loading state
 * - Action handler (ADD_TRANSACTION)
 * - Tab state
 */

import { useState, useCallback } from 'react';
import { sendChatMessage } from './chatApi';
import api from '../../api/axios';

const STORAGE_KEY = 'ai_custom_instructions'; // AiConfigPanel se shared

export function useAiChat({ trackerData, fetchTrackerData }) {
  const { transactions = [], accounts = [] } = trackerData;
  const balances = accounts.map(a => ({ id: a.id, name: a.name, balance: a.balance }));

  const [messages, setMessages]     = useState([]);
  const [input, setInput]           = useState('');
  const [isLoading, setIsLoading]   = useState(false);
  const [activeTab, setActiveTab]   = useState('chat');
  const [actionStatus, setActionStatus] = useState(null); // {type:'success'|'error', text}

  // AI message add karna
  const addMsg = (role, content, isAction = false) => {
    setMessages(prev => [...prev, { role, content, isAction, ts: Date.now() }]);
  };

  // ADD_TRANSACTION action handle karna
  const executeAction = useCallback(async (action) => {
    try {
      const { description, amount, type, account_name } = action.data;

      // account_name se account_id dhundhna
      const account = accounts.find(a =>
        a.name.toLowerCase() === account_name?.toLowerCase()
      ) || accounts[0]; // fallback to first account

      if (!account) {
        addMsg('assistant', '⚠️ Koi account nahi mila. Pehle account add karo.');
        return;
      }

      // type normalize: debit → expense, credit → income
      const txnType = type === 'credit' || type === 'income' ? 'income' : 'expense';

      await api.post('/tracker/transaction', {
        type: txnType,
        amount: Math.abs(Number(amount)),
        description: description || 'AI Added',
        account_id: account.id,
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
  }, [accounts, fetchTrackerData]);

  // Message bhejna
  const handleSend = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || isLoading) return;

    setInput('');
    addMsg('user', msg);
    setIsLoading(true);

    try {
      // History build karo (last 8 messages)
      const history = messages.slice(-8).map(m => ({
        role: m.role,
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
  }, [input, isLoading, messages, transactions, balances, executeAction]);

  // Rules tab ke liye (localStorage se)
  const [rules, setRules] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [rulesSaved, setRulesSaved] = useState(false);

  const saveRules = () => {
    localStorage.setItem(STORAGE_KEY, rules);
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
    rules, setRules, saveRules, rulesSaved,
  };
}
