/**
 * index.js (ai-chat backend route)
 * Route: POST /api/tracker/ai-chat
 * Body: { message, history }
 *
 * FIX: Ab frontend se transactions nahi aate.
 * D1 database se seedha 3 queries chalake exact data nikalta hai.
 *
 * Auth: authMiddleware se protected (tracker.routes.js)
 */

import { handleChat } from './chat-handler.js';

export const aiChatHandler = async (c) => {
  try {
    const user        = c.get('user');
    const db          = c.env.expense_tracker_db;
    const geminiApiKey = c.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      return c.json({ message: 'Gemini API key configure nahi hai', status: 500 }, 500);
    }

    const body = await c.req.json();
    const { message, history = [] } = body;   // transactions ab frontend se NAHI aate

    if (!message?.trim()) {
      return c.json({ message: 'Message empty nahi ho sakta', status: 400 }, 400);
    }

    // ── Query 1: Is mahine ki transactions (D1 se) ───────────────────────────
    const txnResult = await db.prepare(`
      SELECT t.id, t.type, t.amount, t.description, t.created_at,
             a.name AS account_name
      FROM   TRANSACTIONS t
      LEFT JOIN ACCOUNTS a ON t.account_id = a.id
      WHERE  t.user_id = ?
        AND  t.is_hidden = 0
        AND  strftime('%Y-%m', t.created_at) = strftime('%Y-%m', 'now')
      ORDER BY t.created_at DESC
    `).bind(user.id).all();

    const transactions = txnResult.results || [];

    // ── Query 2: Account balances (all-time income - expense per account) ────
    const allTxnResult = await db.prepare(`
      SELECT t.account_id, t.type, t.amount
      FROM   TRANSACTIONS t
      WHERE  t.user_id = ?
        AND  t.is_hidden = 0
    `).bind(user.id).all();

    const accountsResult = await db.prepare(
      `SELECT id, name FROM ACCOUNTS WHERE user_id = ?`
    ).bind(user.id).all();

    const accounts = (accountsResult.results || []).map(acc => {
      let balance = 0;
      (allTxnResult.results || []).forEach(t => {
        if (t.account_id === acc.id) {
          balance += t.type === 'income' ? t.amount : -t.amount;
        }
      });
      return { name: acc.name, balance: Math.round(balance) };
    });

    // ── Query 3: Category-wise expense total (is mahine) ─────────────────────
    // Note: category column may not exist — we group by description pattern in handler
    // So we pass raw transactions and let chat-handler compute category totals
    // (This is more reliable than relying on a category column that may be NULL)

    // ── Call Gemini ──────────────────────────────────────────────────────────
    const result = await handleChat(message, transactions, accounts, history, geminiApiKey);

    return c.json({ ...result, status: 200 }, 200);

  } catch (error) {
    console.error('AI Chat Error:', error);
    return c.json({
      message: error.message || 'Chat mein error aaya',
      status: 500,
    }, 500);
  }
};
