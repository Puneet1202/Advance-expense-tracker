// FILE: backend/src/features/ai-chat/chat-handler.js

const AI_ENGINE_URL = 'http://localhost:8788';

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

function guessCategory(desc = '') {
  const d = desc.toLowerCase();
  if (/salary|stipend|payroll/.test(d)) return 'Salary';
  if (/swiggy|zomato|restaurant|food|cafe|hotel|eat|meal|biryani|pizza|burger|blinkit|grocery|ice.?cream/.test(d)) return 'Food';
  if (/amazon|flipkart|myntra|meesho|shopping|mall|mart|store|shop/.test(d)) return 'Shopping';
  if (/petrol|diesel|fuel|hp|bpcl|iocl|shell|indian oil/.test(d)) return 'Fuel';
  if (/uber|ola|metro|bus|train|cab|auto|rapido|transport/.test(d)) return 'Transport';
  if (/electricity|water|gas|dth|broadband|internet|bill|recharge|jio|airtel/.test(d)) return 'Bills';
  if (/netflix|spotify|prime|hotstar|subscription/.test(d)) return 'Entertainment';
  if (/transfer|neft|imps|rtgs|upi|sent|received/.test(d)) return 'Transfer';
  return 'Other';
}

function buildSystemPrompt(transactions, accounts, usdRate, mathHint, accountHint) {
  let currentMonthIncome = 0;
  let currentMonthExpense = 0;

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  transactions.forEach(t => {
    if (t.description && t.description.includes('(Account Closing)')) return;
    const isCurrentMonth = t.created_at && t.created_at.startsWith(currentMonthStr);
    if (t.type === 'expense' && isCurrentMonth) {
      currentMonthExpense += t.amount;
    } else if (t.type === 'income' && isCurrentMonth) {
      currentMonthIncome += t.amount;
    }
  });

  const currentMonthNet = currentMonthIncome - currentMonthExpense;

  const accountLines = accounts.length
    ? accounts.map(a => `- ${a.name}: ₹${a.balance}`).join('\n')
    : '- No accounts configured';

  const totalAccountBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

  return `You are an intelligent expense tracker assistant.
Here is the exact live account balance data. (More transaction details and vector insights are provided in the additional context below).

=== LIVE ACCOUNT BALANCES (Source of Truth) ===
Total Available Bank Balance: ₹${totalAccountBalance.toFixed(2)}
Individual Accounts:
${accountLines}

=== CURRENT MONTH TOTALS (${currentMonthStr}) ===
Income: ₹${currentMonthIncome.toFixed(2)}
Expense: ₹${currentMonthExpense.toFixed(2)}
Net Savings: ₹${currentMonthNet.toFixed(2)}

Live USD Rate: $1 = ₹${usdRate}
${accountHint ? `\n${accountHint}` : ""}
${mathHint ? `\n${mathHint}` : ""}

=== CRITICAL JSON ACTIONS LOGIC (UI Integration) ===
If the user's intent is to perform an action (Add/Delete/Theme/Mode), output ONLY the corresponding single-line JSON object. Do NOT include markdown blocks, text, or explanations.
If the user is just chatting or asking a QUESTION about past expenses or history (e.g. "how much did I spend on food?", "maine kahan kahan kharch kiya"), DO NOT try to add a transaction. DO NOT ask for amount. DO NOT output JSON. Just read the context and answer naturally in Hinglish.

[Add Transaction]
If adding an expense/income and all details are present (or if the user just typed "food 500 hdfc"):
{"action":"ADD_TRANSACTION","data":{"description":"Item Name","amount":100,"type":"expense","account_name":"hdfc","category":"Food"}}
* RULE: You MUST have exactly 3 things to output JSON: Amount, Item Name, and Account. Use ANY item name mentioned as Description. 
* CRITICAL: If the user DOES NOT mention an account (like hdfc, sbi, or cash), DO NOT OUTPUT JSON. Ask them "Kaunse account se?". NEVER default to cash.
* RULE: Pay attention to words like "received", "mila", "gift", "salary". If money comes IN, set "type" to "income". If money goes OUT (spent, paid), set "type" to "expense".
* RULE: Choose a logical "category" (e.g., Food, Transport, Salary, Gift, General). Do NOT default to Transport!

[Delete Transaction]
{"action":"DELETE_TRANSACTION","data":{"id":123,"description":"short name"}}
* RULE: You MUST provide the exact numeric ID of the transaction from the history to delete it. If the transaction is NOT in the recent history context provided to you, DO NOT output JSON. Instead, tell the user you couldn't find it in the recent records.

[Other Actions]
{"action":"TOGGLE_SAVING_MODE","data":{"status":true,"limit":5000}}
{"action":"UNDO_LAST_ACTION","data":{}}
{"action":"CHANGE_THEME","data":{"theme":"dark"}}
{"action":"CHANGE_CURRENCY","data":{"currency":"USD"}}`;
}

export async function handleChat(message, transactions, accounts, history, userId, usdRate = 83) {
  const safeMessage = sanitizeInput(message);
  if (safeMessage.includes('[SECURITY:')) {
    return { reply: '⚠️ Ye message process nahi ho sakta. Kripya normal sawal poochho.', action: null };
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

  const systemPrompt = buildSystemPrompt(transactions, accounts, usdRate, mathHint, accountHint);

  // ✅ FIX 2: History filter — JSON action responses history mein mat bhejo
  // Ye loop ka main reason tha — AI apne pichle JSON actions dekh ke dobara action karta tha
  const normalizedHistory = (history || [])
    .filter(h => {
      if (!h.content) return false;
      // ✅ Assistant ke JSON action responses filter karo — loop prevent hoga
      if (h.role === 'assistant' && h.content.includes('"action"')) return false;
      // ✅ Bahut lambe messages bhi filter karo — confusion prevent hoga
      if (h.content.length > 500) return false;
      return true;
    })
    .slice(-2) // ✅ Sirf last 2 messages (1 Q & 1 A) — kam context, zero confusion
    .map(h => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.content || ''
    }));

  const res = await fetch(`${AI_ENGINE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: safeMessage,
      systemPrompt,
      history: normalizedHistory,
      userId: userId,
      transactions: transactions
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI Engine error ${res.status}: ${err.substring(0, 120)}`);
  }

  const data = await res.json();
  const rawText = data?.answer?.trim() || 'Kuch samajh nahi aaya.';

  let action = null;
  let reply = rawText;

  const jsonMatch = rawText.match(/\{[\s\S]*"action"\s*:\s*"[A-Z_]+"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      action = JSON.parse(jsonMatch[0]);
      reply = null;
    } catch (e) { /* ignore */ }
  }

  return { reply, action, diagnostics: data?.diagnostics };
}