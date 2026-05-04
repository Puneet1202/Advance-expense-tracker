import { Hono } from 'hono'
import { askOllama } from '../ollama/client.js'

export const importRoute = new Hono()

importRoute.post('/', async (c) => {
  try {
    const { text } = await c.req.json()

    if (!text) {
      return c.json({ error: 'Text required' }, 400)
    }

    const prompt = `Yeh bank statement ka text hai:
${text}

Is text se saari transactions nikalo aur JSON format mein do:
[
  {
    "date": "YYYY-MM-DD",
    "description": "transaction description",
    "amount": 1000,
    "type": "debit ya credit"
  }
]

Sirf JSON do, kuch aur mat likho.`

    const answer = await askOllama(prompt)

    // JSON parse karo
    const cleaned = answer.replace(/```json|```/g, '').trim()
    const transactions = JSON.parse(cleaned)

    return c.json({ transactions })

  } catch (error) {
    console.error(error)
    return c.json({ error: 'Import failed' }, 500)
  }
})