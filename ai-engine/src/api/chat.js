// FILE: ai-engine/src/api/chat.js
// KAAM: Chat routes — user ke questions ka jawab deta hai
//
// FIXES:
//   1. SECURITY — SQL route mein user_id filter:
//      Pehle saare users ki expenses fetch hoti thi — ab sirf us user ki
//      jo request kar raha hai. userId.toString() se type mismatch bhi fix
//   2. SQL route: ab amount + category + description fetch karta hai
//      Pehle sirf amount aur category tha — AI ko description chahiye accurate answer ke liye
//   3. Vector search: userId search.js ko pass hota hai (wahan bhi filter lagegi)

import { Hono } from 'hono'
import { getChatResponse } from '../ai/chat.js'
import { searchRelevantTransactions } from '../vector/search.js'
import { getSupabaseClient } from '../db/supabase.js'
import AI_CONFIG from '../../ai-config.js'

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
        
        // WHY user_id filter: Pehle koi filter nahi tha — saare users ki expenses aati thi
        // Ab sirf us user ki transactions fetch hoti hain jo request kar raha hai
        // WHY description bhi: AI ko context chahiye sirf amount+category se accurate answer nahi deta
        const { data: sqlData, error: sqlError } = await supabase
          .from('transactions')
          .select('amount, category, description, type, created_at')
          .eq('user_id', userId.toString()); // WHY toString(): JWT se userId number ho sakta hai

        if (!sqlError && sqlData) {
          usedDB = true;
          const totalAmount = sqlData.reduce((sum, row) => sum + Number(row.amount), 0);
          const totalCount = sqlData.length;
          const recentDesc = sqlData.slice(0, 5).map(r => `- ${r.description || 'N/A'}: ₹${r.amount} (${r.category || 'N/A'})`).join('\n');
          
          contextText += `\n[EXACT SQL RESULT]\nTotal Transaction Count: ${totalCount}\nAll-Time Total: ₹${totalAmount.toFixed(2)}\nRecent:\n${recentDesc}\n`;
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
