import { getSupabaseClient } from '../db/supabase.js';

// ── detectCategory (simple, no AI) ───────────────────────────────────────────
function detectCategory(description = '') {
    const d = description.toLowerCase();
    if (/swiggy|zomato|food|restaurant|eat|meal|dhaba/.test(d)) return 'Food';
    if (/amazon|flipkart|mall|shop|store|buy|purchase/.test(d)) return 'Shopping';
    if (/petrol|hp|bpcl|fuel|diesel|gas station/.test(d)) return 'Fuel';
    if (/electricity|water|bill|dth|internet|recharge|jio|airtel/.test(d)) return 'Bills';
    if (/salary|stipend|payroll/.test(d)) return 'Salary';
    if (/uber|ola|auto|bus|metro|train|cab|transport/.test(d)) return 'Transport';
    if (/flight|hotel|travel|trip|holiday/.test(d)) return 'Travel';
    if (/neft|imps|upi|transfer|sent/.test(d)) return 'Transfer';
    if (/gym|fitness|workout/.test(d)) return 'Fitness';
    if (/doctor|hospital|medicine|health|medical/.test(d)) return 'Health';
    if (/rent|house|pg|hostel/.test(d)) return 'Housing';
    if (/movie|netflix|spotify|entertainment/.test(d)) return 'Entertainment';
    return 'General';
}

// ── Helper: transactions fetch with account JOIN ──────────────────────────────
async function fetchAllTransactions(supabase, userId) {
    const { data, error } = await supabase
        .from('transactions')
        .select('*, accounts(name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(t => ({
        ...t,
        account_name: t.accounts?.name || null,
        accounts: undefined
    }));
}

// ── Helper: account balance ───────────────────────────────────────────────────
function calcBalance(transactions, accountId) {
    let bal = 0;
    transactions.forEach(t => {
        if (t.account_id === accountId) {
            if (t.type === 'income') bal += Number(t.amount);
            if (t.type === 'expense') bal -= Number(t.amount);
        }
    });
    return bal;
}

// ── GET /api/tracker ──────────────────────────────────────────────────────────
export const getTrackerData = async (c) => {
    try {
        const user = c.get('user');
        const supabase = getSupabaseClient(c.env);

        const startDate = c.req.query('startDate');
        const endDate   = c.req.query('endDate');
        const type      = c.req.query('type');
        const search    = c.req.query('search');

        const { data: userData, error: userErr } = await supabase
            .from('users')
            .select('name, email, expense_limit, is_saving_mode')
            .eq('id', user.id)
            .maybeSingle();
        if (userErr) throw userErr;

        const allTxns = await fetchAllTransactions(supabase, user.id);

        const { data: accountsData, error: accErr } = await supabase
            .from('accounts')
            .select('*')
            .eq('user_id', user.id);
        if (accErr) throw accErr;

        const accountsWithBalance = (accountsData || []).map(acc => ({
            ...acc,
            balance: calcBalance(allTxns, acc.id)
        }));

        let filteredTxns = allTxns;

        if (startDate && endDate) {
            filteredTxns = filteredTxns.filter(t => {
                const txDate = t.created_at ? t.created_at.split('T')[0] : '';
                return txDate >= startDate && txDate <= endDate;
            });
        }

        if (type && type !== 'all') {
            filteredTxns = filteredTxns.filter(t => t.type === type);
        }

        if (search) {
            const q = search.toLowerCase();
            filteredTxns = filteredTxns.filter(t =>
                (t.description && t.description.toLowerCase().includes(q)) ||
                (t.account_name && t.account_name.toLowerCase().includes(q))
            );
        }

        let monthlyIncome = 0, monthlyExpenses = 0;
        filteredTxns.forEach(t => {
            if (t.description?.includes('(Account Closing)')) return;
            if (t.type === 'income') monthlyIncome += Number(t.amount);
            else if (t.type === 'expense') monthlyExpenses += Number(t.amount);
        });

        const visibleTxns = filteredTxns.filter(t => !t.is_hidden);

        const monthSet = new Set();
        allTxns.forEach(t => {
            if (t.created_at) monthSet.add(t.created_at.substring(0, 7));
        });

        return c.json({
            user: { id: user.id, email: userData?.email || user.email, name: userData?.name || user.name || 'User' },
            expense_limit: userData?.expense_limit || 0,
            is_saving_mode: userData?.is_saving_mode || false,
            total_income: monthlyIncome,
            total_expenses: monthlyExpenses,
            transactions: visibleTxns,
            accounts: accountsWithBalance,
            available_months: [...monthSet].sort(),
            status: 200
        }, 200);

    } catch (error) {
        console.error(error);
        return c.json({ message: 'internal server error', status: 500 }, 500);
    }
};

