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

function buildSystemPrompt(transactions, accounts) {
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

=== PRE-CALCULATED FINANCIAL DATA ===
Total Income: ₹${totalIncome}
Total Expense: ₹${totalExpense}
Net Balance: ₹${net}

=== CATEGORY WISE EXPENSES ===
${categoryLines}

=== ACCOUNT BALANCES ===
${accountLines}

=== STRICT RULES ===
1. Just report exact numbers, NEVER calculate. Do NOT make up numbers.
2. Answer STRICTLY in Hinglish (Roman Hindi). Use ONLY English alphabets.
3. Keep the answer extremely short (1-2 lines).

=== ADDING TRANSACTIONS LOGIC ===
If the user asks to add an expense, you MUST do these validations BEFORE generating JSON:
Step 1: Check if the user specified an account name from the valid list: ${accountNames}. If NO account is mentioned, you MUST ask: "Aapne kis account se pay kiya? (${accountNames})". Do NOT output JSON.
Step 2: If the account is known, check its balance in the ACCOUNT BALANCES section. If the expense is GREATER than the account balance, you MUST REJECT it and ask: "Aapke [Account] mein sirf ₹[Balance] hain, par expense ₹[Amount] ka hai. Aap kisi aur account se pay karna chahenge?". Do NOT output JSON and do NOT ask for confirmation.
Step 3: You MUST determine the most logical category from this strict list: [Food, Shopping, Bills, Fuel, Transport, Salary, Transfer, Entertainment, Other]. For example, "movie" is Entertainment, "pizza" is Food.
Step 4: ONLY if the account has enough balance, then reply ONLY with this exact JSON format and absolutely no other text:
{"action":"ADD_TRANSACTION","data":{"description":"item name","amount":500,"type":"expense","account_name":"actual_account_name","category":"actual_category_from_list"}}

Example of a normal reply:
User: mera balance kya hai?
AI: Aapka net balance ₹${net} hai.`;
}

export async function handleChat(message, transactions, accounts, history, userId) {
  const systemPrompt = buildSystemPrompt(transactions, accounts);

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

  // Check if AI responded with the action JSON (greedy match for full object)
  const jsonMatch = rawText.match(/\{[\s\S]*"action"\s*:\s*"ADD_TRANSACTION"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      action = JSON.parse(jsonMatch[0]);
      reply = null;
    } catch (e) { /* ignore */ }
  }

  return { reply, action };
}
