/**
 * chat-handler.js (backend)
 * Gemini API ko call karta hai user ke financial data ke saath.
 * System prompt mein real transactions/balances inject karta hai.
 * JSON action detect karta hai (ADD_TRANSACTION).
 */

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Description se category guess karna (CategoryChart.jsx jaisi logic)
function guessCategory(t) {
  const desc = (t.description || '').toLowerCase();
  if (/salary|stipend|payroll/.test(desc)) return 'Salary';
  if (/swiggy|zomato|food|restaurant|cafe|eat/.test(desc)) return 'Food';
  if (/amazon|flipkart|shopping|mall|mart/.test(desc)) return 'Shopping';
  if (/petrol|diesel|fuel|bpcl|hp|iocl/.test(desc)) return 'Fuel';
  if (/uber|ola|metro|bus|cab|auto|rapido/.test(desc)) return 'Transport';
  if (/electricity|water|gas|dth|broadband|internet|bill|recharge/.test(desc)) return 'Bills';
  if (/transfer|neft|imps|rtgs/.test(desc)) return 'Transfer';
  return 'Other';
}

function buildSystemPrompt(transactions, balances) {
  // Category breakdown banao
  const catMap = {};
  transactions.filter(t => t.type === 'expense').forEach(t => {
    const cat = guessCategory(t);
    catMap[cat] = (catMap[cat] || 0) + t.amount;
  });
  const catSummary = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([c, a]) => `${c}: ₹${Math.round(a)}`).join(', ') || 'N/A';

  const balanceSummary = balances.map(a => `${a.name}: ₹${a.balance}`).join(', ') || 'N/A';
  const accountNames = balances.map(a => a.name).join(', ') || 'N/A';

  // Last 30 transactions
  const txnLines = transactions.slice(0, 30)
    .map(t => `${(t.created_at || '').substring(0, 10)} | ${t.type} | ₹${t.amount} | ${t.description || 'N/A'}`)
    .join('\n') || 'Koi transaction nahi';

  return `Tu Suraj ka personal finance assistant hai. Hindi/Hinglish mein baat kar. Friendly reh, short jawab de (2-4 lines max).

User ka current financial data:
ACCOUNT BALANCES: ${balanceSummary}
EXPENSE BY CATEGORY: ${catSummary}
RECENT TRANSACTIONS (last 30):
${txnLines}

RULES:
1. Specific numbers use kar upar diye data se
2. Hindi/Hinglish mein baat kar
3. Short aur helpful jawab de — 2-4 lines
4. Agar user transaction add karna chahta ho to SIRF yeh JSON return kar (koi extra text nahi saath mein):
{"action":"ADD_TRANSACTION","data":{"description":"item name","amount":500,"type":"expense","account_name":"${accountNames.split(',')[0]?.trim() || 'SBI'}","category":"Food"}}
5. JSON mein type: "expense" ya "income"
6. account_name EXACTLY in mein se hona chahiye: ${accountNames}
7. Currency conversion puchhe to approximate INR rate se calculate kar`;
}

/**
 * Main chat function
 * @param {string} message - User ka message
 * @param {Array} transactions - User ke saare transactions
 * @param {Array} balances - Account balances [{name, balance}]
 * @param {Array} history - Chat history [{role:'user'|'assistant', content:'...'}]
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<{reply: string|null, action: object|null}>}
 */
export async function handleChat(message, transactions, balances, history, apiKey) {
  const systemPrompt = buildSystemPrompt(transactions, balances);

  // Gemini multi-turn conversation format
  const contents = [
    {
      role: 'user',
      parts: [{ text: systemPrompt }]
    },
    {
      role: 'model',
      parts: [{ text: 'Samajh gaya! Main Suraj ka personal finance assistant hoon. Kya help chahiye?' }]
    },
    // Chat history
    ...history.slice(-8).map(h => ({  // Last 8 messages only (token limit)
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.content }]
    })),
    // Current message
    { role: 'user', parts: [{ text: message }] }
  ];

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 512 }
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err.substring(0, 100)}`);
  }

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    || 'Kuch samajh nahi aaya, dobara puchho.';

  // JSON action detect karo
  let action = null;
  let reply = rawText;

  const jsonMatch = rawText.match(/\{[\s\S]*?"action"\s*:\s*"ADD_TRANSACTION"[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      action = JSON.parse(jsonMatch[0]);
      reply = null; // Pure action — no text reply
    } catch (e) {
      // JSON parse fail — treat as normal text
    }
  }

  return { reply, action };
}
