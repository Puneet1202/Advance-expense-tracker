



// FILE: ai-engine/src/api/chat.js
// KAAM: Chat routes — user ke questions ka jawab deta hai
// DIAGNOSTIC: Har call ki poori detail log karta hai
import { Hono } from 'hono'
import { getChatResponse } from '../ai/chat.js'
import { searchRelevantTransactions } from '../vector/search.js'
import { getSupabaseClient } from '../db/supabase.js'
import AI_CONFIG from '../../ai-config.js'
import { composeDynamicPrompt, SYSTEM_PROMPTS } from '../../prompts/index.js'



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

const classifyIntent = (question) => {
  const q = question.toLowerCase();
  const isCasual = /^(hi|hello|hey|thanks|thank you|ok|okay|bye|shukriya|namaste|theek hai)$/i.test(q.trim());
  const isPureAdvice = /^(saving tips|budget tips|investment tips|paisa bachane ke tips)$/i.test(q.trim());
  if (isCasual) return 'CASUAL';
  if (isPureAdvice) return 'VECTOR';
  return 'SQL';
};

// ── Main Chat Route ───────────────────────────────────────────────────────────
chatRoute.post('/', async (c) => {
  const totalStart = Date.now();

  try {
    console.log("👉 [ai-engine] Received /api/chat request!");
    const body = await c.req.json();
    console.log("👉 [ai-engine] JSON parsed successfully. Question:", body.question);
    const { question, systemPrompt, history = [], userId, transactions: frontendTxns } = body;

    if (!question) return c.json({ error: "Question missing" }, 400);

    // Diagnostic object
    const diag = createDiagnostic(question);

    let baseSystemPrompt = systemPrompt || SYSTEM_PROMPTS.core;
    let enrichedPrompt = baseSystemPrompt;
    let contextText = '';
    let usedDB = false;

    if (userId) {
      const supabase = getSupabaseClient(c.env);

      const route = classifyIntent(question);
      diag.route = route;

      enrichedPrompt = baseSystemPrompt;

      // ── Check: Frontend ne data bheja? (Cache) ────────────────────────────
      if (frontendTxns && Array.isArray(frontendTxns) && frontendTxns.length > 0) {
        diag.cache.hit = true;
        diag.cache.dataSource = 'frontend_cache';
        console.log(`\n💾 [Cache HIT] Frontend ne ${frontendTxns.length} transactions bheje — DB call skip!`);
      }

      let sqlData = [];

      // ── SQL / Exact Data Logic (For SQL & HYBRID Routes) ──────────────────
      if (diag.route === 'SQL' || diag.route === 'VECTOR') {
        // ALWAYS hit DB for SQL to guarantee 100% accurate totals & correct 'accounts(name)' joins.
        // Frontend cache might be paginated or missing joined columns.
        console.log("👉 [ai-engine] Initiating Supabase Query...");
        const dbStart = Date.now();
        const { data, error: sqlError } = await supabase
          .from('transactions')
          .select('id, amount, category, description, type, created_at, account_id, accounts(name)')
          .eq('user_id', userId)
          .eq('is_hidden', false)
          .order('created_at', { ascending: false });
        console.log("👉 [ai-engine] Supabase Query Finished. Rows:", data?.length, "Error:", sqlError?.message);
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

        if (sqlData.length > 0) {
          usedDB = true;
          let allTimeIncome = 0;
          let allTimeExpense = 0;
          sqlData.forEach(row => {
            if (row.type === 'expense') allTimeExpense += Number(row.amount);
            if (row.type === 'income') allTimeIncome += Number(row.amount);
          });
          const totalCount = sqlData.length;
          
          const now = new Date();
          const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          
          // Category-wise totals calculation for zero hallucination
          const allTimeCategoryTotals = {};
          const currentMonthCategoryTotals = {};
          
          sqlData.forEach(row => {
            if (row.type !== 'expense') return; // Only track expenses for category breakdown
            const cat = row.category || 'Other';
            allTimeCategoryTotals[cat] = (allTimeCategoryTotals[cat] || 0) + Number(row.amount);
            
            const isCurrentMonth = row.created_at && row.created_at.startsWith(currentMonthStr);
            if (isCurrentMonth) {
               currentMonthCategoryTotals[cat] = (currentMonthCategoryTotals[cat] || 0) + Number(row.amount);
            }
          });
          
          const allTimeCatBreakdown = Object.entries(allTimeCategoryTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([cat, amt]) => `${cat}: ₹${amt.toFixed(2)}`).join(', ') || 'None';

          const currentMonthCatBreakdown = Object.entries(currentMonthCategoryTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([cat, amt]) => `${cat}: ₹${amt.toFixed(2)}`).join(', ') || 'None';

          const sortedData = [...sqlData].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          
          const top5Expenses = [...sqlData]
            .filter(t => t.type === 'expense')
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5)
            .map(t => `- ₹${t.amount} | ${t.description || 'N/A'} (${t.category || 'N/A'})`)
            .join('\n') || 'None';


          const spendingByAccount = {};
          sqlData.forEach(row => {
            if (row.type === 'expense') {
              const acc = (row.accounts && row.accounts.name) ? row.accounts.name : (row.account_name || row.account_id || 'Unknown Account');
              spendingByAccount[acc] = (spendingByAccount[acc] || 0) + Number(row.amount);
            }
          });

          const accountSpendingBreakdown = Object.entries(spendingByAccount)
            .map(([acc, amt]) => `${acc}: ₹${amt.toFixed(2)}`).join(', ') || 'None';



            // Account wise top 10 items ka context
            const accountDetails = {};
            sqlData.forEach(row => {
    if (row.type === 'expense') {
        const acc = (row.accounts && row.accounts.name) ? row.accounts.name : (row.account_name || row.account_id || 'Unknown Account');
        if (!accountDetails[acc]) accountDetails[acc] = [];
        if (accountDetails[acc].length < 10) { // Har account ke top 10 dikhao
            accountDetails[acc].push(`${row.description || 'N/A'} (₹${row.amount})`);
        }
    }
            });

            const formattedAccountDetails = Object.entries(accountDetails)
            .map(([acc, items]) => `${acc}: ${items.join(', ')}`).join('\n'); 


          const formatDate = (ts) => {
            if (!ts) return 'N/A';
            const s = String(ts);
            return s.includes('T') ? s.split('T')[0] : s.substring(0, 10);
          };

          const recentFive = sortedData.slice(0, 5)
            .map(r => `📅 ${formatDate(r.created_at)} • ${r.description || 'N/A'} • ${r.type === 'income' ? '+' : '-'}₹${r.amount} • ${r.accounts?.name || r.category || 'N/A'}`)
            .join('\n') || 'None';

          const latestTxn = sortedData[0];
          const latestTxnLine = latestTxn
            ? `📅 ${formatDate(latestTxn.created_at)} • ${latestTxn.description || 'N/A'} • ${latestTxn.type === 'income' ? '+' : '-'}₹${latestTxn.amount} • ${latestTxn.accounts?.name || latestTxn.category || 'N/A'}`
            : 'None';
          const compactHistory = sortedData.slice(0, 5)
            .map((r, i) => `${i+1}. ${formatDate(r.created_at)} | ${r.type==='income'?'+':'-'}₹${r.amount} | ${r.description || 'N/A'} | ${r.accounts?.name || r.category || 'N/A'}`)
            .join('\n') || 'None';

          contextText += `\n[EXACT SQL RESULT]
[RECENT 5 TRANSACTIONS - USE FOR "last transaction" or "recent" questions]
${recentFive}

Total Transaction Count: ${totalCount}
All-Time Total Expense (last ${totalCount} transactions): ₹${allTimeExpense.toFixed(2)}
All-Time Total Income: ₹${allTimeIncome.toFixed(2)}
Current Month Expenses by Category: ${currentMonthCatBreakdown}
All-Time Expenses by Category: ${allTimeCatBreakdown}

[CRITICAL INSTRUCTION: DO NOT CALCULATE TOTALS]
- NEVER do math yourself. Llama-3 is bad at math.
- Use the exact totals provided below.
- DO NOT confuse 'Live Account Balances' (how much money is left) with 'Total Spent' (how much was spent).

[TOTAL SPENT (EXPENSE) PER ACCOUNT]
${accountSpendingBreakdown}

--- TOP 5 HIGHEST EXPENSES (All Time) ---
${top5Expenses}

[LATEST TRANSACTION — USE THIS FOR "last transaction" QUESTIONS]
${latestTxnLine}
=== COMPLETE HISTORY (Last 50 transactions, newest first) ===
${compactHistory}
`;

          diag.dataScanned.rowsSentToAI = Math.min(50, totalCount);
          diag.dataScanned.bytesScanned = JSON.stringify(sqlData).length;
        }
      }

      // ── Vector / Semantic Logic (For VECTOR & HYBRID Routes) ──────────────
      if (diag.route === 'VECTOR') {
        try {
          const { relevantIDs, searchStats } = await searchRelevantTransactions(userId, question, c.env);
          diag.vector = searchStats;
          if (relevantIDs && relevantIDs.length > 0) {
            // Retrieve full rows for relevant vector matches
            let sourceList = sqlData.length > 0 ? sqlData : (frontendTxns || []);
            const idSet = new Set(relevantIDs.map(String));
            let matchedRows = sourceList.filter(t => idSet.has(String(t.id)));

            // Fetch from DB if missing from cache/sqlData
            if (matchedRows.length === 0 && (!frontendTxns || frontendTxns.length === 0)) {
              const dbStart = Date.now();
              const { data: vData } = await supabase
                .from('transactions')
                .select('id, amount, category, description, type, created_at')
                .in('id', relevantIDs);
              const dbTime = Date.now() - dbStart;
              diag.timing.dbTotal_ms += dbTime;
              diag.dbCalls.push({
                table: 'transactions',
                operation: 'SELECT (Vector Details)',
                rowsFound: vData?.length || 0,
                time_ms: dbTime,
                filter: `id in (${relevantIDs.join(',')})`
              });
              matchedRows = vData || [];
            }

            if (matchedRows.length > 0) {
              usedDB = true;
              const semanticDesc = matchedRows.map(t => `- ${t.description || 'N/A'}: ₹${t.amount} (${t.category || 'N/A'}, Date: ${new Date(t.created_at).toLocaleDateString()})`).join('\n');
              // FIX YAHAN THA: Closing backtick was missing after \n
              contextText += `\n[SEMANTIC VECTOR SEARCH MATCHES (Similar past spending)]:\n${semanticDesc}\n`;
            }
          }
        } catch (vecErr) {
          console.error("Vector Search Error:", vecErr.message);
        }
      }

      if (contextText) {
        enrichedPrompt += `\n\nUser's Additional Database Context:\n${contextText}`;
      }
    }
    
    // Clear chat history for SQL/Hybrid routes to prevent Llama-3 from summarizing past questions
    let finalHistory = history;
    if (diag.route === 'SQL' || diag.route === 'HYBRID') {
        finalHistory = [];
    }

    // GLOBAL ENFORCEMENT RULES FOR ALL ROUTES
    enrichedPrompt += `\n\n[CRITICAL FINAL RULES - FOLLOW EXACTLY]
1. Transaction add karna ho aur account missing ho toh SIRF itna pucho: "Kaunse account se?" — kuch aur mat likho.
2. Valid Add/Delete action ke liye SIRF JSON output karo — koi text nahi.
3. Transaction list dikhani ho toh SIRF is format mein dikho, koi extra text nahi:
   📅 YYYY-MM-DD • Description • +/-₹Amount • Account
4. Agar user ne number bataya (last 5, last 3) toh exactly utni hi dikho.
5. Number nahi bataya toh last 5 dikho by default.
6. KABHI BHI khaali response mat do — hamesha kuch na kuch likho.
7. Balance pucha hai toh LIVE ACCOUNT BALANCES section se exact number lo.
8. NEVER say "Kuch samajh nahi aaya" for financial questions — always try to answer.
9. NEVER repeat the same word multiple times. If you catch yourself repeating, stop and summarize instead.`;

    // ── AI Call ───────────────────────────────────────────────────────────────
    console.log("👉 [ai-engine] Calling getChatResponse...");
    const aiStart = Date.now();
    const answer = await getChatResponse(enrichedPrompt, question, finalHistory, c.env);
    console.log("👉 [ai-engine] getChatResponse Finished!");
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


