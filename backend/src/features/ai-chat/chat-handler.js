/**
 * chat-handler.js (backend)
 * Pre-calculates all financial numbers in JavaScript.
 * Generates an English-only strict system prompt.
 */
const AI_ENGINE_URL = 'http://localhost:4000'

function guessCategory(desc = '') {
  const d = desc.toLowerCase();
  if (/salary|stipend|payroll/.test(d)) return 'Salary';
  if (/swiggy|zomato|restaurant|food|cafe|hotel|eat|meal|biryani|pizza|burger|blinkit|grocery/.test(d)) return 'Food';
  if (/amazon|flipkart|myntra|meesho|shopping|mall|mart|store|shop/.test(d)) return 'Shopping';
  if (/petrol|diesel|fuel|hp|bpcl|iocl|shell|indian oil/.test(d)) return 'Fuel';
  if (/uber|ola|metro|bus|train|cab|auto|rapido|transport/.test(d)) return 'Transport';
  if (/electricity|water|gas|dth|broadband|internet|bill|recharge|jio|airtel/.test(d)) return 'Bills';
  if (/netflix|spotify|prime|hotstar|subscription/.test(d)) return 'Entertainment';
  if (/transfer|neft|imps|rtgs|upi|sent|received/.test(d)) return 'Transfer';
  return 'Other';
}

function buildSystemPrompt(transactions, accounts, usdRate, mathHint, accountHint) {
  // Pre-calculate ALL numbers in JavaScript
  let totalIncome = 0;
  let totalExpense = 0;
  const categoryTotals = {};

  transactions.forEach(t => {
    const cat = guessCategory(t.description);
    if (t.type === 'expense') {
      totalExpense += t.amount;
      categoryTotals[cat] = (categoryTotals[cat] || 0) + t.amount;
    } else if (t.type === 'income') {
      totalIncome += t.amount;
    }
  });

  const net = totalIncome - totalExpense;

  const categoryLines = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => `- ${cat}: ₹${amt}`)
    .join('\n') || '- No expenses yet';

  const accountLines = accounts.length
    ? accounts.map(a => `- ${a.name}: ₹${a.balance}`).join('\n')
    : '- No accounts configured';

  const accountNames = accounts.map(a => a.name).join(', ') || 'N/A';

  return `You are a specialized expense tracker assistant.
Your ONLY source of truth is the exact data provided below and the specific transactions retrieved from the database.

=== MATH & ACCOUNT FACTS ===
${accountHint || "No account auto-detected. Check history or ask."}
${mathHint || "No foreign currency auto-detected."}

=== PRE-CALCULATED FINANCIAL DATA ===
Total Income: ₹${totalIncome}
Total Expense: ₹${totalExpense}
Net Balance: ₹${net}
Live USD Exchange Rate: $1 USD = ₹${usdRate} INR

=== CATEGORY WISE EXPENSES ===
${categoryLines}

=== ACCOUNT BALANCES ===
${accountLines}

=== STRICT RULES ===
1. Just report exact numbers, NEVER calculate. Do NOT make up numbers.
2. Answer STRICTLY in Hinglish (Roman Hindi). Use ONLY English alphabets.
3. Keep the answer extremely short (1-2 lines).

=== APP ACTIONS LOGIC ===
[Action: Add Transaction]
If user asks to add an expense, you MUST do these validations BEFORE generating JSON:
Step 1: Check the MATH & ACCOUNT FACTS. If an account is listed there, USE IT and do NOT ask for it. If not, and NO account is mentioned in chat history either, then ask: "Aapne kis account se pay kiya?". Do NOT output JSON.
Step 2: Check the MATH FACT. If an exact INR amount is provided there, you MUST use that EXACT number.
Step 3: You MUST determine the most logical category from this strict list: [Food, Shopping, Bills, Fuel, Transport, Salary, Transfer, Entertainment, Other]. For example, "movie" or "netflix" is Entertainment.
Step 4: You MUST auto-correct any spelling mistakes in the user's description. If they say "subcription" or "netflx", fix it to "Netflix Subscription".
Step 5: Reply ONLY with this exact JSON format. The "amount" MUST be a pure number in INR (e.g., 4565), NO currency symbols:
{"action":"ADD_TRANSACTION","data":{"description":"Netflix Subscription","amount":4565,"type":"expense","account_name":"actual_account_name","category":"actual_category_from_list"}}

[Action: Delete Transaction]
If the user asks to delete a specific transaction (e.g., "Delete dominos", "Movie wala kharcha hata do"):
Step 1: Search the "RELEVANT SEARCHED TRANSACTIONS" context provided to you for the matching transaction to find its exact ID.
Step 2: Reply ONLY with this exact JSON format and absolutely no other text:
{"action":"DELETE_TRANSACTION","data":{"id":123,"description":"short name of what was deleted"}}

[Action: Toggle Saving Mode]
If the user asks to turn on/off saving mode or set a budget limit (e.g., "Saving mode chalu karo 5000 limit ke sath", "Budget band kar do"):
Step 1: Reply ONLY with this exact JSON format and absolutely no other text:
{"action":"TOGGLE_SAVING_MODE","data":{"status":true,"limit":5000}}

[Action: Undo Last Action]
If the user says they made a mistake and wants to revert/undo the last change (e.g., "Undo kar do", "Galti ho gayi wapas theek karo", "Pehle jaisa kar do"):
Step 1: Reply ONLY with this exact JSON format and absolutely no other text:
{"action":"UNDO_LAST_ACTION","data":{}}

[Action: Change Currency]
If the user asks to check currency rates or change the active currency (e.g., "Dollar ka rate dikhao", "Euro mein change karo"):
Step 1: Pick the valid currency code (USD, EUR, GBP, AED, SAR, JPY, CAD, AUD, SGD, CHF, INR).
Step 2: Reply ONLY with this exact JSON format and absolutely no other text:
{"action":"CHANGE_CURRENCY","data":{"currency":"USD"}}

[Action: Answer Question]
If the user is ONLY asking a question about their data, balances, or history (e.g., "shopping kitne ki", "mera balance kya hai", "kis cheez me kitna kharch hua"):
Step 1: Do NOT output any JSON.
Step 2: Read the PRE-CALCULATED FINANCIAL DATA and CATEGORY WISE EXPENSES above.
Step 3: Reply normally in short Hinglish.

Example of a normal reply:
User: mera balance kya hai?
AI: Aapka net balance ₹${net} hai.`;
}

