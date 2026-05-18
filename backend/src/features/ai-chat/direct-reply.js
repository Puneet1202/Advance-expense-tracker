/**
 * Deterministic answers from DB — no LLM for facts (demo-safe).
 */

const KNOWN_ACCOUNT_TOKENS = ['cash', 'hdfc', 'sbi', 'axis', 'icici', 'salary'];

function matchAccountName(token, accounts) {
  const t = String(token || '').toLowerCase().trim();
  if (!t || !accounts?.length) return null;
  const hit = accounts.find(
    (a) =>
      a.name &&
      (a.name.toLowerCase() === t ||
        a.name.toLowerCase().includes(t) ||
        t.includes(a.name.toLowerCase()))
  );
  return hit ? hit.name : null;
}

/**
 * "swiggy 500 cash", "petrol 300 sbi", "salary mili 60000 hdfc" → ADD without LLM.
 */
export function tryParseInlineAdd(message, accounts) {
  const raw = String(message || '').trim();
  if (!raw || !/\d{2,}/.test(raw)) return null;

  const incomeHint = /(salary|stipend|mili|mila|received|credit|aayi|aya|freelance)/i.test(raw);
  let type = incomeHint ? 'income' : 'expense';

  // item + amount + account at end (most common)
  const endAcc = raw.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s+(\S+)\s*$/i);
  if (endAcc) {
    let desc = endAcc[1].trim();
    const amount = parseFloat(endAcc[2]);
    const acc = matchAccountName(endAcc[3], accounts);
    if (acc && desc.length >= 2 && Number.isFinite(amount) && amount > 0) {
      if (/wiggy/i.test(desc)) desc = 'Swiggy';
      return {
        action: 'ADD_TRANSACTION',
        data: { description: desc, amount, type, account_name: acc, category: 'General' },
      };
    }
  }

  // salary 60000 hdfc / salary mili 60000 hdfc
  const salaryM = raw.match(/(?:salary|stipend|freelance)(?:\s+\w+){0,4}?\s+(\d+(?:\.\d+)?)\s+(\S+)\s*$/i);
  if (salaryM) {
    const amount = parseFloat(salaryM[1]);
    const acc = matchAccountName(salaryM[2], accounts);
    if (acc && Number.isFinite(amount) && amount > 0) {
      return {
        action: 'ADD_TRANSACTION',
        data: {
          description: 'Salary',
          amount,
          type: 'income',
          account_name: acc,
          category: 'Salary',
        },
      };
    }
  }

  return null;
}

function isClosing(t) {
  return Boolean(t.description?.includes('(Account Closing)'));
}

function formatDate(ts) {
  const s = String(ts || '');
  return s.includes('T') ? s.split('T')[0] : s.slice(0, 10);
}

function formatTxnRow(t, i) {
  const sign = t.type === 'income' ? '+' : '-';
  const cat = t.category || 'General';
  const acct = t.account_name || 'N/A';
  return `${i}. 📅 ${formatDate(t.created_at)} • ${t.description || 'N/A'} • ${sign}₹${Number(t.amount).toFixed(2)} • Category: ${cat} • Account: ${acct}`;
}

export function parseLastN(message) {
  const q = String(message || '').toLowerCase();
  if (!/(last|recent|latest|haali|akhir|pichhle|pehle)\s*(\d+)?\s*(transaction|txn|kharch|entry|entries)?/i.test(q)) {
    if (!/transaction\s*dikha|dikhao.*transaction|list.*transaction/i.test(q)) return null;
  }
  const m = q.match(/last\s*(\d+)|(\d+)\s*(?:recent|latest|transaction)|recent\s*(\d+)/i);
  const n = m ? parseInt(m[1] || m[2] || m[3], 10) : 3;
  return Math.min(50, Math.max(1, n));
}

const CATEGORY_ALIASES = [
  { keys: ['food', 'khana', 'swiggy', 'zomato', 'dinner', 'lunch'], name: 'Food' },
  { keys: ['fuel', 'petrol', 'diesel'], name: 'Fuel' },
  { keys: ['travel', 'hotel', 'flight', 'room'], name: 'Travel' },
  { keys: ['entertainment', 'netflix', 'movie', 'spotify'], name: 'Entertainment' },
  { keys: ['fitness', 'gym'], name: 'Fitness' },
  { keys: ['shopping', 'amazon', 'flipkart'], name: 'Shopping' },
  { keys: ['transport', 'uber', 'ola', 'rapido'], name: 'Transport' },
  { keys: ['bills', 'recharge', 'electricity'], name: 'Bills' },
];

function monthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function categoryTotal(transactions, categoryName, thisMonthOnly) {
  const ms = monthStr();
  let sum = 0;
  for (const t of transactions) {
    if (t.type !== 'expense' || isClosing(t)) continue;
    if (thisMonthOnly && t.created_at && !String(t.created_at).startsWith(ms)) continue;
    const cat = String(t.category || 'General').trim();
    if (cat.toLowerCase() === categoryName.toLowerCase()) sum += Number(t.amount);
  }
  return sum;
}

function detectCategoryQuery(message) {
  const q = String(message || '').toLowerCase();
  if (!/(kitna|kharcha|gaya|diya|spend|total)/i.test(q)) return null;
  for (const { keys, name } of CATEGORY_ALIASES) {
    if (keys.some((k) => q.includes(k))) return { name, thisMonth: /(is\s*mahine|this\s*month|mahine)/i.test(q) };
  }
  return null;
}

/**
 * @returns {{ reply: string, action: null } | null}
 */
export function tryDirectDataReply(message, transactions, accounts) {
  const qOnly = String(message || '').trim().toLowerCase();
  if (KNOWN_ACCOUNT_TOKENS.includes(qOnly)) {
    return null;
  }

  const rows = (transactions || []).filter((t) => !isClosing(t));
  const sorted = [...rows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const lastN = parseLastN(message);
  if (lastN != null) {
    const slice = sorted.slice(0, lastN);
    if (!slice.length) {
      return { reply: 'Abhi koi transaction nahi hai.', action: null };
    }
    const lines = slice.map((t, i) => formatTxnRow(t, i + 1));
    return {
      reply: `Ye rahi aapki last ${lastN} transaction${lastN > 1 ? 's' : ''}:\n${lines.join('\n')}`,
      action: null,
    };
  }

  const q = String(message || '').toLowerCase();

  if (/(sabse\s*bada|biggest|highest)\s*kharcha/i.test(q)) {
    const expenses = sorted.filter((t) => t.type === 'expense');
    if (!expenses.length) return { reply: 'Koi expense record nahi mila.', action: null };
    const top = expenses.reduce((a, b) => (Number(b.amount) > Number(a.amount) ? b : a));
    return {
      reply: `Sabse bada kharcha: ${top.description || 'N/A'} — ₹${Number(top.amount).toFixed(2)} (${top.category || 'General'}, ${top.account_name || 'N/A'}, ${formatDate(top.created_at)}).`,
      action: null,
    };
  }

  if (/(is\s*hafte|this\s*week|haft(e|ey)\s*mein).*(kharid|kharch|kiya)/i.test(q)) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const start = weekAgo.toISOString().slice(0, 10);
    const week = sorted.filter(
      (t) => t.type === 'expense' && t.created_at && String(t.created_at).slice(0, 10) >= start
    );
    if (!week.length) return { reply: 'Is hafte koi expense nahi mila.', action: null };
    const lines = week.slice(0, 25).map((t, i) => formatTxnRow(t, i + 1));
    const total = week.reduce((s, t) => s + Number(t.amount), 0);
    return {
      reply: `Is hafte (last 7 days) total kharcha ₹${total.toFixed(2)}:\n${lines.join('\n')}`,
      action: null,
    };
  }

  if (/(kitna\s*paisa\s*bacha|balance\s*kitna|total\s*balance|paisa\s*bacha)/i.test(q) && !/account/i.test(q)) {
    const total = (accounts || []).reduce((s, a) => s + Number(a.balance), 0);
    return { reply: `Total balance ₹${total.toFixed(2)} hai.`, action: null };
  }

  const catQ = detectCategoryQuery(message);
  if (catQ) {
    const amt = categoryTotal(rows, catQ.name, catQ.thisMonth);
    const when = catQ.thisMonth ? 'is mahine' : 'ab tak';
    return {
      reply: `${catQ.name} pe ${when} ₹${amt.toFixed(2)} kharcha hua hai.`,
      action: null,
    };
  }

  if (/\b(hdfc|sbi|cash|axis|icici)\b.*(kitna|balance|hai)\b/i.test(q) || /\bmein\s*kitna\b/i.test(q)) {
    const accMatch = q.match(/\b(hdfc|sbi|cash|axis|icici|salary)\b/i);
    if (accMatch) {
      const name = accMatch[1];
      const acc = (accounts || []).find((a) => a.name.toLowerCase().includes(name));
      if (acc) {
        return { reply: `${acc.name} mein ₹${Number(acc.balance).toFixed(2)} hai.`, action: null };
      }
    }
  }

  return null;
}
