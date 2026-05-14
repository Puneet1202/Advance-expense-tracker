// // FILE: ai-engine/src/api/chat.js
// // KAAM: Chat routes — user ke questions ka jawab deta hai
// //
// // FIXES:
// //   1. SECURITY — SQL route mein user_id filter:
// //      Pehle saare users ki expenses fetch hoti thi — ab sirf us user ki
// //      jo request kar raha hai. userId.toString() se type mismatch bhi fix
// //   2. SQL route: ab amount + category + description fetch karta hai
// //      Pehle sirf amount aur category tha — AI ko description chahiye accurate answer ke liye
// //   3. Vector search: userId search.js ko pass hota hai (wahan bhi filter lagegi)

// import { Hono } from 'hono'
// import { getChatResponse } from '../ai/chat.js'
// import { searchRelevantTransactions } from '../vector/search.js'
// import { getSupabaseClient } from '../db/supabase.js'
// import AI_CONFIG from '../../ai-config.js'

// export const chatRoute = new Hono()

// /**
//  * CHAT ROUTE: User ke sawalon ka jawab
//  * URL: POST /api/chat/
//  * Body: { question, systemPrompt, history, userId }
//  */
// chatRoute.post('/', async (c) => {
//   try {
//     const { question, systemPrompt, history = [], userId } = await c.req.json();
//     if (!question) return c.json({ error: "Question missing" }, 400);

//     let enrichedPrompt = systemPrompt || AI_CONFIG.prompts.expenseTracker;

//     let searchStatsInfo = null;
//     let usedDB = false;
//     let contextText = '';
            
//     if (userId) {
//       const supabase = getSupabaseClient(c.env);
//       const lowerQ = question.toLowerCase();
      
//       // Smart Router Keywords
//       const sqlKeywords = ["kitna", "total", "sum", "amount", "kitne", "kharcha", "mahine", "din", "income", "kya", "balance", "paise", "kamai", "bache", "ky"];
//       const needsExactMath = sqlKeywords.some(kw => lowerQ.includes(kw));

//       // 1. Exact SQL Query Execution
//       if (needsExactMath) {
//         console.log(`🔍 [Smart Router] Exact math needed. Running SQL...`);
        
//         // WHY user_id filter: Pehle koi filter nahi tha — saare users ki expenses aati thi
//         // Ab sirf us user ki transactions fetch hoti hain jo request kar raha hai
//         // WHY description bhi: AI ko context chahiye sirf amount+category se accurate answer nahi deta
//         const { data: sqlData, error: sqlError } = await supabase
//           .from('transactions')
//           .select('amount, category, description, type, created_at')
//           .eq('user_id', userId.toString()); // WHY toString(): JWT se userId number ho sakta hai

//         if (!sqlError && sqlData) {
//           usedDB = true;
//           const totalAmount = sqlData.reduce((sum, row) => sum + Number(row.amount), 0);
//           const totalCount = sqlData.length;
//           const recentDesc = sqlData.slice(0, 5).map(r => `- ${r.description || 'N/A'}: ₹${r.amount} (${r.category || 'N/A'})`).join('\n');
          
//           contextText += `\n[EXACT SQL RESULT]\nTotal Transaction Count: ${totalCount}\nAll-Time Total: ₹${totalAmount.toFixed(2)}\nRecent:\n${recentDesc}\n`;
//           console.log(`📊 [Smart Router] Fetched ${totalCount} transactions for math.`);
//         }
//       } else {
//         // 2. Vector Search Execution (Only for semantic queries)
//         console.log(`🔍 [Smart Router] Running Vector Search for semantic matches...`);
//         const { relevantIDs, searchStats } = await searchRelevantTransactions(userId, question, c.env);
//         searchStatsInfo = searchStats;

//         if (relevantIDs && relevantIDs.length > 0) {
//           usedDB = true;
          
//           const { data: vectorData, error: vectorError } = await supabase
//             .from('transactions')
//             .select('id, description, amount, category, type, created_at')
//             .in('id', relevantIDs);

//           if (!vectorError && vectorData) {
//             const vectorText = vectorData
//               .map(t => `- ${t.description}: ₹${t.amount} (${t.category}) on ${t.date}`)
//               .join('\n');
              
