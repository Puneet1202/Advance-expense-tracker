/**
 * pdf-parser.js
 * Indian bank statement PDF ko parse karta hai.
 * Supported banks: SBI, HDFC, ICICI, Axis, Kotak, PNB, BOB, Canara
 *
 * Flow: Buffer → pdf-parse (text extract) → regex → transactions[]
 * NO AI, NO third party API. Pure local.
 */

// import { createRequire } from 'node:module'
// const require = createRequire(import.meta.url)
// const pdfParseLib = require('pdf-parse')

// ─── Date helpers ────────────────────────────────────────────────────────────

/**
 * Various Indian bank date formats ko YYYY-MM-DD mein convert karo
 * Formats: DD/MM/YYYY, DD-MM-YYYY, DD MMM YYYY, DD/MM/YY
 */
function parseIndianDate(raw) {
  if (!raw) return null
  raw = raw.trim()

  // DD/MM/YYYY or DD-MM-YYYY
  let m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m) {
    const [, d, mo, y] = m
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // DD/MM/YY
  m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/)
  if (m) {
    const [, d, mo, y] = m
    const year = parseInt(y) > 50 ? `19${y}` : `20${y}`
    return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // DD MMM YYYY  (15 Jan 2024)
  const MONTHS = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
                   jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' }
  m = raw.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/)
  if (m) {
    const [, d, mon, y] = m
    const mo = MONTHS[mon.toLowerCase()]
    if (mo) return `${y}-${mo}-${d.padStart(2, '0')}`
  }

  // MMM DD, YYYY  (Jan 15, 2024)
  m = raw.match(/^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})$/)
  if (m) {
    const [, mon, d, y] = m
    const mo = MONTHS[mon.toLowerCase()]
    if (mo) return `${y}-${mo}-${d.padStart(2, '0')}`
  }

  return null
}

/**
 * Amount string → number
 * Handles: "1,23,456.78", "1234.56", "(500.00)" [negative], "Dr 500", "500 Dr"
 */
function parseAmount(raw) {
  if (!raw) return null
  let s = raw.toString().replace(/,/g, '').trim()
  // Parentheses = negative (sometimes used for debits)
  const neg = s.startsWith('(') && s.endsWith(')')
  s = s.replace(/[()]/g, '').replace(/[^0-9.]/g, '')
  const n = parseFloat(s)
  if (isNaN(n) || n <= 0) return null
  return neg ? -n : n
}

// ─── Pattern sets for Indian banks ───────────────────────────────────────────

/**
 * Patterns to detect individual transaction lines in PDF text.
 * Each pattern returns { date, description, amount, type, balance }
 *
 * Priority: more specific patterns first.
 */
