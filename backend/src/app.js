import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import authRouter from './routers/auth.routes.js';
import trackerRouter from './routers/tracker.routes.js';

const app = new Hono();

app.use(logger());

app.use('/api/*', cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
}));

app.get('/', (c) => c.text('Welcome to Expense Tracker'));

app.notFound((c) => c.json({ message: `Path not found: ${c.req.method} ${c.req.path}` }, 404));

app.onError((err, c) => {
    console.error(err);
    return c.json({ message: 'internal server error', status: 500 }, 500);
});

app.route('/api/auth', authRouter);
app.route('/api/tracker', trackerRouter);

app.get('/api/currency/rates', async (c) => {
    try {
        const API_KEY = c.env.EXCHANGE_RATE_API_KEY;
        const res = await fetch(`https://v6.exchangerate-api.com/v6/${API_KEY}/latest/INR`);
        if (!res.ok) throw new Error('Failed to fetch rates');
        const json = await res.json();
        if (json.result !== 'success') throw new Error(json['error-type'] || 'API error');
        return c.json({ conversion_rates: json.conversion_rates });
    } catch (err) {
        return c.json({ error: err.message }, 500);
    }
});

export default app;