



// FILE: ai-engine/src/api/chat.js
// KAAM: Chat routes — user ke questions ka jawab deta hai
// DIAGNOSTIC: Har call ki poori detail log karta hai
import { Hono } from 'hono'
import { getChatResponse } from '../ai/chat.js'
import { searchRelevantTransactions } from '../vector/search.js'
import { getSupabaseClient } from '../db/supabase.js'
import AI_CONFIG from '../../ai-config.js'
import { SYSTEM_PROMPTS } from '../../prompts/index.js'
import { casualChatPrompt } from '../../prompts/responses/casual-chat.js'



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
  const routeLabel = { CASUAL: '💬 Casual', SQL: '📊 Data/SQL', VECTOR: '🧠 Vector', ACTION: '⚡ Action' };
  console.log(`║  🗺️  Route Chosen : ${routeLabel[diag.route] || diag.route}`);
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

function resolveRoute(question, intentFromBackend) {
  const map = { casual: 'CASUAL', data: 'SQL', action: 'ACTION', vector: 'VECTOR' };
  const key = String(intentFromBackend || '').toLowerCase();
  if (map[key]) return map[key];

  const q = String(question || '').toLowerCase().trim();
  if (/^(hi|hello|hey|namaste|thanks?|thank\s*you|shukriya|ok|okay|bye|kaise\s*ho|theek\s*hai)\b/i.test(q)) return 'CASUAL';
  if (/(saving|bachat|tips?|advice|suggest)/i.test(q) && !/(kitna|balance|dikhao|transaction)/i.test(q)) return 'VECTOR';
  if (/\d{2,}/.test(q) && !/(tha|thi|dikhao|kitna|balance|history)/i.test(q) && /(daal|add|pay|spent|\w+\s+\d{2,}\s+\w+)/i.test(q)) return 'ACTION';
  return 'SQL';
}

function extractListCount(question) {
  const q = String(question || '').toLowerCase();
  const m = q.match(/last\s*(\d+)|(\d+)\s*(?:recent|latest|transaction)|recent\s*(\d+)/i);
  if (m) return Math.min(50, Math.max(1, parseInt(m[1] || m[2] || m[3], 10)));
  if (/last|recent|latest|transaction\s*dikha/i.test(q)) return 3;
  return 15;
}

