import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { chatRoute } from './api/chat.js'
import { importRoute } from './api/import.js'
import adminRoute from './api/admin.js'

const app = new Hono()

// 1. Logging Middleware
app.use('*', async (c, next) => {
  const start = Date.now();
  console.log(`\n[${new Date().toLocaleTimeString()}] 📥 ${c.req.method} ${c.req.url}`);
  await next();
  console.log(`[${new Date().toLocaleTimeString()}] ✅ ${c.res.status} (${Date.now() - start}ms)`);
});

// 2. CORS
app.use('*', cors())

// 3. Health Check
app.get('/', (c) => {
  return c.json({
    status: 'AI Engine LIVE ✅',
    routes: {
      chat: 'POST /api/chat/',
      syncAll: 'GET /api/admin/sync-all',
      status: 'GET /api/admin/status',
      import: '/api/import'
    }
  })
})

// 4. Routes
console.log("🛠️  Routes: /api/chat | /api/admin | /api/import");
app.route('/api/chat', chatRoute)      // POST /api/chat/
app.route('/api/admin', adminRoute)    // GET  /api/admin/sync-all
app.route('/api/import', importRoute)  // /api/import/*

export default app