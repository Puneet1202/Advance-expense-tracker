// FILE: backend/src/features/ai-chat/chat-handler.js

import { classifyChatIntent } from './intent.js';
import { tryDirectDataReply, tryParseInlineAdd } from './direct-reply.js';

const AI_ENGINE_URL = 'http://localhost:8788';
const AI_FETCH_TIMEOUT_MS = 30_000;
const MAX_ACTION_JSON_BYTES = 8192;

const INJECTION_PATTERNS = [
    /ignore\s+(all\s+|previous\s+|above\s+)?instructions?/i,
    /forget\s+(everything|all|your|previous)/i,
    /you\s+are\s+now\s+/i,
    /new\s+instructions?\s*:/i,
    /\[\s*system\s*\]/i,
    /\bsystem\s+prompt\b/i,
    /ignore\s+(the|your)\s+(rules?|guidelines?)/i,
    /jailbreak/i,
    /act\s+as\s+if\s+you/i,
    /pretend\s+you\s+(are|have\s+no)/i,
    /disregard\s+(all|any|previous)/i,
];

function sanitizeInput(text) {
    if (!text || typeof text !== 'string') return '';
    for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(text)) {
            console.warn('[SECURITY] Prompt injection attempt blocked:', text.substring(0, 100));
            return '[SECURITY: Harmful input detected and blocked]';
        }
    }
    return text.slice(0, 2000);
}

/**
 * Single source of truth for category before DB save.
 * Travel is checked BEFORE Food so "hotel" is never classified as Food.
 * Plain "UPI" in a description does NOT imply Transfer.
 */
export function detectCategory(description = '') {
  const d = String(description || '').toLowerCase().trim();
  if (!d) return 'General';

  if (/salary|stipend|payroll|freelance/.test(d)) return 'Salary';

  // Travel — before Food; hotel/room booking / OTAs / transit tickets
  if (
    /oyo|makemytrip|mmt|goibibo|cleartrip|booking\.com|agoda|trivago|expedia|airbnb|irctc|redbus|abhibus/.test(d) ||
    /\b(hotel|resort|lodge|hostel|flight|airline)\b/.test(d) ||
    /room\s*book|hotel\s*book|room\s*booking|hotel\s*booking|train\s*booking|train\s*ticket|flight\s*book/.test(d)
  ) {
    return 'Travel';
  }

  if (/swiggy|zomato|pizza|coffee|chai|restaurant|food|cafe|eat|meal|biryani|burger|blinkit|grocery|ice.?cream|dinner|lunch|breakfast|vegetable|dominos|kfc|mcd|starbucks/.test(d)) {
    return 'Food';
  }
  if (/amazon|flipkart|myntra|meesho|shopping|mall|mart|store|shop/.test(d)) return 'Shopping';
  if (/petrol|diesel|fuel|hp|bpcl|iocl|shell|pump/.test(d)) return 'Fuel';
  if (/uber|ola|metro|bus|train|cab|auto|rapido|rickshaw|bike taxi|transport/.test(d)) return 'Transport';
  if (/electricity|water|gas|dth|broadband|internet|bill|recharge|jio|airtel/.test(d)) return 'Bills';
  if (/netflix|spotify|prime|hotstar|subscription|disney|movie|cinema/.test(d)) return 'Entertainment';
  if (/gym|fitness|yoga|workout/.test(d)) return 'Fitness';
  // Transfer: explicit bank transfer rails — NOT generic "upi" alone
  if (/\b(neft|imps|rtgs)\b/i.test(d) || /\b(fund|bank)\s+transfer\b/i.test(d)) return 'Transfer';
  if (/rent|house|flat|pg|accommodation/.test(d)) return 'Housing';
  if (/medicine|doctor|hospital|pharmacy|health/.test(d)) return 'Health';
  return 'General';
}

