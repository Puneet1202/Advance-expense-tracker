/**
 * chat-handler.js (backend)
 * Gemini API ko call karta hai user ke financial data ke saath.
 *
 * BUG 1 FIX: Ab Gemini ko pre-computed category sums nahi bhejte —
 *   seedha raw transactions bhejte hain taaki AI khud sahi se calculate kare.
 * BUG 2 FIX: System prompt mein clearly define kiya ki "faltu" sirf
 *   Shopping/Entertainment/Subscriptions hain — Food/Bills/Rent kabhi nahi.
 */

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Description se category guess karna
function guessCategory(t) {
  const desc = (t.description || '').toLowerCase();
  if (/salary|stipend|payroll/.test(desc)) return 'Salary';
  if (/swiggy|zomato|food|restaurant|cafe|eat|biryani|pizza|burger/.test(desc)) return 'Food';
  if (/amazon|flipkart|shopping|mall|mart|myntra|meesho/.test(desc)) return 'Shopping';
  if (/petrol|diesel|fuel|bpcl|hp|iocl|shell/.test(desc)) return 'Fuel';
  if (/uber|ola|metro|bus|cab|auto|rapido|train/.test(desc)) return 'Transport';
  if (/electricity|water|gas|dth|broadband|internet|bill|recharge|jio|airtel/.test(desc)) return 'Bills';
  if (/transfer|neft|imps|rtgs|upi sent/.test(desc)) return 'Transfer';
  if (/netflix|spotify|prime|hotstar|subscription/.test(desc)) return 'Entertainment';
  return 'Other';
}

function buildSystemPrompt(transactions, balances) {
  const balanceSummary = balances.map(a => `${a.name}: ₹${a.balance}`).join(', ') || 'N/A';
  const accountNames   = balances.map(a => a.name).join(', ') || 'N/A';

  // BUG 1 FIX: Raw transactions with category pre-tagged — AI khud filter + sum karega
  const txnLines = transactions.slice(0, 50).map(t => {
    const cat = guessCategory(t);
    const date = (t.created_at || '').substring(0, 10);
    const acc  = t.account_name || 'Unknown';
    return `${date} | ${t.type} | ₹${t.amount} | ${cat} | ${t.description || 'N/A'} | ${acc}`;
  }).join('\n') || 'Koi transaction nahi';

  return `Tu Suraj ka personal finance assistant hai. Hindi/Hinglish mein baat kar. Friendly reh, short jawab de (2-4 lines max).

ACCOUNT BALANCES: ${balanceSummary}

TRANSACTIONS (format: date | type | amount | category | description | account):
${txnLines}

CALCULATION RULES — ZARURI PADHO:
- Category ka total nikalne ke liye: upar ki list mein se sirf woh rows lo jahan category match kare, phir unke amounts add karo.
- Koi assumption mat lao. Jo data upar diya hai SIRF wohi use karo.
- Galat number mat do — agar uncertain ho to kaho "mujhe exact data nahi dikh raha."

BUG 2 FIX — "FALTU KHARCHA" DEFINITION:
- Food ek ZARURI kharcha hai. Swiggy, Zomato, restaurant — kabhi faltu mat bolna.
- Bills (electricity, internet, gas) ZARURI hain — kabhi faltu mat bolna.
- Rent/Transport — ZARURI hain.
- SIRF YEH FALTU HAIN: Shopping (clothes/electronics jo zaruri nahi), Entertainment (Netflix etc), Subscriptions (unused).
- Agar poochha jaye "faltu kharche" to sirf Shopping/Entertainment/Subscriptions batao.

GENERAL RULES:
1. Specific numbers use kar upar diye transactions se
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
 * @param {string} message
 * @param {Array}  transactions — [{created_at, type, amount, description, account_name}]
 * @param {Array}  balances     — [{name, balance}]
 * @param {Array}  history      — [{role, content}]
 * @param {string} apiKey
 * @returns {Promise<{reply: string|null, action: object|null}>}
 */
export async function handleChat(message, transactions, balances, history, apiKey) {
  const systemPrompt = buildSystemPrompt(transactions, balances);

  const contents = [
    { role: 'user',  parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Samajh gaya! Main Suraj ka personal finance assistant hoon. Sirf actual data use karunga. Kya help chahiye?' }] },
    ...history.slice(-8).map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.content }]
    })),
    { role: 'user', parts: [{ text: message }] }
  ];

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: { temperature: 0.5, maxOutputTokens: 512 } // Lower temp = more accurate numbers
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err.substring(0, 100)}`);
  }

  const data    = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    || 'Kuch samajh nahi aaya, dobara puchho.';

  let action = null;
  let reply  = rawText;

  const jsonMatch = rawText.match(/\{[\s\S]*?"action"\s*:\s*"ADD_TRANSACTION"[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      action = JSON.parse(jsonMatch[0]);
      reply  = null;
    } catch (e) { /* treat as normal text */ }
  }

  return { reply, action };
}
