import { Hono } from 'hono'
import { askAI } from '../ollama/client.js'
import { searchRelevantTransactions } from '../rag/indexer.js'
import { AI_CONFIG } from '../../ai-config.js'

export const chatRoute = new Hono()

/**
 * CHAT ROUTE: User ke sawalon ka jawab
 * URL: POST /api/chat/
 * Body: { question, systemPrompt, history, userId }
 */
chatRoute.post('/', async (c) => {
  try {
    const { question, systemPrompt, history = [], userId } = await c.req.json();
    if (!question) return c.json({ error: "Question missing" }, 400);

    let enrichedPrompt = systemPrompt || AI_CONFIG.prompts.expenseTracker;

    // RAG: Agar userId diya toh relevant transactions dhundte hain
    let searchStatsInfo = null;
    let usedDB = false;

    if (userId) {
      console.log(`🔍 [RAG] Searching context for user: ${userId}`);

      const { relevantIDs, searchStats } = await searchRelevantTransactions(userId, question, c.env);
      searchStatsInfo = searchStats;

      if (relevantIDs && relevantIDs.length > 0) {
        usedDB = true;
        const db = c.env.expense_tracker_db || c.env.DB;

        // D1 se relevant rows uthao (IN clause with proper binding)
        const placeholders = relevantIDs.map(() => '?').join(',');
        const { results } = await db
          .prepare(`SELECT * FROM TRANSACTIONS WHERE id IN (${placeholders})`)
          .bind(...relevantIDs)
          .all();

        const contextText = results
          .map(t => `- ${t.description}: ₹${t.amount} (${t.type}) on ${t.created_at}`)
          .join('\n');

        enrichedPrompt += `\n\nUser's Relevant Transaction History:\n${contextText}`;
        console.log(`📊 [RAG] Injected ${results.length} transactions as context`);
      }
    }

    // AI se final jawab maango
    const startTime = Date.now();
    const answer = await askAI(enrichedPrompt, question, history, c.env);
    const duration = Date.now() - startTime;

    // Token Approximation (1 token ≈ 4 chars)
    const promptTokens = Math.round(enrichedPrompt.length / 4);
    const responseTokens = Math.round(answer.length / 4);

    console.log(`\n================= 🤖 AI ENGINE INFO =================`);
    console.log(`⏱️  Response Time    : ${duration}ms`);
    console.log(`📏  Prompt Length    : ~${promptTokens} tokens (${enrichedPrompt.length} chars)`);
    console.log(`📝  Response Length  : ~${responseTokens} tokens (${answer.length} chars)`);
    console.log(`=====================================================\n`);

    return c.json({ 
      answer,
      usedDatabaseContext: usedDB, 
      diagnostics: {
        ai_engine: {
          responseTime_ms: duration,
          promptTokens_approx: promptTokens,
          responseTokens_approx: responseTokens
        },
        vector_search: searchStatsInfo
      }
    });

  } catch (error) {
    console.error("❌ Chat Error:", error.message);
    return c.json({ error: error.message }, 500);
  }
});

export default chatRoute;