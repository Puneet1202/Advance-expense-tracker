import { parseWithLocalEngine } from './local-parser.js';
import { getSupabaseClient } from '../../db/supabase.js';
import { detectCategory } from '../ai-chat/chat-handler.js';

export const importStatementHandler = async (c) => {
    try {
        const user = c.get('user');
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

        let transactions = [];
        try {
            transactions = await parseWithLocalEngine(file);
        } catch (parseErr) {
            return c.json({ message: `File parse nahi hua: ${parseErr.message}`, status: 422 }, 422);
        }

        if (!transactions || transactions.length === 0) {
            return c.json({ message: 'Koi transaction nahi mila is file mein.', status: 400 }, 400);
        }

        const { data: existingTxns, error: existErr } = await supabase
            .from('transactions')
            .select('amount, created_at, description, type')
            .eq('user_id', user.id)
            .eq('account_id', Number(account_id));

        if (existErr) throw existErr;

        const existingSet = new Set(
            (existingTxns || []).map(t => {
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

                const rawCat = txn.category != null ? String(txn.category).trim() : '';
                const resolvedCategory = rawCat || detectCategory(description);

                const { error: insErr } = await supabase
                    .from('transactions')
                    .insert({
                        user_id: user.id,
                        type,
                        amount,
                        description,
                        category: resolvedCategory,
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

        let closingBalance = null;
        const lastTxnWithBalance = [...transactions].reverse().find(
            t => t.balance != null && !isNaN(Number(t.balance))
        );
        if (lastTxnWithBalance) {
            closingBalance = Math.round(Number(lastTxnWithBalance.balance));
        }

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

        // ✅ Background mein embedding banao — import hone ke baad
        const aiEngineUrl = c.env?.AI_ENGINE_URL || 'http://localhost:8787';
        fetch(`${aiEngineUrl}/api/admin/sync-all-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id })
        }).catch(err => console.error('[Embedding] Import sync failed:', err.message));

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

export const adjustBalanceHandler = async (c) => {
    try {
        const user = c.get('user');
        const supabase = getSupabaseClient(c.env);
        const accountId = Number(c.req.param('id'));
        const { target_balance } = await c.req.json();

        if (target_balance == null || isNaN(Number(target_balance))) {
            return c.json({ message: 'target_balance required', status: 400 }, 400);
        }

        const { data: accCheck } = await supabase
            .from('accounts')
            .select('id')
            .eq('id', accountId)
            .eq('user_id', user.id)
            .maybeSingle();

        if (!accCheck) return c.json({ message: 'Account nahi mila', status: 404 }, 404);

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