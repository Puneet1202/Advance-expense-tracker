import { Hono } from 'hono'
import { askOllama } from '../ollama/client.js'
import { syncTransactionsToChroma, searchRelevantTransactions } from '../rag/indexer.js'

export const chatRoute = new Hono()

/**
 * POST /api/chat
 * Specialized expense tracker chat endpoint with ChromaDB RAG.
 */
chatRoute.post('/', async (c) => {
  try {
    const body = await c.req.json()
    const { question, systemPrompt, history = [], userId, transactions = [] } = body

    if (!question?.trim() || !systemPrompt?.trim()) {
      return c.json({ error: 'Question and System Prompt are required' }, 400)
    }

    let finalSystemPrompt = systemPrompt;

    // ChromaDB RAG Implementation
    if (userId && transactions.length > 0) {
      // 1. Index current D1 transactions in ChromaDB
      await syncTransactionsToChroma(userId, transactions)
      
      // 2. Search local memory for relevant transactions based on user's question
      const relevantTxns = await searchRelevantTransactions(userId, question, transactions, 10)
      
      // 3. Append relevant RAG data to system prompt
      if (relevantTxns && relevantTxns.length > 0) {
        finalSystemPrompt += `\n\n=== RELEVANT SEARCHED TRANSACTIONS ===\n${relevantTxns.join('\n')}`
      }
    }

    // Call Ollama directly with the enriched strict system prompt
    const answer = await askOllama(finalSystemPrompt, question, history)

    return c.json({ answer })

  } catch (error) {
    console.error('[Chat API Error]:', error)
    return c.json({ error: 'Failed to process chat request' }, 500)
  }
})