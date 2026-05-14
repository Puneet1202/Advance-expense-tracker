// FILE: backend/src/features/ai-import/index.js
// KAAM: Bank statement import — CSV/PDF parse karke transactions save karna
//
// CHANGES (D1 → Supabase):
//   - c.env.expense_tracker_db hata diya
//   - getSupabaseClient(c.env) se Supabase client lete hain
//   - db.prepare().bind().all() → supabase.from().select()
//   - db.prepare().bind().run() → supabase.from().insert()
//   - db.prepare().bind().first() → supabase.from().select().maybeSingle()
//   - PostgreSQL mein DATE format: YYYY-MM-DD (same as before)

import { parseWithLocalEngine } from './local-parser.js';
import { getSupabaseClient } from '../../db/supabase.js';

/**
 * Main handler for AI statement import
 * Route: POST /api/tracker/import-statement
 */
export const importStatementHandler = async (c) => {
    try {
        const user = c.get('user');
        // WHY: D1 binding hata diya — Supabase client use karte hain
        const supabase = getSupabaseClient(c.env);

        const formData = await c.req.formData();
        const file = formData.get('file');
        const account_id = formData.get('account_id');

        if (!file) {
            return c.json({ message: 'Koi file nahi mili. File upload karo.', status: 400 }, 400);
        }
        if (!account_id) {
            return c.json({ message: 'Account select karo jisme transactions import karni hain.', status: 400 }, 400);
        }

        // Account user ka hai verify karo
        const { data: accountCheck } = await supabase
            .from('accounts')
            .select('id')
            .eq('id', Number(account_id))
            .eq('user_id', user.id)
            .maybeSingle();

        if (!accountCheck) {
            return c.json({ message: 'Selected account exist nahi karta.', status: 400 }, 400);
        }

        const fileName = file.name || '';
        const fileType = fileName.split('.').pop().toLowerCase();

        if (!['csv', 'pdf'].includes(fileType)) {
            return c.json({
                message: `"${fileType}" format support nahi hota. Sirf CSV ya PDF upload karo.`,
                status: 400,
            }, 400);
        }

        // Local parser se transactions parse karo
        let transactions = [];
        try {
            transactions = await parseWithLocalEngine(file);
        } catch (parseErr) {
            return c.json({ message: `File parse nahi hua: ${parseErr.message}`, status: 422 }, 422);
        }

        if (!transactions || transactions.length === 0) {
            return c.json({ message: 'Koi transaction nahi mila is file mein.', status: 400 }, 400);
        }

        // Existing transactions fetch karo duplicate check ke liye
        const { data: existingTxns, error: existErr } = await supabase
            .from('transactions')
            .select('amount, created_at, description, type')
            .eq('user_id', user.id)
            .eq('account_id', Number(account_id));

        if (existErr) throw existErr;

        // WHY: Dedup key format same rakha — amount|date|desc|type
        const existingSet = new Set(
            (existingTxns || []).map(t => {
                // Supabase timestamps mein T hota hai — sirf date part lo
                const dateStr = (t.created_at || '').split('T')[0].split(' ')[0];
                return `${t.amount}|${dateStr}|${(t.description || '').toLowerCase().trim()}|${t.type}`;
            })
        );

        let imported = 0;
        let skipped = 0;
        const errors = [];

        for (const txn of transactions) {
            try {
                const amount = Math.abs(Number(txn.amount));
                if (!amount || amount <= 0) { skipped++; continue; }

                const rawType = (txn.type || '').toLowerCase();
                const type = rawType === 'credit' ? 'income' : 'expense';

                let isoDate = txn.date || null;
                if (isoDate && !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) isoDate = null;
                if (!isoDate) isoDate = new Date().toISOString().substring(0, 10);

                const description = (txn.description || 'Imported Transaction').substring(0, 200);

                const dedupKey = `${amount}|${isoDate}|${description.toLowerCase().trim()}|${type}`;
                if (existingSet.has(dedupKey)) { skipped++; continue; }

                // WHY: D1 mein created_at string tha '2024-01-01 00:00:00'
                // Supabase mein ISO timestamp dete hain — Postgres TIMESTAMPTZ accept karta hai
                const { error: insErr } = await supabase
                    .from('transactions')
                    .insert({
                        user_id: user.id,
                        type,
                        amount,
                        description,
                        account_id: Number(account_id),
                        created_at: isoDate + 'T00:00:00.000Z'
                    });

                if (insErr) throw insErr;

                existingSet.add(dedupKey);
                imported++;
            } catch (err) {
                errors.push(err.message);
            }
        }

        // Closing balance calculate karo
        let closingBalance = null;
        const lastTxnWithBalance = [...transactions].reverse().find(
            t => t.balance != null && !isNaN(Number(t.balance))
        );
        if (lastTxnWithBalance) {
            closingBalance = Math.round(Number(lastTxnWithBalance.balance));
        }

        // Parser ne balance nahi diya to Supabase se calculate karo
        if (closingBalance === null) {
            const { data: allTxns } = await supabase
                .from('transactions')
                .select('type, amount')
                .eq('user_id', user.id)
                .eq('account_id', Number(account_id));

            let calc = 0;
            (allTxns || []).forEach(t => {
                if (t.type === 'income') calc += t.amount;
                if (t.type === 'expense') calc -= t.amount;
            });
            closingBalance = Math.round(calc);
        }

        const { data: accountInfo } = await supabase
            .from('accounts')
            .select('name')
            .eq('id', Number(account_id))
            .eq('user_id', user.id)
            .maybeSingle();

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
        }, 200);

    } catch (error) {
        console.error('AI Import Error:', error);
        return c.json({ message: error.message || 'Statement import karne mein error aaya', status: 500 }, 500);
    }
};

