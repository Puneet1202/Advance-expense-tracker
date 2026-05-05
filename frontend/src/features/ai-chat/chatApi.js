/**
 * chatApi.js (frontend)
 * Backend ke AI chat route se baat karta hai.
 *
 * FIX: Ab transactions aur balances frontend se nahi bhejte.
 *      Backend D1 se seedha data fetch karta hai.
 *      Sirf message aur history bhejte hain.
 */

import api from '../../api/axios';

/**
 * AI se message bhejta hai aur reply leta hai
 * @param {string} message - User ka message
 * @param {Array}  _transactions - UNUSED (backend ab D1 se leta hai)
 * @param {Array}  _balances     - UNUSED (backend ab D1 se leta hai)
 * @param {Array}  history       - Chat history [{role, content}] — last 8
 * @returns {Promise<{reply: string|null, action: object|null}>}
 */
export async function sendChatMessage(message, _transactions, _balances, history) {
  let usdRate = 83; // fallback
  try {
    const cached = localStorage.getItem('currency_cache');
    if (cached) {
      const json = JSON.parse(cached);
      if (json.data && json.data.USD) {
        usdRate = (1 / json.data.USD).toFixed(2);
      }
    }
  } catch (e) { /* ignore */ }

  const res = await api.post('/tracker/ai-chat', {
    message,
    history: history.slice(-8),
    usdRate
  }, {
    timeout: 300000,
  });
  return res.data;
}
