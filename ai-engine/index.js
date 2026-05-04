import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { chatRoute } from './api/chat.js'
import { importRoute } from './api/import.js'

const app = new Hono()

// CORS
app.use('*', cors())

// Routes
app.route('/api/chat', chatRoute)
app.route('/api/import', importRoute)

// Health check
app.get('/', (c) => c.json({ status: 'AI Engine Running!' }))

// Start server
serve({
  fetch: app.fetch,
  port: process.env.PORT || 4000
}, () => {
  console.log('AI Engine running on http://localhost:4000')
})