export async function handleChat(message, transactions, accounts, history, userId, usdRate = 83) {
  // Pre-calculate USD conversions in JS to help LLM
  let mathHint = "";
  const match = message.match(/(\d+(?:\.\d+)?)\s*(?:usd|\$)/i) || message.match(/\$\s*(\d+(?:\.\d+)?)/i);
  if (match) {
    const usdAmount = parseFloat(match[1]);
    const inrAmount = Math.round(usdAmount * usdRate);
    mathHint = `MATH FACT: The user mentioned $${usdAmount} USD. At the live rate of ${usdRate}, this is EXACTLY ₹${inrAmount} INR. You MUST use exactly ${inrAmount} as the amount in your JSON!`;
  }
  
  // Pre-extract account to help LLM
  let accountHint = "";
  const lowerMessage = message.toLowerCase();
  for (const acc of accounts) {
    if (lowerMessage.includes(acc.name.toLowerCase())) {
      accountHint = `ACCOUNT FACT: The user explicitly mentioned the account "${acc.name}". Do NOT ask them for the account again! Use "${acc.name}" in your JSON.`;
      break;
    }
  }

  const systemPrompt = buildSystemPrompt(transactions, accounts, usdRate, mathHint, accountHint);

  // Format history: keep more messages so AI doesn't forget context during long workflows
  const normalizedHistory = (history || [])
    .filter(h => h.role === 'user' || (h.role === 'assistant' && h.content && h.content.length < 150))
    .slice(-10).map(h => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.content || ''
    }));

  // Send everything to AI Engine (including ALL transactions for ChromaDB RAG indexing)
  const res = await fetch(`${AI_ENGINE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: message,
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

  // Check if AI responded with any action JSON (greedy match for full object)
  const jsonMatch = rawText.match(/\{[\s\S]*"action"\s*:\s*"[A-Z_]+"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      action = JSON.parse(jsonMatch[0]);
      reply = null;
    } catch (e) { /* ignore */ }
  }

  return { reply, action };
}
