/**
 * index.js (ai-chat backend route)
 * Route: POST /api/tracker/ai-chat
 * Body: { message, transactions, balances, history }
 * Response: { reply, action? }
 *
 * Auth: authMiddleware se protected (tracker.routes.js mein register hai)
 */

import { handleChat } from './chat-handler.js';

export const aiChatHandler = async (c) => {
  try {
    const user = c.get('user'); // authMiddleware se milta hai
    const geminiApiKey = c.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      return c.json({ message: 'Gemini API key configure nahi hai', status: 500 }, 500);
    }

    const body = await c.req.json();
    const { message, transactions = [], balances = [], history = [] } = body;

    if (!message?.trim()) {
      return c.json({ message: 'Message empty nahi ho sakta', status: 400 }, 400);
    }

    const result = await handleChat(message, transactions, balances, history, geminiApiKey);

    return c.json({ ...result, status: 200 }, 200);

  } catch (error) {
    console.error('AI Chat Error:', error);
    return c.json({
      message: error.message || 'Chat mein error aaya',
      status: 500,
    }, 500);
  }
};
