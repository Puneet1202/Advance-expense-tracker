/**
 * csv-parser.js
 * Indian bank statement CSV ko parse karta hai.
 * Supported: SBI, HDFC, ICICI, Axis, Kotak, generic Indian bank CSV
 *
 * Pure regex + column detection. NO AI, NO third party API.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
}

function parseIndianDate(raw) {
  if (!raw) return null
  raw = raw.toString().trim().replace(/"/g, '')

  // DD/MM/YYYY or DD-MM-YYYY
  let m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`

  // DD/MM/YY
  m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/)
  if (m) {
    const year = parseInt(m[3]) > 50 ? `19${m[3]}` : `20${m[3]}`
    return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }

  // YYYY-MM-DD (ISO, already correct)
  m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`

  // DD MMM YYYY
  m = raw.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/)
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()]
    if (mo) return `${m[3]}-${mo}-${m[1].padStart(2, '0')}`
  }

  // MMM DD YYYY or MMM-DD-YYYY
  m = raw.match(/^([A-Za-z]{3})[\s\-](\d{1,2})[\s\-,]*(\d{4})$/)
  if (m) {
    const mo = MONTHS[m[1].toLowerCase()]
    if (mo) return `${m[3]}-${mo}-${m[2].padStart(2, '0')}`
  }

  return null
}

function parseAmount(raw) {
  if (raw == null || raw === '') return null
  let s = raw.toString().replace(/,/g, '').replace(/"/g, '').trim()
  s = s.replace(/[^0-9.\-]/g, '')
  const n = parseFloat(s)
  if (isNaN(n)) return null
  return Math.abs(n) > 0 ? Math.abs(n) : null
}

/**
 * CSV text ko lines + cells mein parse karna
 * Handles quoted fields with commas inside
 */
function parseCsvLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if ((ch === ',' || ch === '\t') && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

// ─── Column Header Detection ──────────────────────────────────────────────────

const DATE_COLS    = ['date', 'txn date', 'transaction date', 'value date', 'posting date', 'tran date']
const DESC_COLS    = ['description', 'narration', 'particulars', 'details', 'remarks', 'transaction details', 'trans description']
const DEBIT_COLS   = ['debit', 'withdrawal', 'dr', 'debit amount', 'withdrawal amt', 'amount debit', 'debit(inr)']
const CREDIT_COLS  = ['credit', 'deposit', 'cr', 'credit amount', 'deposit amt', 'amount credit', 'credit(inr)']
const AMOUNT_COLS  = ['amount', 'transaction amount', 'txn amount', 'amt']
const TYPE_COLS    = ['type', 'dr/cr', 'cr/dr', 'txn type', 'transaction type']
const BALANCE_COLS = ['balance', 'closing balance', 'available balance', 'bal', 'running balance']

function findCol(headers, candidates) {
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] || '').toLowerCase().trim().replace(/\s+/g, ' ')
    if (candidates.some(c => h === c || h.includes(c))) return i
  }
  return -1
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * CSV text string → transactions[]
 * @param {string} csvText
 * @returns {Array<{date, description, amount, type, balance}>}
 */
export function parseCsvTransactions(csvText) {
  if (!csvText || csvText.trim().length === 0) {
    throw new Error('CSV file khali hai')
  }

  // Split into lines, skip empty/header-only lines
  const rawLines = csvText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0)

  // Find the header row — first row with recognizable financial column names
  let headerIdx = -1
  let headers = []

  for (let i = 0; i < Math.min(rawLines.length, 20); i++) {
    const cells = parseCsvLine(rawLines[i]).map(c => c.toLowerCase().trim())
    const hasDate = cells.some(c => DATE_COLS.some(d => c.includes(d) || c === 'date'))
    const hasAmount = cells.some(c =>
      DEBIT_COLS.some(d => c.includes(d)) ||
      CREDIT_COLS.some(d => c.includes(d)) ||
      AMOUNT_COLS.some(d => c.includes(d))
    )
    if (hasDate && hasAmount) {
      headerIdx = i
      headers = parseCsvLine(rawLines[i])
      break
    }
  }

  if (headerIdx === -1) {
    throw new Error('CSV mein header row nahi mili. Date aur Amount columns hone chahiye.')
  }

  // Column index detect karo
  const colDate    = findCol(headers, DATE_COLS)
  const colDesc    = findCol(headers, DESC_COLS)
  const colDebit   = findCol(headers, DEBIT_COLS)
  const colCredit  = findCol(headers, CREDIT_COLS)
  const colAmount  = findCol(headers, AMOUNT_COLS)
  const colType    = findCol(headers, TYPE_COLS)
  const colBalance = findCol(headers, BALANCE_COLS)

  if (colDate === -1) throw new Error('Date column nahi mili CSV mein.')
  if (colDebit === -1 && colCredit === -1 && colAmount === -1) {
    throw new Error('Amount column nahi mili CSV mein (Debit/Credit/Amount koi bhi nahi).')
  }

  // Parse data rows
  const transactions = []
  const seen = new Set()

  for (let i = headerIdx + 1; i < rawLines.length; i++) {
    const line = rawLines[i]
    if (!line || line.startsWith('//') || /^[,\t\s]+$/.test(line)) continue

    const cells = parseCsvLine(line)
    if (cells.length < 2) continue

    // Date
    const rawDate = cells[colDate]
    const date = parseIndianDate(rawDate)
    if (!date) continue

    // Description
    const description = (colDesc >= 0 ? cells[colDesc] : cells.join(' '))
      .replace(/"/g, '').replace(/\s+/g, ' ').trim().substring(0, 200)

    // Amount + Type
    let amount = null
    let type = 'debit'

    if (colDebit >= 0 && colCredit >= 0) {
      // Separate debit/credit columns
      const debitVal  = parseAmount(cells[colDebit])
      const creditVal = parseAmount(cells[colCredit])
      if (debitVal && debitVal > 0) { amount = debitVal; type = 'debit' }
      else if (creditVal && creditVal > 0) { amount = creditVal; type = 'credit' }

    } else if (colAmount >= 0) {
      // Single amount column — use type column or description to determine Dr/Cr
      amount = parseAmount(cells[colAmount])
      if (colType >= 0) {
        const t = (cells[colType] || '').toLowerCase()
        type = (t.includes('cr') || t === 'credit' || t === 'c') ? 'credit' : 'debit'
      } else {
        // Guess from description
        if (/salary|credited|deposit|received|cashback|refund|interest|credit/i.test(description)) {
          type = 'credit'
        }
      }
    }

    if (!amount || amount <= 0) continue

    // Balance
    const balance = colBalance >= 0 ? parseAmount(cells[colBalance]) : null

    // Dedup
    const key = `${date}|${amount}|${type}`
    if (seen.has(key)) continue
    seen.add(key)

    transactions.push({
      date,
      description: description || 'Bank Transaction',
      amount: Math.round(amount * 100) / 100,
      type,
      balance: balance || null
    })
  }

  // Sort by date
  transactions.sort((a, b) => a.date.localeCompare(b.date))

  return transactions
}
