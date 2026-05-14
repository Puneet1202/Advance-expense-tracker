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
  let totalIncome = 0;
  let totalExpense = 0;
  let currentMonthIncome = 0;
  let currentMonthExpense = 0;
  const categoryTotals = {};

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  transactions.forEach(t => {
    if (t.description && t.description.includes('(Account Closing)')) return;
    const cat = guessCategory(t.description);
    const isCurrentMonth = t.created_at && t.created_at.startsWith(currentMonthStr);
    if (t.type === 'expense') {
      totalExpense += t.amount;
      if (isCurrentMonth) currentMonthExpense += t.amount;
      categoryTotals[cat] = (categoryTotals[cat] || 0) + t.amount;
    } else if (t.type === 'income') {
      totalIncome += t.amount;
      if (isCurrentMonth) currentMonthIncome += t.amount;
    }
  });

  const net = totalIncome - totalExpense;
  const currentMonthNet = currentMonthIncome - currentMonthExpense;

  const categoryLines = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => `- ${cat}: ₹${amt}`)
    .join('\n') || '- No expenses yet';

  const accountLines = accounts.length
    ? accounts.map(a => `- ${a.name}: ₹${a.balance}`).join('\n')
    : '- No accounts configured';

  const totalAccountBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

  const top5Expenses = [...transactions]
    .filter(t => t.type === 'expense' && !t.description?.includes('(Account Closing)'))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map(t => `- [${(t.created_at || '').split('T')[0].split(' ')[0] || 'N/A'}] ₹${t.amount} | ${t.description} | ${t.account_name || 'N/A'}`)
    .join('\n') || '- No expenses';

  const top5Income = [...transactions]
    .filter(t => t.type === 'income' && !t.description?.includes('(Account Closing)'))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map(t => `- [${(t.created_at || '').split('T')[0].split(' ')[0] || 'N/A'}] ₹${t.amount} | ${t.description} | ${t.account_name || 'N/A'}`)
    .join('\n') || '- No income';

  const compactHistory = [...transactions]
    .slice(0, 50)
    .map(t => {
      const d = (t.created_at || '').split('T')[0].split(' ')[0] || 'N/A';
      const sign = t.type === 'income' ? '+' : '-';
      return `${d}|${sign}₹${t.amount}|${t.description || 'N/A'}`;
    })
    .join('\n') || '- No history';

  return `You are a specialized expense tracker assistant.
Your ONLY source of truth is the exact data provided below.

=== PRE-CALCULATED FINANCIAL DATA ===
NOTE: Use "Current Month" values by DEFAULT unless user asks for "all time" or "lifetime".

Account Balance (Available Money): ₹${totalAccountBalance.toFixed(2)}
Income this month (${currentMonthStr}): ₹${currentMonthIncome.toFixed(2)}
Expense this month (${currentMonthStr}): ₹${currentMonthExpense.toFixed(2)}
Net this month: ₹${currentMonthNet.toFixed(2)}

All-Time Income (only if user says "all time"): ₹${totalIncome.toFixed(2)}
All-Time Expense (only if user says "all time"): ₹${totalExpense.toFixed(2)}

Live USD Rate: $1 = ₹${usdRate}

=== MATH & ACCOUNT HINTS ===
${accountHint || ""}
${mathHint || ""}

=== CATEGORY WISE EXPENSES (All-Time) ===
${categoryLines}

=== ACCOUNT BALANCES ===
${accountLines}

=== TOP 5 HIGHEST EXPENSES (Amount ke hisab se bade) ===
${top5Expenses}

=== TOP 5 HIGHEST INCOME (Amount ke hisab se bade) ===
${top5Income}

=== RECENT INCOME (Last 5, newest first) ===
${transactions.filter(t => t.type === 'income').slice(0, 5).map(t =>
  `- [${t.created_at ? t.created_at.split('T')[0].split(' ')[0] : 'N/A'}] +₹${t.amount} | ${t.description} | Account: ${t.account_name || 'N/A'}`
).join('\n') || '- No recent income'}

=== RECENT EXPENSES (Last 5, newest first) ===
${transactions.filter(t => t.type === 'expense').slice(0, 5).map(t =>
  `- [${t.created_at ? t.created_at.split('T')[0].split(' ')[0] : 'N/A'}] -₹${t.amount} | ${t.description} | Account: ${t.account_name || 'N/A'}`
).join('\n') || '- No recent expenses'}

=== COMPLETE HISTORY (Last 50, format: Date|+/-Amount|Description) ===
${compactHistory}

=== STRICT RULES ===
1. NEVER calculate — report exact numbers only.
2. Answer in Hinglish (Roman Hindi), 1-2 lines max.
3. For "income", "expense", "kitna kharch" — ALWAYS use Current Month values.
4. For "balance" or "kitne paise hain" — ALWAYS use Account Balance.
5. For "all time" or "lifetime" — use All-Time values.
6.AMOUNT MANDATORY — Agar user ne is message mein CLEARLY amount nahi bataya to JSON BILKUL MAT BANAO. Pehle poocho: "Kitne ki [item] thi?" History se amount KABHI assume mat karo. Ye rule tod-na allowed nahi hai.
7. Agar user ne message mein EXACT number nahi likha to amount HAMESHA poocho. Koi bhi item ho — assume mat karo.

=== CRITICAL AMOUNT RULES ===
⚠️ AMOUNT EXTRACTION — MOST IMPORTANT RULE:
- User ne jo EXACT number likha hai WOHI use karo — koi multiplication, rounding, ya conversion MAT karo
- "20 ki ice cream" → amount = 20 (EXACTLY 20, not 200, not 2000)
- "500 ka petrol" → amount = 500
- "1500 rent" → amount = 1500
- Agar user ne sirf "20" likha hai to amount SIRF 20 hoga
- KABHI BHI apni taraf se amount badalna ya ghatana mat — JO LIKHA HAI WO LO

=== APP ACTIONS LOGIC ===
[Action: Add Transaction]
If user asks to add an expense or income:
Step 1: Check account. If mentioned in message or ACCOUNT FACT, use it directly. Else ask: "Aapne kis account se pay kiya?" — DO NOT output JSON yet.
Step 2: AMOUNT — extract the EXACT number user wrote. "20 ki ice cream" = 20. "₹500" = 500. NO changes.
Step 3: Category from list: [Food, Shopping, Bills, Fuel, Transport, Salary, Transfer, Entertainment, Other]
Step 4: Auto-correct spelling in description only.
Step 5: Output ONLY this JSON — no other text:
{"action":"ADD_TRANSACTION","data":{"description":"Ice Cream","amount":20,"type":"expense","account_name":"cash","category":"Food"}}

[Action: Delete Transaction]
If user asks to delete a transaction:
Step 1: Find matching transaction ID from history.
Step 2: Output ONLY:
{"action":"DELETE_TRANSACTION","data":{"id":123,"description":"short name"}}

[Action: Toggle Saving Mode]
{"action":"TOGGLE_SAVING_MODE","data":{"status":true,"limit":5000}}

[Action: Undo Last Action]
{"action":"UNDO_LAST_ACTION","data":{}}

[Action: Change Theme]
{"action":"CHANGE_THEME","data":{"theme":"dark"}}

[Action: Change Currency]
{"action":"CHANGE_CURRENCY","data":{"currency":"USD"}}

[Action: Answer Question]
If user is asking a question — DO NOT output JSON. Answer in short Hinglish only.

Example:
User: mera balance kya hai?
AI: Aapka balance ₹${totalAccountBalance.toFixed(2)} hai.`;
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
    .slice(-6) // ✅ Sirf last 6 messages — kam context, kam confusion
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

  return { reply, action };
}