function sanitizeActionString(val, maxLen) {
  if (val == null) return '';
  const s = String(val).trim();
  if (!s) return '';
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

const ALLOWED_ACTIONS = new Set([
  'ADD_TRANSACTION',
  'DELETE_TRANSACTION',
  'TOGGLE_SAVING_MODE',
  'CHANGE_CURRENCY',
  'CHANGE_THEME',
  'UNDO_LAST_ACTION',
]);

/**
 * Server-side gate: malformed or dangerous actions never reach the client/DB path.
 * ADD_TRANSACTION: category is always detectCategory(description) — AI category ignored.
 */
function validateAndSanitizeAssistantAction(parsed, accounts) {
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, fallbackReply: 'Ye action samajh nahi aaya. Dobara likho.', action: null };
  }

  const act = parsed.action;
  if (typeof act !== 'string' || !ALLOWED_ACTIONS.has(act)) {
    return { ok: false, fallbackReply: 'Ye action allowed nahi hai.', action: null };
  }

  const data = parsed.data && typeof parsed.data === 'object' ? parsed.data : {};

  if (act === 'ADD_TRANSACTION') {
    const description = sanitizeActionString(data.description, 200);
    const account_name = sanitizeActionString(data.account_name, 80);
    const amount = Number(data.amount);

    if (!description) {
      return { ok: false, fallbackReply: 'Transaction ke liye description zaroori hai.', action: null };
    }
    if (!account_name) {
      return { ok: false, fallbackReply: 'Kaunse account se?', action: null };
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) {
      return { ok: false, fallbackReply: 'Amount galat hai — positive number bhejo.', action: null };
    }

    const type =
      data.type === 'income' || data.type === 'credit' || data.type === 'Income'
        ? 'income'
        : 'expense';

    if (type === 'expense' && amount > 25000 && !/salary|stipend|rent|fee|fees|loan|emi/i.test(description)) {
      return {
        ok: false,
        fallbackReply: `₹${amount} bahut zyada lag raha hai — amount dobara likho (jaise dinner 500 cash).`,
        action: null,
      };
    }

    if (accounts && Array.isArray(accounts) && accounts.length > 0) {
      const an = account_name.toLowerCase();
      const okAcc = accounts.some(
        (a) =>
          a.name &&
          (a.name.toLowerCase() === an ||
            a.name.toLowerCase().includes(an) ||
            an.includes(a.name.toLowerCase()))
      );
      if (!okAcc) {
        return { ok: false, fallbackReply: 'Kaunse account se?', action: null };
      }
    }

    const category = detectCategory(description);

    return {
      ok: true,
      action: {
        action: 'ADD_TRANSACTION',
        data: {
          description,
          amount: Math.round(amount * 100) / 100,
          type,
          account_name,
          category,
        },
      },
    };
  }

  if (act === 'DELETE_TRANSACTION') {
    const id = Number(data.id);
    const description = sanitizeActionString(data.description, 200);
    if (!Number.isFinite(id) || id <= 0 || id > Number.MAX_SAFE_INTEGER) {
      return { ok: false, fallbackReply: 'Delete ke liye sahi transaction id chahiye.', action: null };
    }
    return {
      ok: true,
      action: {
        action: 'DELETE_TRANSACTION',
        data: { id: Math.floor(id), description: description || 'transaction' },
      },
    };
  }

  if (act === 'TOGGLE_SAVING_MODE') {
    return {
      ok: true,
      action: {
        action: 'TOGGLE_SAVING_MODE',
        data: {
          status: !!data.status,
          limit: Math.min(Math.max(0, Number(data.limit) || 0), 1e12),
        },
      },
    };
  }

  if (act === 'CHANGE_CURRENCY') {
    const currency = sanitizeActionString(data.currency, 8).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      return { ok: false, fallbackReply: 'Currency code galat hai (jaise INR, USD).', action: null };
    }
    return { ok: true, action: { action: 'CHANGE_CURRENCY', data: { currency } } };
  }

  if (act === 'CHANGE_THEME') {
    const theme = sanitizeActionString(data.theme, 16).toLowerCase();
    if (theme !== 'dark' && theme !== 'light') {
      return { ok: false, fallbackReply: 'Theme sirf dark ya light ho sakta hai.', action: null };
    }
    return { ok: true, action: { action: 'CHANGE_THEME', data: { theme } } };
  }

  if (act === 'UNDO_LAST_ACTION') {
    return { ok: true, action: { action: 'UNDO_LAST_ACTION', data: {} } };
  }

  return { ok: false, fallbackReply: 'Action process nahi ho saka.', action: null };
}

