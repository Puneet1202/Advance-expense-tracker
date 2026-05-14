import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { chatRoute } from './src/api/chat.js'
import { importRoute } from './src/api/import.js'
import adminRoute from './src/api/admin.js'
import { startWatcher } from './src/cdc/watcher.js'

const app = new Hono()

let watcherStarted = false; // ✅ Sirf ek baar start ho

// 1. Logging Middleware
app.use('*', async (c, next) => {
  const start = Date.now();

  // ✅ Pehli request pe watcher start karo — env yahan milta hai
  if (!watcherStarted) {
    watcherStarted = true;
    startWatcher(c.env); // ✅ env pass ho raha hai
  }

  console.log(`\n[${new Date().toLocaleTimeString()}] 📥 ${c.req.method} ${c.req.url}`);
  await next();
  console.log(`[${new Date().toLocaleTimeString()}] ✅ ${c.res.status} (${Date.now() - start}ms)`);
});

// 2. CORS
app.use('*', cors())

// 3. Health Check
app.get('/', (c) => {
  return c.json({
    status: 'AI Engine LIVE ✅ (Supabase Edition)',
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
app.route('/api/chat', chatRoute)
app.route('/api/admin', adminRoute)
app.route('/api/import', importRoute)

export default app