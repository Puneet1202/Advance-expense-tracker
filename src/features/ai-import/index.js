/**
 * index.js (ai-import route)
 * Yeh file AI Import feature ka main backend route hai.
 * Route: POST /api/tracker/import-statement
 * 
 * Kya karta hai:
 * 1. Uploaded file (CSV ya PDF) receive karta hai
 * 2. File type ke hisaab se text/base64 extract karta hai
 * 3. Gemini Flash API se transactions parse karta hai
 * 4. Duplicate check karta hai (date + amount)
 * 5. D1 mein transactions save karta hai
 */

import { extractCsvText } from './csv-handler.js';
import { extractPdfBase64 } from './pdf-handler.js';
import { parseWithGemini, parseWithGeminiPdf } from './gemini-parser.js';

/**
 * Main handler for AI statement import
 */
export const importStatementHandler = async (c) => {
  try {
    const user = c.get('user');
    const db = c.env.expense_tracker_db;
    const geminiApiKey = c.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      return c.json({ message: 'Gemini API key configure nahi hai', status: 500 }, 500);
    }

    // account_id form data se lena
    const formData = await c.req.formData();
    const file = formData.get('file');
    const account_id = formData.get('account_id');

    if (!file) {
      return c.json({ message: 'Koi file nahi mili. File upload karo.', status: 400 }, 400);
    }

    if (!account_id) {
      return c.json({ message: 'Account select karo jisme transactions import karni hain.', status: 400 }, 400);
    }

    // Account verify karo ki user ka hai
    const accountCheck = await db.prepare('SELECT id FROM ACCOUNTS WHERE id = ? AND user_id = ?')
      .bind(Number(account_id), user.id).first();
    if (!accountCheck) {
      return c.json({ message: 'Selected account exist nahi karta.', status: 400 }, 400);
    }

    const fileName = file.name || '';
    const fileType = fileName.split('.').pop().toLowerCase();

    let transactions = [];

    if (fileType === 'csv' || file.type === 'text/csv') {
      // CSV flow
      const csvText = await extractCsvText(file);
      transactions = await parseWithGemini(csvText, geminiApiKey);
    } else if (fileType === 'pdf' || file.type === 'application/pdf') {
      // PDF flow — Gemini ko directly PDF bhejo
      const { base64, mimeType } = await extractPdfBase64(file);
      transactions = await parseWithGeminiPdf(base64, mimeType, geminiApiKey);
    } else {
      return c.json({
        message: `"${fileType}" format support nahi hota. Sirf CSV ya PDF upload karo.`,
        status: 400,
      }, 400);
    }

    if (!transactions || transactions.length === 0) {
      return c.json({ message: 'Gemini ko koi transaction nahi mila is file mein.', status: 400 }, 400);
    }

    // Existing transactions fetch karo duplicate check ke liye
    const existingTxns = await db.prepare(
      'SELECT amount, description, created_at FROM TRANSACTIONS WHERE user_id = ? AND account_id = ?'
    ).bind(user.id, Number(account_id)).all();

    const existingSet = new Set(
      existingTxns.results.map(t => `${t.amount}|${t.created_at?.substring(0, 10)}`)
    );

    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (const txn of transactions) {
      try {
        // Amount validate karo
        const amount = Math.abs(Number(txn.amount));
        if (!amount || amount <= 0) { skipped++; continue; }

        // Type normalize karo
        const rawType = (txn.type || '').toLowerCase();
        const type = rawType === 'credit' ? 'income' : 'expense';

        // Date parse karo — DD-MM-YYYY format
        let dateStr = txn.date || '';
        let isoDate = null;
        if (dateStr) {
          const parts = dateStr.split('-');
          if (parts.length === 3) {
            // DD-MM-YYYY → YYYY-MM-DD
            isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
        }
        if (!isoDate) isoDate = new Date().toISOString().substring(0, 10);

        // Duplicate check: same amount + same date
        const dedupKey = `${amount}|${isoDate}`;
        if (existingSet.has(dedupKey)) { skipped++; continue; }

        const description = (txn.description || txn.category || 'Imported Transaction').substring(0, 200);

        await db.prepare(
          'INSERT INTO TRANSACTIONS (user_id, type, amount, description, account_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(user.id, type, amount, description, Number(account_id), isoDate + ' 00:00:00').run();

        existingSet.add(dedupKey); // Next iteration ke liye update
        imported++;
      } catch (err) {
        errors.push(err.message);
      }
    }

    return c.json({
      message: `${imported} transactions import ho gaye!`,
      imported,
      skipped,
      total: transactions.length,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      status: 200,
    }, 200);

  } catch (error) {
    console.error('AI Import Error:', error);
    return c.json({
      message: error.message || 'Statement import karne mein error aaya',
      status: 500,
    }, 500);
  }
};
