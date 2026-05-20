/**
 * chatApi.js (frontend)
 * Backend ke AI chat route se baat karta hai.
 *
 * FIX: Payload size reduced. Heavy arrays removed.
 * Only sending message, history, and current USD conversion rate.
 */

import api from '../../api/axios';

/**
 * AI se message bhejta hai aur reply leta hai
 * @param {string} message - User ka message
 * @param {Array}  history - Chat history [{role, content}] — last 6-8 messages
 * @returns {Promise<{reply: string|null, action: object|null}>}
 */
export async function sendChatMessage(message, historyOrTransactions = [], _balances = [], legacyHistory = null) {
  const rawHistory = Array.isArray(legacyHistory) ? legacyHistory : historyOrTransactions;
  const history = Array.isArray(rawHistory)
    ? rawHistory
        .filter(item => item && typeof item.content === 'string')
        .slice(-6)
        .map(item => ({
          role: item.role === 'assistant' ? 'assistant' : 'user',
          content: item.content.length > 300 ? `${item.content.slice(0, 300)}... [truncated]` : item.content
        }))
    : [];

  let usdRate = 83; // fallback default
  
  // Local storage se active exchange rate nikaalo agar cached hai
  try {
    const cached = localStorage.getItem('currency_cache');
    if (cached) {
      const json = JSON.parse(cached);
      if (json.data && json.data.USD) {
        // Calculate dynamic conversion rate
        usdRate = (1 / json.data.USD).toFixed(2);
      }
    }
  } catch (e) { 
    console.error("Currency cache reading failed:", e);
  }

  // Pure clean REST call to backend
  const res = await api.post('/tracker/ai-chat', {
    message,
    history,
    usdRate: Number(usdRate)
  }, {
    timeout: 300000, // 5 mins timeout for heavy background analytics queries
  });

  return res.data;
}