function filterChatHistory(history, limit = 8) {
  return (history || [])
    .filter((h) => {
      if (!h.content) return false;
      if (h.role === 'assistant' && h.content.includes('"action"')) return false;
      if (h.content.length > 500) return false;
      return true;
    })
    .slice(-limit)
    .map((h) => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.content || '',
    }));
}

function tryInlineAddFromMessage(message, accounts) {
  const parsed = tryParseInlineAdd(message, accounts);
  if (!parsed) return null;
  const validated = validateAndSanitizeAssistantAction(parsed, accounts);
  if (!validated.ok) {
    return { reply: validated.fallbackReply, action: null };
  }
  return { reply: null, action: validated.action };
}

/** Strip optional markdown fences if the model ignores the no-fences rule. */
function stripCodeFences(text) {
  const t = String(text || '').trim();
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : t;
}

/** Balanced `}` for a `{` at `start`, respecting JSON string escapes. */
function findBalancedObjectEnd(text, start) {
  if (text[start] !== '{') return -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Extract the first parseable assistant action object from model text.
 * Uses brace-balanced slices instead of a greedy regex (avoids swallowing extra `}` / prose).
 */
function extractAssistantActionJson(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  const normalized = stripCodeFences(rawText).trim();
  if (!normalized) return null;

  const candidates = [];

  if (normalized.startsWith('{') && normalized.endsWith('}')) {
    candidates.push(normalized);
  }

  const scanLimit = Math.min(normalized.length, MAX_ACTION_JSON_BYTES * 4);
  for (let i = 0; i < scanLimit; i++) {
    if (normalized[i] !== '{') continue;
    const end = findBalancedObjectEnd(normalized, i);
    if (end < 0) continue;
    const slice = normalized.slice(i, end + 1);
    if (slice.length > MAX_ACTION_JSON_BYTES) {
      i = end;
      continue;
    }
    if (!/"action"\s*:/.test(slice)) continue;
    candidates.push(slice);
    i = end;
  }

  const seen = new Set();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    try {
      const parsed = JSON.parse(candidate);
      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof parsed.action === 'string' &&
        ALLOWED_ACTIONS.has(parsed.action)
      ) {
        return parsed;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

function isAccountClosing(t) {
  return Boolean(t.description && t.description.includes('(Account Closing)'));
}

function buildCategoryBreakdown(transactions, monthStr) {
  const currentMonth = {};
  const allTime = {};
  for (const t of transactions) {
    if (t.type !== 'expense' || isAccountClosing(t)) continue;
    const cat = (t.category && String(t.category).trim()) || 'General';
    const amt = Number(t.amount);
    allTime[cat] = (allTime[cat] || 0) + amt;
    if (t.created_at && String(t.created_at).startsWith(monthStr)) {
      currentMonth[cat] = (currentMonth[cat] || 0) + amt;
    }
  }
  const fmt = (map) => {
    const lines = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return lines.length
      ? lines.map(([c, a]) => `- ${c}: ₹${a.toFixed(2)}`).join('\n')
      : 'None';
  };
  return { currentMonth: fmt(currentMonth), allTime: fmt(allTime) };
}

function buildTopExpenses(transactions) {
  const expenses = transactions
    .filter((t) => t.type === 'expense' && !isAccountClosing(t))
    .map((t) => ({ ...t, amount: Number(t.amount) }))
    .sort((a, b) => b.amount - a.amount);

  if (!expenses.length) {
    return { biggestLine: 'None', top5: 'None' };
  }

  const biggest = expenses[0];
  const date = biggest.created_at ? String(biggest.created_at).slice(0, 10) : 'N/A';
  const biggestLine = `${biggest.description || 'N/A'} | ₹${biggest.amount.toFixed(2)} | ${biggest.category || 'General'} | ${biggest.account_name || 'N/A'} | ${date}`;

  const top5 = expenses
    .slice(0, 5)
    .map(
      (t, i) => {
        const d = t.created_at ? String(t.created_at).slice(0, 10) : 'N/A';
        return `${i + 1}. ${t.description || 'N/A'} | ₹${t.amount.toFixed(2)} | ${t.category || 'General'} | ${t.account_name || 'N/A'} | ${d}`;
      }
    )
    .join('\n');

  return { biggestLine, top5 };
}

function buildWeekSummary(transactions) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStart = weekAgo.toISOString().slice(0, 10);

  const weekExpenses = transactions
    .filter((t) => {
      if (t.type !== 'expense' || isAccountClosing(t) || !t.created_at) return false;
      return String(t.created_at).slice(0, 10) >= weekStart;
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const total = weekExpenses.reduce((s, t) => s + Number(t.amount), 0);
  const lines =
    weekExpenses.length > 0
      ? weekExpenses
          .map((t) => {
            const d = String(t.created_at).slice(0, 10);
            return `- ${d} | ${t.description || 'N/A'} | ₹${Number(t.amount).toFixed(2)} | ${t.category || 'General'} | ${t.account_name || 'N/A'}`;
          })
          .join('\n')
      : 'None';

  return { total, lines, weekStart };
}

function buildSystemPrompt(transactions, accounts, usdRate, mathHint, accountHint) {
  let currentMonthIncome = 0;
  let currentMonthExpense = 0;

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  transactions.forEach(t => {
    if (isAccountClosing(t)) return;
    const isCurrentMonth = t.created_at && t.created_at.startsWith(currentMonthStr);
    if (t.type === 'expense' && isCurrentMonth) {
      currentMonthExpense += t.amount;
    } else if (t.type === 'income' && isCurrentMonth) {
      currentMonthIncome += t.amount;
    }
  });

  const currentMonthNet = currentMonthIncome - currentMonthExpense;
  const categoryBreakdown = buildCategoryBreakdown(transactions, currentMonthStr);
  const topExpenses = buildTopExpenses(transactions);
  const weekSummary = buildWeekSummary(transactions);

  const accountLines = accounts.length
    ? accounts.map(a => `- ${a.name}: ₹${a.balance}`).join('\n')
    : '- No accounts configured';

  const totalAccountBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

  return `=== LIVE ACCOUNT BALANCES ===
Total: ₹${totalAccountBalance.toFixed(2)}
${accountLines}

=== THIS MONTH (${currentMonthStr}) ===
Income: ₹${currentMonthIncome.toFixed(2)}
Expense: ₹${currentMonthExpense.toFixed(2)}
Net: ₹${currentMonthNet.toFixed(2)}

=== CATEGORY SPEND (EXACT — copy numbers as-is) ===
This month:
${categoryBreakdown.currentMonth}
All-time:
${categoryBreakdown.allTime}

=== TOP EXPENSES — ALL TIME (sabse bada kharcha / highest) ===
Biggest single expense (EXACT):
${topExpenses.biggestLine}
Top 5:
${topExpenses.top5}

=== LAST 7 DAYS (is hafte / this week — EXACT list) ===
Total: ₹${weekSummary.total.toFixed(2)} (since ${weekSummary.weekStart})
${weekSummary.lines}

USD Rate: $1 = ₹${usdRate}
${accountHint ? accountHint : ""}
${mathHint ? mathHint : ""}

=== ROLE ===
Banking assistant. Hinglish, short, warm. No markdown. Never invent numbers.

=== DATA RULES (server already computed totals above) ===
- Balance → LIVE ACCOUNT BALANCES.
- Category month/total → CATEGORY SPEND lines.
- "sabse bada kharcha" / highest expense → TOP EXPENSES "Biggest single expense" line ONLY (full DB scan, not recent list).
- "is hafte" / this week → LAST 7 DAYS section ONLY.
- Netflix/Swiggy/hotel specific → SEARCH MATCHES in Database Context; include account name from that block.
- Never say "mujhe pata nahi" if data exists in sections above.

=== ACTIONS (only when user is logging now, not asking history) ===
ADD (item + amount + account in one message) → ONLY this JSON, nothing else:
{"action":"ADD_TRANSACTION","data":{"description":"Coffee","amount":200,"type":"expense","account_name":"hdfc","category":"Food"}}
Account missing → ONLY: Kaunse account se?
DELETE (user wants remove + id known) → ONLY:
{"action":"DELETE_TRANSACTION","data":{"id":123,"description":"name"}}
`;
}

export async function handleChat(message, transactions, accounts, history, userId, usdRate = 83) {
  const safeMessage = sanitizeInput(message);
  if (safeMessage.includes('[SECURITY:')) {
    return { reply: '⚠️ Ye message process nahi ho sakta. Kripya normal sawal poochho.', action: null };
  }

  const historyForMerge = filterChatHistory(history, 8);
  const accountOnly = /^(cash|hdfc|sbi|axis|icici|salary)\s*$/i.test(safeMessage.trim());

  if (accountOnly && historyForMerge.length > 0) {
    const lastAsst = [...historyForMerge].reverse().find((h) => h.role === 'assistant');
    const lastUserWithAmount = [...historyForMerge]
      .reverse()
      .find((h) => h.role === 'user' && /\d{2,}/.test(h.content));
    if (lastAsst && /kaunse account/i.test(lastAsst.content) && lastUserWithAmount) {
      const merged = `${lastUserWithAmount.content} ${safeMessage}`.trim();
      const pendingAdd = tryInlineAddFromMessage(merged, accounts);
      if (pendingAdd) {
        return { ...pendingAdd, diagnostics: { route: 'inline-add-pending' } };
      }
    }
  }

  const inlineAdd = tryInlineAddFromMessage(safeMessage, accounts);
  if (inlineAdd) {
    return { ...inlineAdd, diagnostics: { route: 'inline-add' } };
  }

  const direct = tryDirectDataReply(safeMessage, transactions, accounts);
  if (direct) {
    return { ...direct, diagnostics: { route: 'direct', cacheHit: false } };
  }

  // ✅ FIX 1: USD conversion hint — sirf USD/$ ke liye
  let mathHint = "";
  const match = safeMessage.match(/(\d+(?:\.\d+)?)\s*(?:usd|\$)/i) || safeMessage.match(/\$\s*(\d+(?:\.\d+)?)/i);
  if (match) {
    const usdAmount = parseFloat(match[1]);
    const inrAmount = Math.round(usdAmount * usdRate);
    mathHint = `MATH FACT: User mentioned $${usdAmount} USD = EXACTLY ₹${inrAmount} INR at live rate. Use ${inrAmount} in JSON.`;
  }

  // Account hint
  let accountHint = "";
  const lowerMessage = safeMessage.toLowerCase();
  for (const acc of accounts) {
    if (lowerMessage.includes(acc.name.toLowerCase())) {
      accountHint = `ACCOUNT FACT: User mentioned "${acc.name}" account. Use this directly, do NOT ask again.`;
      break;
    }
  }

  const normalizedHistory = filterChatHistory(history, 2);

  let messageForAi = safeMessage;
  let intent = classifyChatIntent(safeMessage);
  if (accountOnly && historyForMerge.length > 0) {
    const lastAsst = [...historyForMerge].reverse().find((h) => h.role === 'assistant');
    const lastUserWithAmount = [...historyForMerge]
      .reverse()
      .find((h) => h.role === 'user' && /\d{2,}/.test(h.content));
    if (lastAsst && /kaunse account/i.test(lastAsst.content) && lastUserWithAmount) {
      messageForAi = `${lastUserWithAmount.content} ${safeMessage}`.trim();
      intent = 'action';
    }
  }

  const systemPrompt = buildSystemPrompt(transactions, accounts, usdRate, mathHint, accountHint);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${AI_ENGINE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        question: messageForAi,
        systemPrompt,
        history: normalizedHistory,
        userId: userId,
        intent,
        transactions: transactions,
      }),
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('AI Engine timeout — thodi der baad try karo.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI Engine error ${res.status}: ${err.substring(0, 120)}`);
  }

  const data = await res.json();
  const rawText = data?.answer?.trim() || 'Kuch samajh nahi aaya.';

  let action = null;
  let reply = rawText;

  const parsed = extractAssistantActionJson(rawText);
  if (parsed) {
    const validated = validateAndSanitizeAssistantAction(parsed, accounts);
    if (validated.ok) {
      action = validated.action;
      reply = null;
    } else {
      action = null;
      reply = validated.fallbackReply || rawText;
    }
  }

  return { reply, action, diagnostics: data?.diagnostics };
}