// FILE: backend/src/controllers/tracker.controller.js
// KAAM: Expense tracker ka core — transactions, accounts, settings, undo
//
// CHANGES (D1 → Supabase):
//   - c.env.expense_tracker_db hata diya (D1 binding tha)
//   - getSupabaseClient(c.env) se Supabase client lete hain
//   - JOIN queries: supabase.from('transactions').select('*, accounts(name)')
//     Foreign key hona chahiye: transactions.account_id → accounts.id
//   - is_hidden: D1 mein INTEGER (0/1) tha → Supabase mein BOOLEAN (true/false)
//   - PostgreSQL mein INSERT RETURNING id kaam karta hai Supabase mein bhi
//   - Filtering (date, type, search) JS mein hi karte hain — same as before

import { getSupabaseClient } from '../db/supabase.js';

// ─── Helper: Transactions fetch with account_name JOIN ────────────────────────
// WHY HELPER: Ye JOIN Supabase mein foreign key se hoti hai.
// accounts(name) → transactions.account_id → accounts.id
// Result: [{..., accounts: {name: 'HDFC'}}] → hum map kar ke account_name bana dete hain
async function fetchAllTransactions(supabase, userId) {
    const { data, error } = await supabase
        .from('transactions')
        .select('*, accounts(name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) throw error;

    // accounts nested object → account_name flat field (frontend ke sath compatible)
    return (data || []).map(t => ({
        ...t,
        account_name: t.accounts?.name || null,
        accounts: undefined // remove nested object
    }));
}

// ─── Helper: Account balance calculate karna ──────────────────────────────────
function calcBalance(transactions, accountId) {
    let bal = 0;
    transactions.forEach(t => {
        if (t.account_id === accountId) {
            if (t.type === 'income') bal += t.amount;
            if (t.type === 'expense') bal -= t.amount;
        }
    });
    return bal;
}

// ─── GET /api/tracker ─────────────────────────────────────────────────────────
export const getTrackerData = async (c) => {
    try {
        const user = c.get('user');
        const supabase = getSupabaseClient(c.env);

        const startDate  = c.req.query('startDate');
        const endDate    = c.req.query('endDate');
        const month      = c.req.query('month');
        const type       = c.req.query('type');
        const search     = c.req.query('search');

        // 1. User profile (expense_limit, is_saving_mode)
        // WHY: D1 mein .first() tha → Supabase mein .single() ya .maybeSingle()
        const { data: userData, error: userErr } = await supabase
            .from('users')
            .select('name, email, expense_limit, is_saving_mode')
            .eq('id', user.id)
            .maybeSingle();
        if (userErr) throw userErr;

        // 2. Saari transactions (account_name JOIN ke sath)
        const allTxns = await fetchAllTransactions(supabase, user.id);

        // 3. Accounts list
        const { data: accountsData, error: accErr } = await supabase
            .from('accounts')
            .select('*')
            .eq('user_id', user.id);
        if (accErr) throw accErr;

        // 4. Har account ka all-time balance — JS mein calculate (same as D1 logic)
        const accountsWithBalance = (accountsData || []).map(acc => ({
            ...acc,
            balance: calcBalance(allTxns, acc.id)
        }));

        // 5. Filtering — same JS logic as before
        let filteredTxns = allTxns;

        if (startDate && endDate) {
            filteredTxns = filteredTxns.filter(t => {
                const txDate = t.created_at ? t.created_at.split('T')[0].split(' ')[0] : '';
                return txDate >= startDate && txDate <= endDate;
            });
        } else if (month) {
            filteredTxns = filteredTxns.filter(t => t.created_at && t.created_at.startsWith(month));
        }

        if (type && type !== 'all') {
            filteredTxns = filteredTxns.filter(t => t.type === type);
        }

        if (search) {
            const query = search.toLowerCase();
            filteredTxns = filteredTxns.filter(t =>
                (t.description && t.description.toLowerCase().includes(query)) ||
                (t.account_name && t.account_name.toLowerCase().includes(query))
            );
        }

        // 6. Monthly/filtered totals
        let monthlyIncome = 0;
        let monthlyExpenses = 0;
        filteredTxns.forEach(t => {
            // Account Closing transactions ko ignore karo (ek account se doosre ka transfer)
            if (!t.description || !t.description.includes('(Account Closing)')) {
                if (t.type === 'income') monthlyIncome += t.amount;
                else if (t.type === 'expense') monthlyExpenses += t.amount;
            }
        });

        // WHY: D1 mein is_hidden INTEGER (0) tha → Supabase mein BOOLEAN (false)
        // Dono handle karte hain agar migration ke waqt kuch row integer mein aa jaaye
        const visibleMonthTxns = filteredTxns.filter(t => !t.is_hidden && t.is_hidden !== 1);

        // Available months for month picker
        const monthSet = new Set();
        allTxns.forEach(t => {
            if (t.created_at) {
                const m = (t.created_at.split('T')[0] || t.created_at).substring(0, 7);
                if (m) monthSet.add(m);
            }
        });
        const available_months = [...monthSet].sort();

        return c.json({
            user: {
                id: user.id,
                email: userData?.email || user.email,
                name: userData?.name || user.name || 'User'
            },
            expense_limit: userData?.expense_limit || 0,
            is_saving_mode: userData?.is_saving_mode ? true : false,
            total_income: monthlyIncome,
            total_expenses: monthlyExpenses,
            transactions: visibleMonthTxns,
            accounts: accountsWithBalance,
            available_months,
            status: 200
        }, 200);

    } catch (error) {
        console.error("Tracker Data Error:", error);
        return c.json({ message: "internal server error", status: 500 }, 500);
    }
};

// ─── POST /api/tracker/settings ───────────────────────────────────────────────
export const updateSettings = async (c) => {
    try {
        const user = c.get('user');
        const supabase = getSupabaseClient(c.env);
        const { expense_limit, is_saving_mode } = await c.req.json();

        // WHY: D1 UPDATE → Supabase .update().eq()
        const { error } = await supabase
            .from('users')
            .update({
                expense_limit: expense_limit || 0,
                is_saving_mode: !!is_saving_mode // boolean ensure karo
            })
            .eq('id', user.id);

        if (error) throw error;
        return c.json({ message: "Settings updated", status: 200 }, 200);
    } catch (error) {
        return c.json({ message: "internal server error", status: 500 }, 500);
    }
};

// ─── POST /api/tracker/transaction ────────────────────────────────────────────
// ─── POST /api/tracker/transaction ────────────────────────────────────────────
export const addTransaction = async (c) => {
    try {
        const user = c.get('user');
        const supabase = getSupabaseClient(c.env);
        let { type, amount, description, account_id, category } = await c.req.json();

        if (!amount || !type || !account_id) {
            return c.json({ message: "Amount, Type and Account are required", status: 400 }, 400);
        }

        if (!description || description.trim() === '') {
            description = type === 'income' ? 'Income' : 'Expense';
        }

        if (amount <= 0) {
            return c.json({ message: "Amount must be a positive number", status: 400 }, 400);
        }

        // Expense ke liye balance check
        if (type === 'expense' && account_id) {
            const { data: txns, error: txnErr } = await supabase
                .from('transactions')
                .select('type, amount')
                .eq('user_id', user.id)
                .eq('account_id', account_id);

            if (txnErr) throw txnErr;

            let accBalance = 0;
            (txns || []).forEach(t => {
                if (t.type === 'income') accBalance += t.amount;
                if (t.type === 'expense') accBalance -= t.amount;
            });

            if (amount > accBalance) {
                return c.json({
                    message: `Insufficient balance! You only have ₹${accBalance} in this account.`,
                    status: 400
                }, 400);
            }
        }

        // ✅ Category default set karo
        const finalCategory = category || (type === 'income' ? 'Income' : 'General');

        // Transaction insert karo aur ID wapas lo
        const { data: inserted, error } = await supabase
            .from('transactions')
            .insert({
                user_id: user.id,
                type,
                amount,
                description,
                category: finalCategory,      // ✅ category save hogi
                account_id: account_id || null
            })
            .select('id')  // ✅ inserted ID wapas lo
            .single();

        if (error) throw error;

        // ✅ AI Engine ko call karo — background mein embedding banao
        // Fire and forget — user ko wait nahi karna
        try {
            const aiEngineUrl = c.env?.AI_ENGINE_URL || 'http://localhost:8787';
            fetch(`${aiEngineUrl}/api/admin/sync-one`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transaction: {
                        id: inserted.id,
                        type,
                        amount,
                        description,
                        category: finalCategory,
                        user_id: user.id
                    }
                })
            }).catch(err => console.error('[Embedding] Background sync failed:', err.message));
        } catch (embedErr) {
            console.error('[Embedding] Call failed:', embedErr.message);
            // Embedding fail ho to bhi transaction save rahegi ✅
        }

        return c.json({ message: "Transaction added", status: 200 }, 200);

    } catch (error) {
        return c.json({ message: "internal server error", status: 500 }, 500);
    }
};

