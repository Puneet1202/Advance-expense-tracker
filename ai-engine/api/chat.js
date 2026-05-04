import { Hono } from 'hono'
import { askOllama } from '../ollama/client.js'

export const chatRoute = new Hono()

chatRoute.post('/', async (c) => {
  try {
    const { question, systemPrompt, transactions, history } = await c.req.json()

    if (!question) {
      return c.json({ error: 'Question required' }, 400)
    }

    const prompt = systemPrompt
      ? `${systemPrompt}\n\nUser: ${question}\nAssistant:`
      : `Transactions:\n${JSON.stringify(transactions)}\n\nUser: ${question}`

    const answer = await askOllama(prompt)
    return c.json({ answer })

  } catch (error) {
    console.error(error)
    return c.json({ error: 'Something went wrong' }, 500)
  }
})