//             contextText += `\n[SIMILAR EXPENSES (Vector Search)]\n${vectorText}\n`;
//             console.log(`📊 [RAG] Injected ${vectorData.length} similar transactions as context`);
//           }
//         }
//       }

//       if (contextText) {
//         enrichedPrompt += `\n\nUser's Additional Database Context:\n${contextText}`;
//       }
//     }

//     // AI se final jawab maango
//     const startTime = Date.now();
//     const answer = await getChatResponse(enrichedPrompt, question, history, c.env);
//     const duration = Date.now() - startTime;

//     // Token Approximation (1 token ≈ 4 chars)
//     const promptTokens = Math.round(enrichedPrompt.length / 4);
//     const responseTokens = Math.round(answer.length / 4);

//     console.log(`\n================= 🤖 AI ENGINE INFO =================`);
//     console.log(`⏱️  Response Time    : ${duration}ms`);
//     console.log(`📏  Prompt Length    : ~${promptTokens} tokens (${enrichedPrompt.length} chars)`);
//     console.log(`📝  Response Length  : ~${responseTokens} tokens (${answer.length} chars)`);
//     console.log(`=====================================================\n`);

//     return c.json({ 
//       answer,
//       usedDatabaseContext: usedDB, 
//       diagnostics: {
//         ai_engine: {
//           responseTime_ms: duration,
//           promptTokens_approx: promptTokens,
//           responseTokens_approx: responseTokens
//         },
//         vector_search: searchStatsInfo
//       }
//     });

//   } catch (error) {
//     console.error("❌ Chat Error:", error.message);
//     return c.json({ error: error.message }, 500);
//   }
// });





// FILE: ai-engine/src/api/chat.js
// KAAM: Chat routes — user ke questions ka jawab deta hai
// DIAGNOSTIC: Har call ki poori detail log karta hai
import { Hono } from 'hono'
import { getChatResponse } from '../ai/chat.js'
import { searchRelevantTransactions } from '../vector/search.js'
import { getSupabaseClient } from '../db/supabase.js'
import AI_CONFIG from '../../ai-config.js'



export const chatRoute = new Hono()





// ── Diagnostic Logger ─────────────────────────────────────────────────────────
function createDiagnostic(question) {
  return {
    question,
    route: null,           // 'SQL' ya 'VECTOR'
    dbCalls: [],           // har DB call ki detail
    tokenEstimate: {
      systemPrompt: 0,
      context: 0,
      question: 0,
      response: 0,
      total: 0
    },
    cache: {
      hit: false,
      dataSource: null     // 'frontend_cache' ya 'db_fresh'
    },
    vector: null,          // vector search detail
    timing: {
      dbTotal_ms: 0,
      aiResponse_ms: 0,
      total_ms: 0
    },
    dataScanned: {
      rowsFromDB: 0,
      rowsSentToAI: 0,
      bytesScanned: 0
    }
  };
}

function estimateTokens(text) {
  if (!text) return 0;
  return Math.round(String(text).length / 4);
}

