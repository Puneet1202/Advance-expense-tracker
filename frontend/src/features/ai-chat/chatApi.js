/**
 * chatApi.js (frontend)
 * Backend ke AI chat route se baat karta hai.
 * Existing axios instance use karta hai (cookies auto-handle).
 */

import api from '../../api/axios';

/**
 * AI se message bhejta hai aur reply leta hai
 * @param {string} message - User ka message
 * @param {Array} transactions - Full transaction list (financial context ke liye)
 * @param {Array} balances - Account balances [{name, balance, id}]
 * @param {Array} history - Chat history [{role, content}] — last 8
 * @returns {Promise<{reply: string|null, action: object|null}>}
 */
export async function sendChatMessage(message, transactions, balances, history) {
  const res = await api.post('/tracker/ai-chat', {
    message,
    transactions: transactions.slice(0, 50), // Last 50 — token limit
    balances,
    history: history.slice(-8),
  }, {
    timeout: 30000,
  });
  return res.data;
}
