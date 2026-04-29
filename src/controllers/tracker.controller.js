    export const getTrackerData = async (c) => {
        try {
            const user = c.get('user');
            const db = c.env.expense_tracker_db;
            const month = c.req.query('month'); // e.g., '2026-04'

            // Get user settings and profile
            const userData = await db.prepare("SELECT name, email, expense_limit, is_saving_mode FROM USERS WHERE id = ?").bind(user.id).first();
            
            // Get all transactions for all-time balance calculation
            const allTxns = await db.prepare(`
                SELECT t.*, a.name as account_name 
                FROM TRANSACTIONS t 
                LEFT JOIN ACCOUNTS a ON t.account_id = a.id 
                WHERE t.user_id = ? ORDER BY t.created_at DESC
            `).bind(user.id).all();
            
            // Get all accounts and calculate their all-time balances
            const accountsResult = await db.prepare("SELECT * FROM ACCOUNTS WHERE user_id = ?").bind(user.id).all();
            
            const accountsWithBalance = accountsResult.results.map(acc => {
                let accIncome = 0;
                let accExpense = 0;
                allTxns.results.forEach(t => {
                    if (t.account_id === acc.id) {
                        if (t.type === 'income') accIncome += t.amount;
                        if (t.type === 'expense') accExpense += t.amount;
                    }
                });
                return { ...acc, balance: accIncome - accExpense };
            });

            // Filter transactions for the selected month
            let monthTxns = allTxns.results;
            if (month) {
                monthTxns = allTxns.results.filter(t => t.created_at.startsWith(month));
            }

            // Calculate Monthly totals (Includes hidden transactions as per user request)
            let monthlyIncome = 0;
            let monthlyExpenses = 0;
            monthTxns.forEach(t => {
                if (!t.description.includes('(Account Closing)')) {
                    if (t.type === 'income') monthlyIncome += t.amount;
                    else if (t.type === 'expense') monthlyExpenses += t.amount;
                }
            });

            // Hide transactions that were deleted by the user from the UI
            const visibleMonthTxns = monthTxns.filter(t => t.is_hidden === 0);

            // Get list of months that have data
            const monthSet = new Set();
            allTxns.results.forEach(t => {
                if (t.created_at) monthSet.add(t.created_at.substring(0, 7));
            });
            const available_months = [...monthSet].sort();

            return c.json({
                user: { id: user.id, email: userData?.email || user.email, name: userData?.name || user.name || 'User' },
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
            return c.json({ message: "internal server error", status: 500 }, 500);
        }
    };

    export const updateSettings = async (c) => {
        try {
            const user = c.get('user');
            const db = c.env.expense_tracker_db;
            const { expense_limit, is_saving_mode } = await c.req.json();

            await db.prepare("UPDATE USERS SET expense_limit = ?, is_saving_mode = ? WHERE id = ?")
                .bind(expense_limit || 0, is_saving_mode ? 1 : 0, user.id)
                .run();

            return c.json({ message: "Settings updated", status: 200 }, 200);
        } catch (error) {
            return c.json({ message: "internal server error", status: 500 }, 500);
        }
    };

    export const addTransaction = async (c) => {
        try {
            const user = c.get('user');
            const db = c.env.expense_tracker_db;
            let { type, amount, description, account_id } = await c.req.json();

            if (!amount || !type || !account_id) {
                return c.json({ message: "Amount, Type and Account are required", status: 400 }, 400);
            }

            if (!description || description.trim() === '') {
                description = type === 'income' ? 'Income' : 'Expense';
            }

            if (amount <= 0) {
                return c.json({ message: "Amount must be a positive number", status: 400 }, 400);
            }

            // If adding an expense to a specific account, verify balance
            if (type === 'expense' && account_id) {
                const allTxns = await db.prepare("SELECT type, amount FROM TRANSACTIONS WHERE user_id = ? AND account_id = ?").bind(user.id, account_id).all();
                let accBalance = 0;
                allTxns.results.forEach(t => {
                    if (t.type === 'income') accBalance += t.amount;
                    if (t.type === 'expense') accBalance -= t.amount;
                });
                if (amount > accBalance) {
                    return c.json({ message: `Insufficient balance! You only have ₹${accBalance} in this account.`, status: 400 }, 400);
                }
            }

            await db.prepare("INSERT INTO TRANSACTIONS (user_id, type, amount, description, account_id) VALUES (?, ?, ?, ?, ?)")
                .bind(user.id, type, amount, description, account_id || null)
                .run();

            return c.json({ message: "Transaction added", status: 200 }, 200);
        } catch (error) {
            return c.json({ message: "internal server error", status: 500 }, 500);
        }
    };

    export const deleteTransaction = async (c) => {
        try {
            const user = c.get('user');
            const db = c.env.expense_tracker_db;
            const id = c.req.param('id');

            await db.prepare("UPDATE TRANSACTIONS SET is_hidden = 1 WHERE id = ? AND user_id = ?").bind(id, user.id).run();
            return c.json({ message: "Transaction hidden from history", status: 200 }, 200);
        } catch (error) {
            return c.json({ message: "internal server error", status: 500 }, 500);
        }
    };

    export const addAccount = async (c) => {
        try {
            const user = c.get('user');
            const db = c.env.expense_tracker_db;
            const { name } = await c.req.json();

            if (!name) return c.json({ message: "Name is required", status: 400 }, 400);

            await db.prepare("INSERT INTO ACCOUNTS (user_id, name) VALUES (?, ?)")
                .bind(user.id, name)
                .run();

            return c.json({ message: "Account added", status: 200 }, 200);
        } catch (error) {
            return c.json({ message: "internal server error", status: 500 }, 500);
        }
    };

    export const deleteAccount = async (c) => {
        try {
            const user = c.get('user');
            const db = c.env.expense_tracker_db;
            const id = c.req.param('id');
            
            let body = {};
            try { body = await c.req.json(); } catch(e) {}
            let transfer_account_id = body.transfer_account_id;
            const auto_create_account_name = body.auto_create_account_name;

            // Fetch the name of the account being deleted
            const closingAcc = await db.prepare("SELECT name FROM ACCOUNTS WHERE id = ? AND user_id = ?").bind(id, user.id).first();
            const closingAccName = closingAcc ? closingAcc.name : "Account";

            // Check balance first
            const txns = await db.prepare("SELECT type, amount FROM TRANSACTIONS WHERE user_id = ? AND account_id = ?").bind(user.id, id).all();
            let balance = 0;
            txns.results.forEach(t => {
                if (t.type === 'income') balance += t.amount;
                if (t.type === 'expense') balance -= t.amount;
            });

            if (balance > 0) {
                if (!transfer_account_id && !auto_create_account_name) {
                    return c.json({ 
                        message: "BALANCE_REMAINING",
                        balance: balance,
                        status: 400 
                    }, 400);
                }

                if (!transfer_account_id && auto_create_account_name) {
                    const newAcc = await db.prepare("INSERT INTO ACCOUNTS (user_id, name) VALUES (?, ?) RETURNING id").bind(user.id, auto_create_account_name).first();
                    transfer_account_id = newAcc.id;
                }
                
                // Do the transfer: 
                await db.prepare("INSERT INTO TRANSACTIONS (user_id, type, amount, description, account_id) VALUES (?, ?, ?, ?, ?)")
                    .bind(user.id, 'expense', balance, `Transfer out (Account Closing)`, id)
                    .run();
                    
                await db.prepare("INSERT INTO TRANSACTIONS (user_id, type, amount, description, account_id) VALUES (?, ?, ?, ?, ?)")
                    .bind(user.id, 'income', balance, `Transfer in from ${closingAccName} (Account Closing)`, transfer_account_id)
                    .run();
            }

            await db.prepare("DELETE FROM ACCOUNTS WHERE id = ? AND user_id = ?").bind(id, user.id).run();
            return c.json({ message: "Account deleted", status: 200 }, 200);
        } catch (error) {
            return c.json({ message: "internal server error", status: 500 }, 500);
        }
    };

    export const resetAllData = async (c) => {
        try {
            const user = c.get('user');
            const db = c.env.expense_tracker_db;

            await db.prepare("DELETE FROM TRANSACTIONS WHERE user_id = ?").bind(user.id).run();
            await db.prepare("DELETE FROM ACCOUNTS WHERE user_id = ?").bind(user.id).run();

            return c.json({ message: "All data reset successfully", status: 200 }, 200);
        } catch (error) {
            console.error("Reset error:", error);
            return c.json({ message: "internal server error", error: error.message, status: 500 }, 500);
        }
    };