// ── POST /api/tracker/settings ────────────────────────────────────────────────
export const updateSettings = async (c) => {
    try {
        const user = c.get('user');
        const supabase = getSupabaseClient(c.env);
        const { expense_limit, is_saving_mode } = await c.req.json();

        const { error } = await supabase
            .from('users')
            .update({ expense_limit: expense_limit || 0, is_saving_mode: !!is_saving_mode })
            .eq('id', user.id);

        if (error) throw error;
        return c.json({ message: 'Settings updated', status: 200 }, 200);
    } catch (error) {
        return c.json({ message: 'internal server error', status: 500 }, 500);
    }
};

// ── POST /api/tracker/transaction ─────────────────────────────────────────────
export const addTransaction = async (c) => {
    try {
        const user = c.get('user');
        const supabase = getSupabaseClient(c.env);
        let { type, amount, description, account_id, category } = await c.req.json();

        if (!amount || !type || !account_id)
            return c.json({ message: 'Amount, Type and Account are required', status: 400 }, 400);

        if (!description || !description.trim())
            description = type === 'income' ? 'Income' : 'Expense';

        if (amount <= 0)
            return c.json({ message: 'Amount must be positive', status: 400 }, 400);

        // Balance check for expense
        if (type === 'expense') {
            const { data: txns } = await supabase
                .from('transactions')
                .select('type, amount')
                .eq('user_id', user.id)
                .eq('account_id', account_id);

            let bal = 0;
            (txns || []).forEach(t => {
                if (t.type === 'income') bal += Number(t.amount);
                if (t.type === 'expense') bal -= Number(t.amount);
            });

            if (amount > bal)
                return c.json({ message: `Insufficient balance! You only have ₹${bal} in this account.`, status: 400 }, 400);
        }

        const finalCategory = category?.trim() || detectCategory(description);

        const { error } = await supabase
            .from('transactions')
            .insert({ user_id: user.id, type, amount, description, category: finalCategory, account_id: account_id || null });

        if (error) throw error;
        return c.json({ message: 'Transaction added', status: 200 }, 200);

    } catch (error) {
        return c.json({ message: 'internal server error', status: 500 }, 500);
    }
};

// ── DELETE /api/tracker/transaction/:id ───────────────────────────────────────
export const deleteTransaction = async (c) => {
    try {
        const user = c.get('user');
        const supabase = getSupabaseClient(c.env);
        const id = Number(c.req.param('id'));

        const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) throw error;
        return c.json({ message: 'Transaction deleted', status: 200 }, 200);
    } catch (error) {
        return c.json({ message: 'internal server error', status: 500 }, 500);
    }
};

// ── POST /api/tracker/account ─────────────────────────────────────────────────
export const addAccount = async (c) => {
    try {
        const user = c.get('user');
        const supabase = getSupabaseClient(c.env);
        const { name } = await c.req.json();

        if (!name) return c.json({ message: 'Name is required', status: 400 }, 400);

        const { error } = await supabase
            .from('accounts')
            .insert({ user_id: user.id, name });

        if (error) throw error;
        return c.json({ message: 'Account added', status: 200 }, 200);
    } catch (error) {
        return c.json({ message: 'internal server error', status: 500 }, 500);
    }
};