const TX_PATTERNS = [

  // ── SBI ──
  // Format: DD/MM/YYYY  Description                 Debit    Credit   Balance
  // Line:   01/04/2024  UPI-SWIGGY-123456          500.00            45231.50
  {
    name: 'SBI_TABULAR',
    regex: /^(\d{2}[\/\-]\d{2}[\/\-]\d{4})\s{1,6}(.{5,50}?)\s{2,}(\d[\d,]*\.\d{2})?\s{2,}(\d[\d,]*\.\d{2})?\s{2,}(\d[\d,]*\.\d{2})?/gm,
    extract(m) {
      const date = parseIndianDate(m[1])
      const desc = m[2].replace(/\s+/g, ' ').trim()
      const debit = parseAmount(m[3])
      const credit = parseAmount(m[4])
      const balance = parseAmount(m[5])
      if (!date || (!debit && !credit)) return null
      const amount = debit || credit
      const type = debit ? 'debit' : 'credit'
      return { date, description: desc, amount, type, balance }
    }
  },

  // ── HDFC ──
  // Format: DD/MM/YY  Narration  Chq/Ref  Value Date  Withdrawal  Deposit  Closing Bal
  {
    name: 'HDFC_TABULAR',
    regex: /^(\d{2}\/\d{2}\/\d{2})\s+(.{5,60}?)\s+\S+\s+\d{2}\/\d{2}\/\d{2}\s+(\d[\d,]*\.\d{2})?\s*(\d[\d,]*\.\d{2})?\s*(\d[\d,]*\.\d{2})?/gm,
    extract(m) {
      const date = parseIndianDate(m[1])
      const desc = m[2].replace(/\s+/g, ' ').trim()
      const withdrawal = parseAmount(m[3])
      const deposit = parseAmount(m[4])
      const balance = parseAmount(m[5])
      if (!date || (!withdrawal && !deposit)) return null
      const amount = withdrawal || deposit
      const type = withdrawal ? 'debit' : 'credit'
      return { date, description: desc, amount, type, balance }
    }
  },

  // ── ICICI ──
  // Format: DD/MM/YYYY  Description  Amount  Dr/Cr  Balance
  {
    name: 'ICICI_TABULAR',
    regex: /^(\d{2}\/\d{2}\/\d{4})\s+(.{5,60}?)\s+(\d[\d,]*\.\d{2})\s+(Dr|Cr)\s+(\d[\d,]*\.\d{2})/gm,
    extract(m) {
      const date = parseIndianDate(m[1])
      const desc = m[2].replace(/\s+/g, ' ').trim()
      const amount = parseAmount(m[3])
      const type = m[4] === 'Dr' ? 'debit' : 'credit'
      const balance = parseAmount(m[5])
      if (!date || !amount) return null
      return { date, description: desc, amount, type, balance }
    }
  },

  // ── Axis Bank ──
  // Format: DD-MM-YYYY  Description  Debit  Credit  Balance
  {
    name: 'AXIS_TABULAR',
    regex: /^(\d{2}-\d{2}-\d{4})\s+(.{5,60}?)\s+(\d[\d,]*\.\d{2})?\s+(\d[\d,]*\.\d{2})?\s+(\d[\d,]*\.\d{2})/gm,
    extract(m) {
      const date = parseIndianDate(m[1])
      const desc = m[2].replace(/\s+/g, ' ').trim()
      const debit = parseAmount(m[3])
      const credit = parseAmount(m[4])
      const balance = parseAmount(m[5])
      if (!date || (!debit && !credit)) return null
      const amount = debit || credit
      const type = debit ? 'debit' : 'credit'
      return { date, description: desc, amount, type, balance }
    }
  },

  // ── Generic Indian bank — Date + Amount + Dr/Cr anywhere in line ──
  // Fallback pattern that works for most statements
  {
    name: 'GENERIC_INDIAN',
    regex: /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.{3,80}?)\s+([\d,]+\.\d{2})\s*(?:INR\s*)?(Dr|Cr|DR|CR)?\s*([\d,]+\.\d{2})?/gm,
    extract(m) {
      const date = parseIndianDate(m[1])
      const desc = m[2].replace(/\s+/g, ' ').trim()
      const amount = parseAmount(m[3])
      const drCrTag = (m[4] || '').toUpperCase()
      const balance = parseAmount(m[5])
      if (!date || !amount) return null
      // Guess type from Dr/Cr tag or description keywords
      let type = 'debit'
      if (drCrTag === 'CR') type = 'credit'
      else if (drCrTag === 'DR') type = 'debit'
      else if (/salary|credit|deposit|received|cashback|refund|interest/i.test(desc)) type = 'credit'
      return { date, description: desc, amount, type, balance }
    }
  }
]

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * PDF Buffer → transactions[]
 * @param {Buffer} buffer
 * @returns {Promise<Array<{date, description, amount, type, balance}>>}
 */
export async function parsePdfTransactions(buffer) {
  // Step 1: Extract raw text from PDF
  let text = ''
  try {
    const result = await pdfParseLib(buffer)
    text = result.text
  } catch (err) {
    throw new Error(`PDF text extract nahi hua: ${err.message}`)
  }

  if (!text || text.trim().length < 50) {
    throw new Error('PDF se text nahi mila. Scanned image PDF support nahi hoti — text-based PDF use karo.')
  }

  console.log(`[pdf-parser] Extracted ${text.length} chars from PDF`)

  // Step 2: Try each pattern, collect all matches
  const seen = new Set()
  const transactions = []

  for (const pattern of TX_PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags)
    let match

    while ((match = regex.exec(text)) !== null) {
      try {
        const txn = pattern.extract(match)
        if (!txn) continue
        if (!txn.date || !txn.amount || txn.amount <= 0) continue

        // Dedup key
        const key = `${txn.date}|${txn.amount}|${txn.type}`
        if (seen.has(key)) continue
        seen.add(key)

        transactions.push({
          date: txn.date,
          description: txn.description || 'Bank Transaction',
          amount: Math.round(txn.amount * 100) / 100,
          type: txn.type,
          balance: txn.balance || null
        })
      } catch (e) {
        // Skip bad match
      }
    }

    if (transactions.length > 0) {
      console.log(`[pdf-parser] Pattern "${pattern.name}" ne ${transactions.length} transactions diye`)
      break // First pattern that works, use it
    }
  }

  // Step 3: Sort by date ascending
  transactions.sort((a, b) => a.date.localeCompare(b.date))

  return transactions
}
