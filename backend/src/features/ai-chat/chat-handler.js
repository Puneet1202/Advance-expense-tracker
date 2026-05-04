/**
 * chat-handler.js (backend)
 * D1 se aaya exact data Gemini ko bhejta hai.
 * System prompt mein 100% accurate numbers inject hote hain.
 *
 * FIX: Frontend se aane wala incomplete data ab use nahi hota.
 *      index.js ne D1 se data fetch kiya — yahan sirf format + Gemini call.
 */

// const GEMINI_URL =http://localhost:4000

const AI_ENGINE_URL = 'http://localhost:4000'

// Description se category guess karna
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
  // ── Account Balances ──────────────────────────────────────────────────────
  const accountLines = accounts.length
    ? accounts.map(a => `  ${a.name}: ₹${a.balance.toLocaleString('en-IN')}`).join('\n')
    : '  Koi account nahi';

  const accountNames = accounts.map(a => a.name).join(', ') || 'N/A';

  // ── Category-wise totals (compute from raw D1 rows) ───────────────────────
  const catMap = {};
  let totalIncome = 0;
  let totalExpense = 0;

  transactions.forEach(t => {
    const cat = guessCategory(t.description);
    if (t.type === 'expense') {
      catMap[cat] = (catMap[cat] || 0) + t.amount;
      totalExpense += t.amount;
    } else if (t.type === 'income') {
      totalIncome += t.amount;
    }
  });

  const categoryLines = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => `  ${cat}: ₹${Math.round(amt).toLocaleString('en-IN')}`)
    .join('\n') || '  Koi expense nahi';

  // ── Transaction list (last 50, dated rows) ────────────────────────────────
  const txnLines = transactions.slice(0, 50).map(t => {
    const date = (t.created_at || '').substring(0, 10);
    const cat = guessCategory(t.description);
    const sign = t.type === 'income' ? '+' : '-';
    return `  ${date} | ${sign}₹${t.amount} | ${cat} | ${t.description || 'N/A'} | ${t.account_name || 'N/A'}`;
  }).join('\n') || '  Koi transaction nahi is mahine';

  return `Tu Suraj ka personal finance assistant hai. Hindi/Hinglish mein baat kar. Friendly reh.

User ka EXACT financial data D1 database se hai — 100% accurate. Sirf yahi use karo, koi assumption mat lao.

═══ ACCOUNTS (current balance) ═══
${accountLines}

═══ IS MAHINE TRANSACTIONS (${transactions.length} total) ═══
Format: date | amount | category | description | account
${txnLines}

═══ IS MAHINE CATEGORY-WISE EXPENSE ═══
${categoryLines}

  Kul Income:   ₹${Math.round(totalIncome).toLocaleString('en-IN')}
  Kul Expense:  ₹${Math.round(totalExpense).toLocaleString('en-IN')}
  Net:          ₹${Math.round(totalIncome - totalExpense).toLocaleString('en-IN')}

═══ RULES ═══
1. SIRF upar diya data use karo — koi assume mat karo
2. Numbers exactly yahi hain — galat calculation mat karo
3. Category sum ke liye: upar ki list se filter karo, phir add karo
4. Hindi/Hinglish mein jawab do — 2-4 lines max
5. Food, Bills, Rent, Transport ZARURI hain — kabhi "faltu" mat bolna
   Sirf Shopping, Entertainment, Subscriptions faltu hote hain
6. Agar user transaction add karna chahta ho to SIRF yeh JSON do (koi extra text nahi):
{"action":"ADD_TRANSACTION","data":{"description":"item","amount":500,"type":"expense","account_name":"${accounts[0]?.name || 'SBI'}","category":"Food"}}
7. account_name EXACTLY in mein se hona chahiye: ${accountNames}`;
}

/**
 * @param {string} message
 * @param {Array}  transactions — D1 se fetched [{type, amount, description, created_at, account_name}]
 * @param {Array}  accounts     — [{name, balance}]
 * @param {Array}  history      — [{role, content}]
 * @param {string} apiKey
 * @returns {Promise<{reply: string|null, action: object|null}>}
 */
// export async function handleChat(message, transactions, accounts, history, apiKey) {
export async function handleChat(message, transactions, accounts, history) {

  const systemPrompt = buildSystemPrompt(transactions, accounts);

  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Samajh gaya! Main D1 database ka exact data dekh sakta hoon. Kya help chahiye?' }] },
    ...history.slice(-8).map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.content }]
    })),
    { role: 'user', parts: [{ text: message }] }
  ];

  const res = await fetch(`${AI_ENGINE_URL}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: message,
    transactions,
    systemPrompt,
    history
  })
});

if (!res.ok) {
  const err = await res.text();
  throw new Error(`AI Engine error ${res.status}: ${err.substring(0, 120)}`);
}

const data = await res.json();
const rawText = data?.answer?.trim()
  || 'Kuch samajh nahi aaya, dobara puchho.';

  let action = null;
  let reply = rawText;

  const jsonMatch = rawText.match(/\{[\s\S]*?"action"\s*:\s*"ADD_TRANSACTION"[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      action = JSON.parse(jsonMatch[0]);
      reply = null;
    } catch (e) { /* normal text */ }
  }

  return { reply, action };
}
