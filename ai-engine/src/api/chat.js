import { Hono } from 'hono'
import { getChatResponse } from '../ai/chat.js'
import { searchRelevantTransactions } from '../vector/search.js'
import { getSupabaseClient } from '../db/supabase.js'
import AI_CONFIG from '../../ai-config.js'

// FILE: chat.js
// KAAM: Chat routes for AI responses (with smart routing for exact amounts)
// CONNECTS TO: vector/search.js, ai/chat.js, db/supabase.js
// CONFIG: ai-config.js se ENV setting leta hai

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

    let searchStatsInfo = null;
    let usedDB = false;
    let contextText = '';
    
    if (userId) {
      const supabase = getSupabaseClient(c.env);
      const lowerQ = question.toLowerCase();
      
      // Smart Router Keywords
      const sqlKeywords = ["kitna", "total", "sum", "amount", "kitne", "kharcha", "mahine", "din", "income", "kya", "balance", "paise", "kamai", "bache", "ky"];
      const needsExactMath = sqlKeywords.some(kw => lowerQ.includes(kw));

      // 1. Exact SQL Query Execution
      if (needsExactMath) {
        console.log(`🔍 [Smart Router] Exact math needed. Running SQL...`);
        // We skip vector search if exact math is needed to avoid confusing the LLM and save time
        const { data: sqlData, error: sqlError } = await supabase
          .from('expenses')
          .select('amount, category')
          .eq('metadata->>userId', userId.toString());

        if (!sqlError && sqlData) {
          usedDB = true;
          const totalAmount = sqlData.reduce((sum, row) => sum + Number(row.amount), 0);
          const totalCount = sqlData.length;
          
          contextText += `\n[EXACT SQL RESULT]\nTotal Transaction Count in DB: ${totalCount}\n`;
          console.log(`📊 [Smart Router] Fetched ${totalCount} transactions for math.`);
        }
      } else {
        // 2. Vector Search Execution (Only for semantic queries)
        console.log(`🔍 [Smart Router] Running Vector Search for semantic matches...`);
        const { relevantIDs, searchStats } = await searchRelevantTransactions(userId, question, c.env);
        searchStatsInfo = searchStats;

        if (relevantIDs && relevantIDs.length > 0) {
          usedDB = true;
          
          const { data: vectorData, error: vectorError } = await supabase
            .from('expenses')
            .select('*')
            .in('id', relevantIDs);

          if (!vectorError && vectorData) {
            const vectorText = vectorData
              .map(t => `- ${t.description}: ₹${t.amount} (${t.category}) on ${t.date}`)
              .join('\n');
              
            contextText += `\n[SIMILAR EXPENSES (Vector Search)]\n${vectorText}\n`;
            console.log(`📊 [RAG] Injected ${vectorData.length} similar transactions as context`);
          }
        }
      }

      if (contextText) {
        enrichedPrompt += `\n\nUser's Additional Database Context:\n${contextText}`;
      }
    }

    // AI se final jawab maango
    const startTime = Date.now();
    const answer = await getChatResponse(enrichedPrompt, question, history, c.env);
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