// ── DELETE /api/tracker/account/:id ──────────────────────────────────────────
export const deleteAccount = async (c) => {
    try {
        const user = c.get('user');
        const supabase = getSupabaseClient(c.env);
        const id = Number(c.req.param('id'));

        let body = {};
        try { body = await c.req.json(); } catch (e) {}
        let transfer_account_id = body.transfer_account_id;
        const auto_create_account_name = body.auto_create_account_name;

        const { data: closingAcc } = await supabase
            .from('accounts').select('name').eq('id', id).eq('user_id', user.id).maybeSingle();
        const closingAccName = closingAcc?.name || 'Account';

        const { data: txns } = await supabase
            .from('transactions').select('type, amount').eq('user_id', user.id).eq('account_id', id);

        let balance = 0;
        (txns || []).forEach(t => {
            if (t.type === 'income') balance += Number(t.amount);
            if (t.type === 'expense') balance -= Number(t.amount);
        });

        if (balance !== 0) {
            if (!transfer_account_id && !auto_create_account_name)
                return c.json({ message: 'BALANCE_REMAINING', balance, status: 400 }, 400);

            if (!transfer_account_id && auto_create_account_name) {
                const { data: newAcc, error: newAccErr } = await supabase
                    .from('accounts').insert({ user_id: user.id, name: auto_create_account_name }).select('id').single();
                if (newAccErr) throw newAccErr;
                transfer_account_id = newAcc.id;
            }

            const transferAmount = Math.abs(balance);
            const outType = balance > 0 ? 'expense' : 'income';
            const inType  = balance > 0 ? 'income'  : 'expense';

            await supabase.from('transactions').insert([
                { user_id: user.id, type: outType, amount: transferAmount, description: 'Transfer out (Account Closing)', account_id: id },
                { user_id: user.id, type: inType, amount: transferAmount, description: `Transfer in from ${closingAccName} (Account Closing)`, account_id: transfer_account_id }
            ]);
        }

        await supabase.from('transactions').update({ account_id: null }).eq('account_id', id).eq('user_id', user.id);
        await supabase.from('accounts').delete().eq('id', id).eq('user_id', user.id);

        return c.json({ message: 'Account deleted', status: 200 }, 200);
    } catch (error) {
        return c.json({ message: 'internal server error', details: error.message, status: 500 }, 500);
    }
};

// ── DELETE /api/tracker/reset ─────────────────────────────────────────────────
export const resetAllData = async (c) => {
    try {
        const user = c.get('user');
        const supabase = getSupabaseClient(c.env);

        const { error: txnErr } = await supabase.from('transactions').delete().eq('user_id', user.id);
        if (txnErr) throw txnErr;

        const { error: accErr } = await supabase.from('accounts').delete().eq('user_id', user.id);
        if (accErr) throw accErr;

        return c.json({ message: 'All data reset', status: 200 }, 200);
    } catch (error) {
        return c.json({ message: 'internal server error', status: 500 }, 500);
    }
};

// ── POST /api/tracker/undo ────────────────────────────────────────────────────
export const undoLastTransaction = async (c) => {
    try {
        const user = c.get('user');
        const supabase = getSupabaseClient(c.env);

        const { data: lastTxn } = await supabase
            .from('transactions')
            .select('id, description, amount')
            .eq('user_id', user.id)
            .order('id', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (lastTxn) {
            await supabase.from('transactions').delete().eq('id', lastTxn.id).eq('user_id', user.id);
            return c.json({ message: `Undo: Removed '${lastTxn.description}' (₹${lastTxn.amount})`, status: 200 }, 200);
        }

        return c.json({ message: 'Koi transaction nahi mili', status: 400 }, 400);
    } catch (error) {
        return c.json({ message: 'internal server error', status: 500 }, 500);
    }
};