// ─── DELETE /api/tracker/transaction/:id ──────────────────────────────────────
export const deleteTransaction = async (c) => {
    try {
        const user = c.get('user');
        const supabase = getSupabaseClient(c.env);
        const id = Number(c.req.param('id'));

        // WHY: user_id bhi filter mein hai — doosra user kisi ka transaction delete na kar sake
        const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) throw error;
        return c.json({ message: "Transaction deleted from history", status: 200 }, 200);

    } catch (error) {
        return c.json({ message: "internal server error", status: 500 }, 500);
    }
};

// ─── POST /api/tracker/account ────────────────────────────────────────────────
export const addAccount = async (c) => {
    try {
        const user = c.get('user');
        const supabase = getSupabaseClient(c.env);
        const { name } = await c.req.json();

        if (!name) return c.json({ message: "Name is required", status: 400 }, 400);

        const { error } = await supabase
            .from('accounts')
            .insert({ user_id: user.id, name });

        if (error) throw error;
        return c.json({ message: "Account added", status: 200 }, 200);

    } catch (error) {
        return c.json({ message: "internal server error", status: 500 }, 500);
    }
};

// ─── DELETE /api/tracker/account/:id ──────────────────────────────────────────
export const deleteAccount = async (c) => {
    try {
        const user = c.get('user');
        const supabase = getSupabaseClient(c.env);
        const id = Number(c.req.param('id'));

        let body = {};
        try { body = await c.req.json(); } catch (e) {}
        let transfer_account_id = body.transfer_account_id;
        const auto_create_account_name = body.auto_create_account_name;

        // Account naam fetch karo (closing account ka naam transfer description mein lagega)
        const { data: closingAcc } = await supabase
            .from('accounts')
            .select('name')
            .eq('id', id)
            .eq('user_id', user.id)
            .maybeSingle();
        const closingAccName = closingAcc?.name || 'Account';

        // Saari transactions fetch karke balance nikalo
        const { data: txns, error: txnErr } = await supabase
            .from('transactions')
            .select('type, amount')
            .eq('user_id', user.id)
            .eq('account_id', id);
        if (txnErr) throw txnErr;

        let balance = 0;
        (txns || []).forEach(t => {
            if (t.type === 'income') balance += t.amount;
            if (t.type === 'expense') balance -= t.amount;
        });

        // Agar balance hai to transfer karna padega
        if (balance !== 0) {
            if (!transfer_account_id && !auto_create_account_name) {
                return c.json({ message: "BALANCE_REMAINING", balance, status: 400 }, 400);
            }

            // Nayi account auto-create karo agar naam diya gaya
            if (!transfer_account_id && auto_create_account_name) {
                // WHY: INSERT RETURNING — Supabase mein .select() ke saath kaam karta hai
                const { data: newAcc, error: newAccErr } = await supabase
                    .from('accounts')
                    .insert({ user_id: user.id, name: auto_create_account_name })
                    .select('id')
                    .single();
                if (newAccErr) throw newAccErr;
                transfer_account_id = newAcc.id;
            }

            const transferAmount = Math.abs(balance);
            const outType = balance > 0 ? 'expense' : 'income';
            const inType  = balance > 0 ? 'income'  : 'expense';

            // Transfer transactions insert karo
            await supabase.from('transactions').insert([
                {
                    user_id: user.id, type: outType, amount: transferAmount,
                    description: 'Transfer out (Account Closing)', account_id: id
                },
                {
                    user_id: user.id, type: inType, amount: transferAmount,
                    description: `Transfer in from ${closingAccName} (Account Closing)`,
                    account_id: transfer_account_id
                }
            ]);
        }

        // Transactions unlink karo (account_id null karo) phir account delete karo
        await supabase
            .from('transactions')
            .update({ account_id: null })
            .eq('account_id', id)
            .eq('user_id', user.id);

        await supabase
            .from('accounts')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        return c.json({ message: "Account deleted", status: 200 }, 200);

    } catch (error) {
        console.error("Delete Account Error:", error);
        return c.json({ message: "internal server error", details: error.message, status: 500 }, 500);
    }
};

