// FILE: backend/src/features/ai-chat/index.js
// KAAM: AI Chat handler — user ke messages process karta hai
//
// CHANGES (D1 → Supabase):
//   - c.env.expense_tracker_db hata diya (D1 binding tha)
//   - getSupabaseClient(c.env) se Supabase client lete hain
//   - Transactions + accounts Supabase se fetch karte hain
//
// ARCHITECTURE FIX:
//   - Pehle: Backend D1 se sab data fetch karta tha aur AI Engine ko bhejta tha
//   - Ab: Backend Supabase se data fetch karta hai, systemPrompt banata hai,
//     phir AI Engine ko bhejta hai — AI Engine khud se aur kuch nahi fetch karta
//   - AI Engine sirf Cloudflare AI se response leke deta hai

import { handleChat } from './chat-handler.js';
import { getSupabaseClient } from '../../db/supabase.js';

export const aiChatHandler = async (c) => {
    try {
        const user = c.get('user');
        // WHY: D1 binding hata — Supabase se data fetch karo
        const supabase = getSupabaseClient(c.env);

        const body = await c.req.json();
        const { message, history = [], usdRate = 83 } = body;

        if (!message?.trim()) {
            return c.json({ message: 'Message empty nahi ho sakta', status: 400 }, 400);
        }

        // Transactions fetch karo Supabase se (D1 JOIN → Supabase nested select)
        // WHY accounts(name): account_name nikalna ke liye foreign key join
        const { data: txnData, error: txnErr } = await supabase
            .from('transactions')
            .select('id, type, amount, category, description, created_at, account_id, accounts(name)')
            .eq('user_id', user.id)
            .eq('is_hidden', false) // WHY: D1 mein is_hidden = 0 tha → Supabase mein false
            .order('created_at', { ascending: false });

        if (txnErr) throw txnErr;

        // accounts nested object → account_name flat field (chat-handler.js ke sath compatible)
        const transactions = (txnData || []).map(t => ({
            ...t,
            account_name: t.accounts?.name || null,
            accounts: undefined
        }));

        // Account balances calculate karo
        const { data: accountsData, error: accErr } = await supabase
            .from('accounts')
            .select('id, name')
            .eq('user_id', user.id);

        if (accErr) throw accErr;

        const accounts = (accountsData || []).map(acc => {
            let balance = 0;
            transactions.forEach(t => {
                if (t.account_id === acc.id) {
                    balance += t.type === 'income' ? t.amount : -t.amount;
                }
            });
            return { name: acc.name, balance: parseFloat(balance.toFixed(2)) };
        });

        // handleChat: system prompt banata hai + AI Engine ko call karta hai
        const result = await handleChat(message, transactions, accounts, history, user.id, usdRate);

        return c.json({ ...result, status: 200 }, 200);

    } catch (error) {
        console.error('AI Chat Error:', error);
        return c.json({
            message: error.message || 'Chat mein error aaya',
            status: 500,
        }, 500);
    }
};