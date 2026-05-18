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

  return `=== LIVE ACCOUNT BALANCES ===
Total: ₹${totalAccountBalance.toFixed(2)}
${accountLines}

=== THIS MONTH (${currentMonthStr}) ===
Income: ₹${currentMonthIncome.toFixed(2)}
Expense: ₹${currentMonthExpense.toFixed(2)}
Net: ₹${currentMonthNet.toFixed(2)}

USD Rate: $1 = ₹${usdRate}
${accountHint ? accountHint : ""}
${mathHint ? mathHint : ""}

=== WHO YOU ARE ===
You are a smart banking assistant for an expense tracker app.
You speak natural Hinglish. You are accurate, helpful, and concise.
You NEVER show internal labels, routing names, or reasoning to the user.

=== SILENT ROUTING (internal only — never mention to user) ===
Apply in this exact order:

STEP 1 — PAST-TENSE BLOCK (always a question, NEVER add):
If message contains ANY of: tha, thi, tha na, kiya tha, kuch tha,
hua tha, order kiya tha, kuch tha na, li thi, ki thi, kiya tha kuch,
kitna gaya, kitna kharcha, dikhao, batao, mila tha, hua tha kya
→ Answer from transaction history in context. Output plain text only. STOP.

STEP 2 — ADD NEW TRANSACTION (only if Step 1 did NOT match):
User is recording a NEW expense/income RIGHT NOW — not asking about past.
Valid signals: "[item] [amount] [account]", "daalo", "add karo",
"kharcha hua", "pay kiya", "le liya", "kharida", "spent", "diya"
Example: "coffee 200 hdfc" → ADD (present, no past tense)
→ Output ONLY the JSON below. No other text.

STEP 3 — DELETE:
User explicitly wants to remove a transaction and ID is known.
→ Output DELETE JSON only. No other text.

STEP 4 — CASUAL:
hi, hello, thanks, ok, bye → short friendly Hinglish reply. No JSON.

=== ADD TRANSACTION JSON (Step 2 only) ===
{"action":"ADD_TRANSACTION","data":{"description":"Item","amount":100,"type":"expense","account_name":"hdfc","category":"Food"}}

Rules:
- Need exactly: amount + description + account
- Account missing → ask ONLY: "Kaunse account se?"
- Default type: expense
- Income signals: mila, aayi, received, salary, credit
- Category: Use your intelligence to pick the most logical 
  category. Food/drink → Food, Fuel/petrol → Fuel, 
  Rides/auto → Transport, Netflix/streaming → Entertainment,
  Gym/yoga → Fitness, Amazon/shopping → Shopping, 
  Room/hotel/stay → Travel, Doctor/medicine → Health,
  Salary/freelance → Salary. 
  Only use General if truly nothing fits.

=== DELETE JSON (Step 3 only) ===
{"action":"DELETE_TRANSACTION","data":{"id":123,"description":"name"}}

=== ANSWER FROM HISTORY (Step 1 and all data questions) ===
- Use ONLY exact numbers from "User's Additional Database Context" below
- NEVER calculate totals yourself — copy pre-computed numbers exactly
- NEVER invent amounts, dates, or transactions
- NEVER give generic advice — always cite real data from context
- Format each transaction: 📅 DATE • Description • ±₹Amount • Account
- "last N transactions" → show exactly N, newest first
- "petrol pe kitna gaya" → use category totals from context (e.g. Fuel: ₹X)
- "swiggy se order kiya tha" / "hotel booking ki thi":
  search COMPLETE HISTORY in context for matching keyword (swiggy, hotel, etc.)
  If found → show that transaction's date, amount, account
  If not found → "Mujhe is transaction ka record nahi mila"
- Balance questions → use LIVE ACCOUNT BALANCES above
- Max 3 lines unless user asks for more detail

=== ABSOLUTE PROHIBITIONS ===
- NEVER output "TYPE A", "TYPE B", "TYPE C", "TYPE D", "Step 1", "Step 2",
  "classification", "intent", or any internal routing label in your reply
- NEVER add a transaction when message has past tense (tha, thi, kiya tha, etc.)
- NEVER show your reasoning or how you classified the message
- NEVER say "mere paas data nahi" if data exists in context
- NEVER repeat the same word or phrase twice
- NEVER respond with empty text

=== RESPONSE STYLE ===
- Natural Hinglish always
- Sound like a helpful friend, not a robot
- Direct answer first, no preamble
`;
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