// ─── DELETE /api/tracker/reset ────────────────────────────────────────────────
export const resetAllData = async (c) => {
    try {
        const user = c.get('user');
        const supabase = getSupabaseClient(c.env);

        // WHY: Pehle transactions delete karo (foreign key constraint ke wajah se)
        // Phir accounts delete karo
        const { error: txnErr } = await supabase
            .from('transactions')
            .delete()
            .eq('user_id', user.id);
        if (txnErr) throw txnErr;

        const { error: accErr } = await supabase
            .from('accounts')
            .delete()
            .eq('user_id', user.id);
        if (accErr) throw accErr;

        return c.json({ message: "All data reset successfully", status: 200 }, 200);

    } catch (error) {
        console.error("Reset error:", error);
        return c.json({ message: "internal server error", error: error.message, status: 500 }, 500);
    }
};

// ─── POST /api/tracker/undo ───────────────────────────────────────────────────
export const undoLastTransaction = async (c) => {
    try {
        const user = c.get('user');
        const supabase = getSupabaseClient(c.env);

        // Sabse recent transaction dhundo (id DESC)
        const { data: lastTxn, error: fetchErr } = await supabase
            .from('transactions')
            .select('id, description, amount')
            .eq('user_id', user.id)
            .order('id', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (fetchErr) throw fetchErr;

        if (lastTxn) {
            await supabase
                .from('transactions')
                .delete()
                .eq('id', lastTxn.id)
                .eq('user_id', user.id);

            return c.json({
                message: `Undo successful: Removed '${lastTxn.description}' (₹${lastTxn.amount})`,
                status: 200
            }, 200);
        }

        return c.json({ message: "Koi recent action nahi mila jise undo kiya ja sake.", status: 400 }, 400);

    } catch (error) {
        console.error("Undo error:", error);
        return c.json({ message: "internal server error", error: error.message, status: 500 }, 500);
    }
};