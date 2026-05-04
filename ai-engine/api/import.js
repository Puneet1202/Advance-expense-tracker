import { Hono } from 'hono'
import { parsePdfTransactions } from '../parsers/pdf-parser.js'
import { parseCsvTransactions } from '../parsers/csv-parser.js'

export const importRoute = new Hono()

/**
 * POST /api/import
 * PURE PATTERN MATCHING — NO AI NEEDED.
 * 
 * Takes an Indian Bank Statement (PDF or CSV) and extracts:
 * Date | Description | Amount | Type (debit/credit)
 * 
 * Supports: SBI, HDFC, ICICI, Axis Bank formats.
 * Uses `pdf-parse` for PDF text extraction.
 */
importRoute.post('/', async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file')

    if (!file) {
      return c.json({ error: 'File is required in multipart form data' }, 400)
    }

    const fileName = file.name || ''
    const fileType = fileName.split('.').pop().toLowerCase()
    const mimeType = file.type || ''

    let transactions = []

    if (fileType === 'pdf' || mimeType === 'application/pdf') {
      // 100% Regex pattern matching using pdf-parse library
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      transactions = await parsePdfTransactions(buffer)

    } else if (fileType === 'csv' || mimeType === 'text/csv' || mimeType === 'application/vnd.ms-excel') {
      // Pure CSV structure parsing 
      const text = await file.text()
      transactions = parseCsvTransactions(text)

    } else {
      return c.json({ error: 'Unsupported file type. Please upload a PDF or CSV bank statement.' }, 400)
    }

    if (!transactions || transactions.length === 0) {
      return c.json({
        error: 'No transactions found. Ensure it is a valid SBI, HDFC, ICICI, or Axis bank statement.',
        transactions: []
      }, 422)
    }

    console.log(`[Import API]: Successfully parsed ${transactions.length} transactions from ${fileType} using Regex pattern matching.`);

    return c.json({ transactions, total: transactions.length })

  } catch (error) {
    console.error('[Import API Error]:', error)
    return c.json({ error: error.message || 'Failed to parse statement' }, 500)
  }
})