function logDiagnostic(diag, answer) {
  const box = '═'.repeat(60);
  console.log(`\n╔${box}╗`);
  console.log(`║  🔍 AI DIAGNOSTIC REPORT`);
  console.log(`╠${box}╣`);

  // Question
  console.log(`║  ❓ Question     : "${diag.question.substring(0, 60)}"`);
  console.log(`║  🗺️  Route Chosen : ${diag.route === 'SQL' ? '📊 SQL (Exact Math)' : '🧠 VECTOR (Semantic Search)'}`);
  console.log(`║  📦 Data Source  : ${diag.cache.hit ? '✅ Frontend Cache (No DB call!)' : '🔴 Fresh DB Call'}`);

  // DB Calls
  console.log(`╠${'─'.repeat(60)}╣`);
  console.log(`║  🗄️  DB CALLS (${diag.dbCalls.length} total)`);
  diag.dbCalls.forEach((call, i) => {
    console.log(`║    [${i + 1}] Table     : ${call.table}`);
    console.log(`║        Operation  : ${call.operation}`);
    console.log(`║        Rows Found : ${call.rowsFound}`);
    console.log(`║        Time       : ${call.time_ms}ms`);
    console.log(`║        Filter     : ${call.filter || 'none'}`);
    if (i < diag.dbCalls.length - 1) console.log(`║        ─────────────────────────`);
  });

  // Data Scanned
  console.log(`╠${'─'.repeat(60)}╣`);
  console.log(`║  📊 DATA SCANNED`);
  console.log(`║    Rows from DB   : ${diag.dataScanned.rowsFromDB}`);
  console.log(`║    Rows to AI     : ${diag.dataScanned.rowsSentToAI}`);
  console.log(`║    Data Size      : ~${(diag.dataScanned.bytesScanned / 1024).toFixed(2)} KB`);

  // Vector Search (agar hua)
  if (diag.vector) {
    console.log(`╠${'─'.repeat(60)}╣`);
    console.log(`║  🧠 VECTOR SEARCH`);
    console.log(`║    Query Vector   : ${diag.vector.dimensions} dimensions`);
    console.log(`║    Matches Found  : ${diag.vector.matchesFound}`);
    console.log(`║    Threshold      : ${diag.vector.threshold}`);
    if (diag.vector.matches?.length > 0) {
      console.log(`║    Match Scores   :`);
      diag.vector.matches.forEach((m, i) => {
        console.log(`║      [${i + 1}] ID: ${m.id} → ${(m.scorePercent)}% match`);
      });
    } else {
      console.log(`║    ⚠️  No matches found (embedding NULL ya threshold se neeche)`);
    }
  }

  // Tokens
  console.log(`╠${'─'.repeat(60)}╣`);
  console.log(`║  🪙 TOKEN ESTIMATE (1 token ≈ 4 chars)`);
  console.log(`║    System Prompt  : ~${diag.tokenEstimate.systemPrompt} tokens`);
  console.log(`║    DB Context     : ~${diag.tokenEstimate.context} tokens`);
  console.log(`║    Question       : ~${diag.tokenEstimate.question} tokens`);
  console.log(`║    AI Response    : ~${diag.tokenEstimate.response} tokens`);
  console.log(`║    ─────────────────────────────────`);
  console.log(`║    TOTAL          : ~${diag.tokenEstimate.total} tokens`);
  console.log(`║    Cost Estimate  : ~$${(diag.tokenEstimate.total * 0.000002).toFixed(6)}`);

  // Timing
  console.log(`╠${'─'.repeat(60)}╣`);
  console.log(`║  ⏱️  TIMING`);
  console.log(`║    DB Queries     : ${diag.timing.dbTotal_ms}ms`);
  console.log(`║    AI Response    : ${diag.timing.aiResponse_ms}ms`);
  console.log(`║    Total          : ${diag.timing.total_ms}ms`);

  // Cache Status
  console.log(`╠${'─'.repeat(60)}╣`);
  console.log(`║  💾 CACHE STATUS`);
  if (diag.cache.hit) {
    console.log(`║    ✅ Cache HIT — Frontend ne data bheja, DB call skip!`);
    console.log(`║    DB calls saved : ${diag.dbCalls.length === 0 ? 'ALL' : 'PARTIAL'}`);
  } else {
    console.log(`║    ❌ Cache MISS — Fresh DB se data fetch kiya`);
    console.log(`║    💡 Tip: Frontend se transactions bhejo to DB call bachega`);
  }

  console.log(`╚${box}╝\n`);
}

