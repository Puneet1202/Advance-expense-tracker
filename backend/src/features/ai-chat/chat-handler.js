/**
 * chat-handler.js (backend)
 * Pre-calculates all financial numbers in JavaScript.
 * Generates an English-only strict system prompt.
 */
const AI_ENGINE_URL = 'http://localhost:4000'

function guessCategory(desc = '') {
  const d = desc.toLowerCase();
  if (/salary|stipend|payroll/.test(d)) return 'Salary';
  if (/swiggy|zomato|food|restaurant|cafe|eat|biryani|pizza|burger/.test(d)) return 'Food';
  if (/amazon|flipkart|myntra|meesho|shopping|mall|mart/.test(d)) return 'Shopping';
  if (/petrol|diesel|fuel|bpcl|hp|iocl|shell/.test(d)) return 'Fuel';
  if (/uber|ola|metro|bus|cab|auto|rapido|train/.test(d)) return 'Transport';
  if (/electricity|water|gas|dth|broadband|internet|bill|recharge|jio|airtel/.test(d)) return 'Bills';
  if (/netflix|spotify|prime|hotstar|subscription/.test(d)) return 'Entertainment';
  if (/transfer|neft|imps|rtgs/.test(d)) return 'Transfer';
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
1. Just report these exact numbers, NEVER calculate. Do NOT make up any numbers.
2. Answer STRICTLY in Hinglish (Roman Hindi). You MUST use ONLY English alphabets (A-Z).
3. Do NOT use Devanagari or Punjabi scripts.
4. Keep the answer extremely short (1-2 lines maximum).
5. If the user asks to add a transaction, reply ONLY with this exact JSON format and no other text:
{"action":"ADD_TRANSACTION","data":{"description":"item","amount":500,"type":"expense","account_name":"${accounts[0]?.name || 'Bank'}","category":"Food"}}
6. Valid account names for JSON: ${accountNames}

Example of a good response:
User: mera balance kya hai?
AI: Aapka net balance ₹${net} hai.`;
}

export async function handleChat(message, transactions, accounts, history, userId) {
  const systemPrompt = buildSystemPrompt(transactions, accounts);

  // Format history: drop long hallucinated assistant messages from before the fix
  const normalizedHistory = (history || [])
    .filter(h => h.role === 'user' || (h.role === 'assistant' && h.content && h.content.length < 150))
    .slice(-4).map(h => ({
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

  // Check if AI responded with the action JSON
  const jsonMatch = rawText.match(/\{[\s\S]*?"action"\s*:\s*"ADD_TRANSACTION"[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      action = JSON.parse(jsonMatch[0]);
      reply = null;
    } catch (e) { /* ignore */ }
  }

  return { reply, action };
}