/**
 * adjustBalanceHandler
 * Route: POST /api/tracker/account/:id/adjust-balance
 */
export const adjustBalanceHandler = async (c) => {
    try {
        const user = c.get('user');
        const supabase = getSupabaseClient(c.env);
        const accountId = Number(c.req.param('id'));
        const { target_balance } = await c.req.json();

        if (target_balance == null || isNaN(Number(target_balance))) {
            return c.json({ message: 'target_balance required', status: 400 }, 400);
        }

        // Account verify
        const { data: accCheck } = await supabase
            .from('accounts')
            .select('id')
            .eq('id', accountId)
            .eq('user_id', user.id)
            .maybeSingle();

        if (!accCheck) return c.json({ message: 'Account nahi mila', status: 404 }, 404);

        // Current balance calculate karo
        const { data: txns } = await supabase
            .from('transactions')
            .select('type, amount')
            .eq('user_id', user.id)
            .eq('account_id', accountId);

        let currentBalance = 0;
        (txns || []).forEach(t => {
            if (t.type === 'income') currentBalance += t.amount;
            if (t.type === 'expense') currentBalance -= t.amount;
        });

        const diff = Math.round(Number(target_balance)) - Math.round(currentBalance);

        if (Math.abs(diff) < 1) {
            return c.json({ message: 'Balance already sahi hai', adjusted: false, status: 200 }, 200);
        }

        const type = diff > 0 ? 'income' : 'expense';
        const amount = Math.abs(diff);

        await supabase
            .from('transactions')
            .insert({
                user_id: user.id,
                type,
                amount,
                description: 'Balance Adjustment (Statement Import)',
                account_id: accountId
            });

        return c.json({
            message: `Balance ₹${Math.round(Number(target_balance)).toLocaleString('en-IN')} kar diya gaya`,
            adjusted: true,
            adjustment_amount: diff,
            status: 200,
        }, 200);

    } catch (error) {
        console.error('Adjust Balance Error:', error);
        return c.json({ message: error.message || 'Balance adjust nahi ho saka', status: 500 }, 500);
    }
};