// ── Main Chat Route ───────────────────────────────────────────────────────────
chatRoute.post('/', async (c) => {
  const totalStart = Date.now();

  try {
    const body = await c.req.json();
    const { question, systemPrompt, history = [], userId, transactions: frontendTxns } = body;

    if (!question) return c.json({ error: "Question missing" }, 400);

    // Diagnostic object
    const diag = createDiagnostic(question);

    let enrichedPrompt = systemPrompt || AI_CONFIG.prompts.expenseTracker;
    let contextText = '';
    let usedDB = false;

    if (userId) {
      const supabase = getSupabaseClient(c.env);
      const lowerQ = question.toLowerCase();

      // Smart Router
      // const sqlKeywords = ["kitna", "total", "sum", "amount", "kitne", "kharcha", "mahine", "din", "income", "kya", "balance", "paise", "kamai", "bache", "ky", "add", "kro", "karo", "delete", "hata", "undo", "saving", "mode", "theme", "dark", "light", "currency"];
      
      // const needsExactMath = sqlKeywords.some(kw => lowerQ.includes(kw));
      // ✅ Intent based — smart
// const isActionIntent = /add|kro|karo|delete|hata|undo|remove|insert|save|spending|daalo|lagao|jodo/i.test(lowerQ);
// const isMathIntent = /kitna|total|sum|balance|income|expense|paise|amount|kitne|kamai|kharcha/i.test(lowerQ);

// const needsExactMath = isMathIntent || isActionIntent;
//       diag.route = needsExactMath ? 'SQL' : 'VECTOR';
          const needsExactMath = true;
          diag.route = 'SQL';
      // ── Check: Frontend ne data bheja? (Cache) ────────────────────────────
      if (frontendTxns && Array.isArray(frontendTxns) && frontendTxns.length > 0) {
        diag.cache.hit = true;
        diag.cache.dataSource = 'frontend_cache';
        console.log(`\n💾 [Cache HIT] Frontend ne ${frontendTxns.length} transactions bheje — DB call skip!`);
      }

      // ── SQL Route ─────────────────────────────────────────────────────────
      if (needsExactMath) {
        let sqlData = [];

        if (diag.cache.hit) {
          // Cache se use karo — DB call nahi
          sqlData = frontendTxns;
          diag.dataScanned.rowsFromDB = 0;
        } else {
          // DB se fetch karo
          const dbStart = Date.now();
          const { data, error: sqlError } = await supabase
            .from('transactions')
            .select('amount, category, description, type, created_at')
            .eq('user_id', userId.toString());
          const dbTime = Date.now() - dbStart;

          diag.dbCalls.push({
            table: 'transactions',
            operation: 'SELECT (SQL Route)',
            rowsFound: data?.length || 0,
            time_ms: dbTime,
            filter: `user_id = ${userId}`
          });
          diag.timing.dbTotal_ms += dbTime;
          diag.dataScanned.rowsFromDB = data?.length || 0;
          sqlData = data || [];
        }

        if (sqlData.length > 0) {
          usedDB = true;
          const totalAmount = sqlData.reduce((sum, row) => sum + Number(row.amount), 0);
          const totalCount = sqlData.length;
          const recentDesc = sqlData.slice(0, 5)
            .map(r => `- ${r.description || 'N/A'}: ₹${r.amount} (${r.category || 'N/A'})`)
            .join('\n');

          contextText += `\n[EXACT SQL RESULT]\nTotal Transaction Count: ${totalCount}\nAll-Time Total: ₹${totalAmount.toFixed(2)}\nRecent:\n${recentDesc}\n`;

          diag.dataScanned.rowsSentToAI = Math.min(5, totalCount);
          diag.dataScanned.bytesScanned = JSON.stringify(sqlData).length;
        }
      }

      // ── Vector Route ──────────────────────────────────────────────────────
      
      if (contextText) {
        enrichedPrompt += `\n\nUser's Additional Database Context:\n${contextText}`;
      }
    }

    // ── AI Call ───────────────────────────────────────────────────────────────
    const aiStart = Date.now();
    const answer = await getChatResponse(enrichedPrompt, question, history, c.env);
    diag.timing.aiResponse_ms = Date.now() - aiStart;
    diag.timing.total_ms = Date.now() - totalStart;

    // Token estimates
    diag.tokenEstimate.systemPrompt = estimateTokens(enrichedPrompt);
    diag.tokenEstimate.context      = estimateTokens(contextText);
    diag.tokenEstimate.question     = estimateTokens(question);
    diag.tokenEstimate.response     = estimateTokens(answer);
    diag.tokenEstimate.total        = diag.tokenEstimate.systemPrompt +
                                      diag.tokenEstimate.context +
                                      diag.tokenEstimate.question +
                                      diag.tokenEstimate.response;

    // ── Print Full Diagnostic ─────────────────────────────────────────────────
    logDiagnostic(diag, answer);

    return c.json({
      answer,
      usedDatabaseContext: usedDB,
      diagnostics: {
        route: diag.route,
        dbCallsCount: diag.dbCalls.length,
        rowsScanned: diag.dataScanned.rowsFromDB,
        cacheHit: diag.cache.hit,
        tokenEstimate: diag.tokenEstimate,
        timing: diag.timing,
        vector: diag.vector
      }
    });

  } catch (error) {
    console.error("❌ Chat Error:", error.message);
    return c.json({ error: error.message }, 500);
  }
});