/** Match DB/app convention (General) — not "Other", which splits totals incorrectly. */
function normalizeCategory(raw) {
  const s = raw != null ? String(raw).trim() : '';
  if (!s) return 'General';
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function isAccountClosing(row) {
  return Boolean(row?.description && row.description.includes('(Account Closing)'));
}

/** One category per line so Food vs Entertainment cannot be merged when parsing. */
function formatCategoryBreakdown(totalsMap) {
  const entries = Object.entries(totalsMap).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return 'None';
  return entries.map(([cat, amt]) => `- ${cat}: ₹${amt.toFixed(2)}`).join('\n');
}

function formatTxnLine(r, formatDate) {
  const cat = normalizeCategory(r.category);
  const acct = r.accounts?.name || 'N/A';
  const sign = r.type === 'income' ? '+' : '-';
  return `📅 ${formatDate(r.created_at)} • ${r.description || 'N/A'} • ${sign}₹${r.amount} • Category: ${cat} • Account: ${acct}`;
}

const SEARCH_STOP = new Set([
  'kitna', 'kharcha', 'kiya', 'maine', 'mere', 'the', 'thi', 'tha', 'hua', 'gaya', 'diya',
  'kya', 'pe', 'pr', 'par', 'mein', 'me', 'hai', 'ho', 'na', 'ki', 'ka', 'ke', 'ko', 'se',
  'aur', 'is', 'mahine', 'month', 'wala', 'walaa', 'record', 'mujhe', 'apne', 'aapne',
  'dikhao', 'dikha', 'batao', 'mila', 'nahi', 'khrcha', 'kharch', 'diye', 'diyi',
]);

/** Code search for "hotel tha na", "room booking aaj" — LLM list scan is unreliable. */
function buildQuestionSearchBlock(question, expenseRows, formatDate) {
  const q = String(question || '').toLowerCase();
  if (
    !/(tha|thi|kiya|booking|kharcha|kharch|kitna|order|mila|record|dikhao|batao|gaya|hua|wala|kata|charge|subscription|netflix|swiggy|amazon|sabse|bada|hafte|kharida|search|kro)/i.test(
      q
    )
  ) {
    return '';
  }

  const todayOnly = /\b(aaj|today)\b/i.test(q);
  const todayStr = new Date().toISOString().slice(0, 10);

  const topicRules = [
    { keys: ['hotel', 'room', 'oyo', 'stay', 'resort', 'booking'], cats: ['travel'] },
    { keys: ['travel', 'flight', 'trip', 'irctc'], cats: ['travel'] },
    { keys: ['food', 'swiggy', 'zomato', 'dinner', 'lunch', 'breakfast', 'meal', 'pizza', 'chai'], cats: ['food'] },
    { keys: ['petrol', 'diesel', 'fuel', 'pump'], cats: ['fuel'] },
    { keys: ['gym', 'fitness', 'workout', 'ym'], cats: ['fitness'] },
    { keys: ['netflix', 'movie', 'spotify', 'prime', 'hotstar'], cats: ['entertainment'] },
    { keys: ['salary', 'stipend', 'income'], cats: ['salary', 'income'] },
    { keys: ['amazon', 'flipkart', 'shopping'], cats: ['shopping'] },
  ];

  let activeKeys = [];
  let activeCats = [];
  for (const rule of topicRules) {
    if (rule.keys.some((k) => q.includes(k))) {
      activeKeys = rule.keys;
      activeCats = rule.cats;
      break;
    }
  }
  if (!activeKeys.length) {
    activeKeys = q.split(/\s+/).filter((w) => w.length >= 3 && !SEARCH_STOP.has(w));
  }
  if (!activeKeys.length && !activeCats.length) return '';

  const matches = expenseRows.filter((row) => {
    if (todayOnly && row.created_at && !String(row.created_at).startsWith(todayStr)) return false;
    const desc = (row.description || '').toLowerCase();
    const cat = normalizeCategory(row.category).toLowerCase();
    if (activeCats.some((c) => cat === c || cat.includes(c))) return true;
    return activeKeys.some((k) => desc.includes(k) || cat.includes(k));
  });

  if (!matches.length) {
    return `[SEARCH: "${question}" — koi matching transaction nahi mili]`;
  }

  let expenseSum = 0;
  const lines = matches.slice(0, 15).map((r, i) => {
    if (r.type === 'expense') expenseSum += Number(r.amount);
    return `${i + 1}. ${formatTxnLine(r, formatDate)}`;
  });

  return `[SEARCH MATCHES — is sawal ka jawab SIRF yahan se do; account name yahan se lo]
Rows: ${matches.length} | Expense total: ₹${expenseSum.toFixed(2)}
${lines.join('\n')}`;
}

/** "sabse bada" / week — remind model: use system prompt sections, not recent list only */
function buildQueryHint(question) {
  const q = String(question || '').toLowerCase();
  const listM = q.match(/last\s*(\d+)|(\d+)\s*(?:recent|latest|transaction)/i);
  if (listM || /last.*transaction|transaction.*dikha/i.test(q)) {
    const n = listM ? parseInt(listM[1] || listM[2], 10) : 3;
    return `[HINT: User asked for EXACTLY ${n} transactions — show only ${n} rows from list below, NOT "last 7 days".]`;
  }
  if (/sabse\s*bada|biggest|highest|max\s*kharcha/i.test(q)) {
    return '[HINT: Use TOP EXPENSES → Biggest single expense from system prompt. Do NOT use recent transaction list only.]';
  }
  if (/is\s*hafte|this\s*week|haft(e|ey)\s*mein/i.test(q)) {
    return '[HINT: Use LAST 7 DAYS section from system prompt for this week purchases.]';
  }
  return '';
}

// ── Main Chat Route ───────────────────────────────────────────────────────────
chatRoute.post('/', async (c) => {
  const totalStart = Date.now();

  try {
    console.log("👉 [ai-engine] Received /api/chat request!");
    const body = await c.req.json();
    console.log("👉 [ai-engine] JSON parsed successfully. Question:", body.question);
    const { question, systemPrompt, history = [], userId, intent: intentFromBackend, transactions: frontendTxns } = body;

    if (!question) return c.json({ error: "Question missing" }, 400);

    const diag = createDiagnostic(question);
    const route = resolveRoute(question, intentFromBackend);
    diag.route = route;

    let enrichedPrompt = systemPrompt || SYSTEM_PROMPTS.core;
    let contextText = '';
    let usedDB = false;
    let finalHistory = history;

    // ── CASUAL: no DB, short prompt, keep chat history ─────────────────────
    if (route === 'CASUAL') {
      enrichedPrompt = `${enrichedPrompt}\n\n${casualChatPrompt}`;
      finalHistory = (history || []).slice(-4);
    } else if (userId) {
      const supabase = getSupabaseClient(c.env);

      if (frontendTxns?.length > 0) {
        diag.cache.hit = true;
        diag.cache.dataSource = 'frontend_cache';
      }

      let sqlData = [];

      // ── DATA (SQL): transaction list only — totals live in backend system prompt ──
      if (route === 'SQL') {
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
          const expenseRows = sqlData.filter((row) => !isAccountClosing(row));
          const sortedData = [...expenseRows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          const formatDate = (ts) => {
            const s = String(ts || '');
            return s.includes('T') ? s.split('T')[0] : s.substring(0, 10);
          };
          const listN = extractListCount(question);
          const txnList =
            sortedData
              .slice(0, listN)
              .map((r, i) => `${i + 1}. ${formatTxnLine(r, formatDate)}`)
              .join('\n') || 'None';
          const latestTxnLine = sortedData[0] ? formatTxnLine(sortedData[0], formatDate) : 'None';
          const searchBlock = buildQuestionSearchBlock(question, sortedData, formatDate);
          const queryHint = buildQueryHint(question);

          contextText = `[TRANSACTION LIST — totals/top expense/this week from system prompt sections]
${queryHint ? `${queryHint}\n` : ''}${searchBlock ? `${searchBlock}\n\n` : ''}Latest: ${latestTxnLine}

${txnList}`;
          diag.dataScanned.rowsSentToAI = listN;
          diag.dataScanned.bytesScanned = contextText.length;
        }
        finalHistory = [];
      }

      if (route === 'ACTION') {
        const dbStart = Date.now();
        const { data } = await supabase
          .from('transactions')
          .select('id, description, amount, type, created_at')
          .eq('user_id', userId)
          .eq('is_hidden', false)
          .order('created_at', { ascending: false })
          .limit(12);
        diag.dbCalls.push({
          table: 'transactions',
          operation: 'SELECT (Action Route)',
          rowsFound: data?.length || 0,
          time_ms: Date.now() - dbStart,
          filter: `user_id = ${userId}`,
        });
        if (data?.length) {
          usedDB = true;
          contextText = `[RECENT TRANSACTIONS — for DELETE id only]\n${data
            .map((r) => `id:${r.id} | ${r.description || 'N/A'} | ₹${r.amount} | ${r.type}`)
            .join('\n')}`;
        }
        finalHistory = [];
      }

      if (route === 'VECTOR') {
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

    if (route === 'VECTOR') {
      enrichedPrompt += `\n\n${SYSTEM_PROMPTS.vector}`;
    }

    if (route !== 'CASUAL') {
      enrichedPrompt += `\n\n[FINAL RULES]
- Numbers: system prompt sections only — never calculate.
- Lists: from TRANSACTION LIST only. Category/balance: from CATEGORY SPEND / LIVE BALANCES.
- Add/Delete: JSON only, or "Kaunse account se?" if account missing.`;
    }

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


