/**
 * index.js (ai-import route)
 * Route: POST /api/tracker/import-statement
 *
 * Kya karta hai:
 * 1. Uploaded file (CSV ya PDF) receive karta hai
 * 2. File ai-engine (localhost:4000) ko bhejta hai — woh locally parse karta hai
 * 3. Parsed transactions validate + D1 mein save karta hai
 * 4. Duplicate check karta hai (date + amount)
 * 5. Balance update karta hai
 *
 * NO Gemini, NO third party API — 100% local.
 */

import { parseWithLocalEngine } from './local-parser.js'

/**
 * Main handler for AI statement import
 */
export const importStatementHandler = async (c) => {
  try {
    const user = c.get('user')
    const db = c.env.expense_tracker_db

    // account_id form data se lena
    const formData = await c.req.formData()
    const file = formData.get('file')
    const account_id = formData.get('account_id')

    if (!file) {
      return c.json({ message: 'Koi file nahi mili. File upload karo.', status: 400 }, 400)
    }

    if (!account_id) {
      return c.json({ message: 'Account select karo jisme transactions import karni hain.', status: 400 }, 400)
    }

    // Account verify karo ki user ka hai
    const accountCheck = await db.prepare('SELECT id FROM ACCOUNTS WHERE id = ? AND user_id = ?')
      .bind(Number(account_id), user.id).first()
    if (!accountCheck) {
      return c.json({ message: 'Selected account exist nahi karta.', status: 400 }, 400)
    }

    const fileName = file.name || ''
    const fileType = fileName.split('.').pop().toLowerCase()

    if (!['csv', 'pdf'].includes(fileType)) {
      return c.json({
        message: `"${fileType}" format support nahi hota. Sirf CSV ya PDF upload karo.`,
        status: 400,
      }, 400)
    }

    // ai-engine se parse karwao (local, no AI)
    let transactions = []
    try {
      transactions = await parseWithLocalEngine(file)
    } catch (parseErr) {
      return c.json({
        message: `File parse nahi hua: ${parseErr.message}`,
        status: 422
      }, 422)
    }

    if (!transactions || transactions.length === 0) {
      return c.json({ message: 'Koi transaction nahi mila is file mein.', status: 400 }, 400)
    }

    // Existing transactions fetch karo duplicate check ke liye
    const existingTxns = await db.prepare(
      'SELECT amount, created_at, description, type FROM TRANSACTIONS WHERE user_id = ? AND account_id = ?'
    ).bind(user.id, Number(account_id)).all()

    const existingSet = new Set(
      existingTxns.results.map(t => `${t.amount}|${(t.created_at || '').substring(0, 10)}|${(t.description || '').toLowerCase().trim()}|${t.type}`)
    )

    let imported = 0
    let skipped = 0
    const errors = []

    for (const txn of transactions) {
      try {
        // Amount validate karo
        const amount = Math.abs(Number(txn.amount))
        if (!amount || amount <= 0) { skipped++; continue }

        // Type normalize — 'debit' → 'expense', 'credit' → 'income'
        const rawType = (txn.type || '').toLowerCase()
        const type = rawType === 'credit' ? 'income' : 'expense'

        // Date — parser already returns YYYY-MM-DD
        let isoDate = txn.date || null
        // Validate format
        if (isoDate && !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
          isoDate = null
        }
        if (!isoDate) isoDate = new Date().toISOString().substring(0, 10)
        
        const description = (txn.description || 'Imported Transaction').substring(0, 200)

        // Duplicate check: same amount + same date + same description + same type
        const dedupKey = `${amount}|${isoDate}|${description.toLowerCase().trim()}|${type}`
        if (existingSet.has(dedupKey)) { skipped++; continue }

        await db.prepare(
          'INSERT INTO TRANSACTIONS (user_id, type, amount, description, account_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(user.id, type, amount, description, Number(account_id), isoDate + ' 00:00:00').run()

        existingSet.add(dedupKey)
        imported++
      } catch (err) {
        errors.push(err.message)
      }
    }

    // ── Balance Calculation ──────────────────────────────────────────
    // Step 1: Agar parser ne balance diya to last transaction ka use karo
    let closingBalance = null
    const lastTxnWithBalance = [...transactions].reverse().find(
      t => t.balance != null && !isNaN(Number(t.balance))
    )
    if (lastTxnWithBalance) {
      closingBalance = Math.round(Number(lastTxnWithBalance.balance))
    }

    // Step 2: Balance nahi mila to D1 se calculate karo
    if (closingBalance === null) {
      const allTxns = await db.prepare(
        'SELECT type, amount FROM TRANSACTIONS WHERE user_id = ? AND account_id = ?'
      ).bind(user.id, Number(account_id)).all()

      let calc = 0
      allTxns.results.forEach(t => {
        if (t.type === 'income') calc += t.amount
        if (t.type === 'expense') calc -= t.amount
      })
      closingBalance = Math.round(calc)
    }

    // Account name fetch karo
    const accountInfo = await db.prepare('SELECT name FROM ACCOUNTS WHERE id = ? AND user_id = ?')
      .bind(Number(account_id), user.id).first()

    return c.json({
      message: `${imported} transactions import ho gaye!`,
      imported,
      skipped,
      total: transactions.length,
      closing_balance: closingBalance,
      account_name: accountInfo?.name || 'Account',
      account_id: Number(account_id),
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      status: 200,
    }, 200)

  } catch (error) {
    console.error('AI Import Error:', error)
    return c.json({
      message: error.message || 'Statement import karne mein error aaya',
      status: 500,
    }, 500)
  }
}

/**
 * adjustBalanceHandler
 * Route: POST /api/tracker/account/:id/adjust-balance
 * User ke "Yes" confirm karne pe account ka balance adjust karta hai.
 */
export const adjustBalanceHandler = async (c) => {
  try {
    const user = c.get('user')
    const db = c.env.expense_tracker_db
    const accountId = Number(c.req.param('id'))
    const { target_balance } = await c.req.json()

    if (target_balance == null || isNaN(Number(target_balance))) {
      return c.json({ message: 'target_balance required', status: 400 }, 400)
    }

    // Account user ka hai verify karo
    const accCheck = await db.prepare('SELECT id FROM ACCOUNTS WHERE id = ? AND user_id = ?')
      .bind(accountId, user.id).first()
    if (!accCheck) return c.json({ message: 'Account nahi mila', status: 404 }, 404)

    // Current balance calculate karo
    const txns = await db.prepare(
      'SELECT type, amount FROM TRANSACTIONS WHERE user_id = ? AND account_id = ?'
    ).bind(user.id, accountId).all()

    let currentBalance = 0
    txns.results.forEach(t => {
      if (t.type === 'income') currentBalance += t.amount
      if (t.type === 'expense') currentBalance -= t.amount
    })

    const diff = Math.round(Number(target_balance)) - Math.round(currentBalance)

    // Agar difference negligible hai to kuch mat karo
    if (Math.abs(diff) < 1) {
      return c.json({ message: 'Balance already sahi hai', adjusted: false, status: 200 }, 200)
    }

    const type = diff > 0 ? 'income' : 'expense'
    const amount = Math.abs(diff)

    await db.prepare(
      'INSERT INTO TRANSACTIONS (user_id, type, amount, description, account_id) VALUES (?, ?, ?, ?, ?)'
    ).bind(user.id, type, amount, 'Balance Adjustment (Statement Import)', accountId).run()

    return c.json({
      message: `Balance ₹${Math.round(Number(target_balance)).toLocaleString('en-IN')} kar diya gaya`,
      adjusted: true,
      adjustment_amount: diff,
      status: 200,
    }, 200)

  } catch (error) {
    console.error('Adjust Balance Error:', error)
    return c.json({ message: error.message || 'Balance adjust nahi ho saka', status: 500 }, 500)
  }
}
