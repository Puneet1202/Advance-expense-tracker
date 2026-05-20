import { askCloudflareAI } from './src/providers/cloudflare.js'; 
import { buildSQLPrompt, buildReplyPrompt, buildActionPrompt } from './prompts.js';

// Schema encapsulated inside the core engine module (Single Source of Truth)
const ENGINE_DB_SCHEMA = `
Table: transactions
  - id (integer, primary key)
  - user_id (uuid)
  - account_id (uuid)
  - type (text: 'income' or 'expense')
  - amount (numeric)
  - description (text)
  - category (text)
  - created_at (timestamp)

Table: accounts
  - id (uuid)
  - user_id (uuid)
  - name (text)
  - created_at (timestamp)

Table: users
  - id (integer, primary key)
  - name (text)
  - email (text)
  - expense_limit (numeric)
  - is_saving_mode (boolean)
`;

function isProfileNameQuestion(message) {
    return /^(my name|what is my name|who am i|tell me my name)\??$/i.test(message.trim());
}

function isVagueExpenseQuestion(message) {
    return /^(expense|expenses|income|kharcha|spending|spend)$/i.test(message.trim());
}

function getVagueCategory(message) {
    const categoryMap = {
        food: 'Food',
        shopping: 'Shopping',
        transport: 'Transport',
        fuel: 'Fuel',
        bills: 'Bills',
        salary: 'Salary',
        travel: 'Travel',
        fitness: 'Fitness',
        health: 'Health',
        housing: 'Housing',
        entertainment: 'Entertainment'
    };

    return categoryMap[message.trim().toLowerCase()] || null;
}

function isTransactionListQuestion(message) {
    return /\b(last|latest|recent|show|list|all)\b/i.test(message) &&
        /\b(transaction|transactions|expense|expenses|income)\b/i.test(message);
}

function formatValue(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return '0';
    if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
    return String(value);
}

function formatTransactionRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return 'No matching records were found.';
    }

    return rows.map((row, index) => {
        const amount = row.amount ?? row.total_amount ?? row.sum ?? row.total;
        const account = row.account_name ?? row.account ?? row.name;
        const description = row.description ?? row.details ?? row.category ?? 'Transaction';
        const type = row.type ? `, ${row.type}` : '';
        const category = row.category ? `, ${row.category}` : '';
        const accountText = account ? `, ${account}` : '';
        const date = row.created_at ? `, ${new Date(row.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}` : '';
        const id = row.id ? `#${row.id} ` : '';

        return `${index + 1}. ${id}${description}: ₹${formatValue(Number(amount || 0))}${type}${category}${accountText}${date}`;
    }).join('\n');
}

/**
 * Core AI Chat Engine - Clean & Scalable Decoupled Architecture
 */
export async function aiChat(env, supabase, userId, message, history = []) {
    try {
        const cleanMessage = message.trim().toLowerCase();

        if (isProfileNameQuestion(message)) {
            const { data: userProfile, error } = await supabase
                .from('users')
                .select('name, email')
                .eq('id', userId)
                .maybeSingle();

            if (error) throw error;
            if (userProfile?.name) return { reply: `Your name is ${userProfile.name}.` };
            if (userProfile?.email) return { reply: `I found your email as ${userProfile.email}, but no name is saved in your profile.` };
            return { reply: 'I could not find a saved name in your profile.' };
        }

        if (isVagueExpenseQuestion(message)) {
            return {
                reply: 'Do you want total expenses this month, recent expenses, category-wise expenses, or expenses from a specific account?'
            };
        }

        const vagueCategory = getVagueCategory(message);
        if (vagueCategory) {
            return {
                reply: `For ${vagueCategory}, do you want this month's total, recent transactions, account-wise breakdown, or all-time spending?`
            };
        }

        // 🛡️ CONTEXT LIMITATION GUARDRAIL: Strict context window tokens management
        const safeHistory = Array.isArray(history) ? history.slice(-4) : [];

        // 🚀 DYNAMIC COMPLIANCE: Fetch user accounts directly from DB to avoid hardcoding
        const { data: userAccounts } = await supabase
            .from('accounts')
            .select('name')
            .eq('user_id', userId);

        const dynamicAccounts = userAccounts ? userAccounts.map(acc => acc.name.toLowerCase()) : [];
        
        // System operational keywords to detect finance tracking context
        const systemKeywords = ['add', 'sub', 'spent', 'paid', 'income', 'expense', 'transaction', 'balance', 'kharcha'];

        // 🛡️ SMART INTENT BYPASS: Check if user input contains any financial context dynamically
        const hasFinanceContext = dynamicAccounts.some(acc => cleanMessage.includes(acc)) || 
                                  systemKeywords.some(kw => cleanMessage.includes(kw));

        const trueGreetings = ['hi', 'hello', 'hey', 'yo', 'sup', 'hola', 'good morning', 'good afternoon'];

        // If it's just a greeting or short non-finance text, handle immediately at edge layer
        if (trueGreetings.includes(cleanMessage) || (cleanMessage.length <= 3 && !hasFinanceContext)) {
            const replyPrompt = `You are a professional AI Financial Assistant. The user greeted you with "${message}". Reply with a short, welcoming single-sentence response in pure, crisp English, asking how you can help them manage their finances today.`;
            const quickReply = await askCloudflareAI(replyPrompt, message, safeHistory, env);
            return { reply: quickReply };
        }

        // 🛡️ INTENT OVERRIDE GUARDRAIL: Force action execution path for explicit mutations
        const actionKeywords = ['spent', 'paid', 'received', 'add', 'added', 'gave', 'buy', 'bought'];
        let forcedDecision = null;
        
        const words = cleanMessage.split(' ');
        if (words.some(word => actionKeywords.includes(word))) {
            forcedDecision = "ACTION";
        }

        // 🛡️ RE-ARCHITECTED LIGHTWEIGHT SCHEMA LAYER
        // No heavy DB instructions injection to prevent token context blast
        const finalDynamicSchema = `
            ${ENGINE_DB_SCHEMA}
           Strict Rule: Use SQL aggregates like SUM, COUNT, AVG directly in queries instead of fetching raw rows.
           Strict Rule: For transaction list requests, always join accounts and include transactions.id, transactions.description, transactions.type, transactions.amount, transactions.category, transactions.created_at, accounts.name as account_name.
            `;

        // 1. First Core Turn: Intent Classification / SQL Generation
      // 1. First Core Turn: Intent Classification / SQL Generation
      let decision;
      if (forcedDecision) {
          decision = forcedDecision; 
      } else {
          const sqlPrompt = buildSQLPrompt(message, finalDynamicSchema, userId);
          
          // 🔥 CRITICAL FIXED LINE: Passing empty array [] here instead of safeHistory
          // Isse classification layer par purani chat history ka 20k+ tokens ka load instant ZERO ho jayega!
          const firstReply = await askCloudflareAI(sqlPrompt, message, [], env);
          decision = firstReply.trim();
      }

        // ======================================================================
        // FLOW A: ACTION DATA MUTATION ROUTING (ADD, DELETE, UNDO)
        // ======================================================================
        if (decision === "ACTION") {
            const actionPrompt = buildActionPrompt(message, userId);
            const actionReply = await askCloudflareAI(actionPrompt, message, safeHistory, env);

            try {
                const actionJson = JSON.parse(actionReply);

                if (!actionJson.action || actionJson.action === "NONE") {
                    return { reply: "I could not process that specific request. Could you please provide clearer parameters?" };
                }

                // Auto resolve account_id from dynamic accounts mapping securely
                if (actionJson.action === "ADD_TRANSACTION" && actionJson.data?.account_name) {
                    const accountName = actionJson.data.account_name.toLowerCase();
                    
                    const { data: accountRecord, error: accErr } = await supabase
                        .from('accounts')
                        .select('id')
                        .eq('user_id', userId)
                        .ilike('name', accountName)
                        .maybeSingle();

                    if (accountRecord && !accErr) {
                        actionJson.data.account_id = accountRecord.id;
                    } else {
                        return { 
                            reply: `I could not locate an account named "${actionJson.data.account_name}". Please verify your account configuration.` 
                        };
                    }
                }

                return { action: actionJson };

            } catch (jsonErr) {
                console.error("Action JSON Parsing Failed:", jsonErr, "Raw output was:", actionReply);
                return { reply: "I encountered an error parsing the action response. Please try again shortly." };
            }
        }

        // ======================================================================
        // FLOW B: TEXT-TO-SQL ANALYTICS ROUTING (WITH SECURE SLICING)
        // ======================================================================
        let sqlQuery = decision.trim();

        // Extra Protection: Stripping trailing semicolon to prevent Supabase RPC 42601 crashing
        if (sqlQuery.endsWith(';')) {
            sqlQuery = sqlQuery.slice(0, -1).trim();
        }

        // Injection Guardrails
        if (!sqlQuery.toUpperCase().includes("SELECT")) {
            return { reply: "Security Alert: Access denied. I can only execute informational queries." };
        }

        if (!sqlQuery.includes(userId)) {
            return { reply: "Security Alert: Multitenancy query isolation breach blocked." };
        }

        let dbResult = [];
        try {
            // Executing the structured query over secure Postgres RPC function
            const { data, error } = await supabase.rpc('execute_raw_sql', { query_text: sqlQuery });
            if (error) throw error;
            dbResult = data || [];
        } catch (dbErr) {
            console.error("Supabase RPC Query Execution Failed:", dbErr, "Query was:", sqlQuery);
            return { reply: "I am unable to retrieve data from the server at the moment. Please try again later." };
        }

        // 🔥 CRITICAL FIXED BLOCK: Force immediate truncation before prompt mapping
        // Maximum top 5 rows hi prompt memory mein jayengi taaki upstream length blast na ho
        const safeDbResult = Array.isArray(dbResult) ? dbResult.slice(0, 5) : [];

        if (isTransactionListQuestion(message)) {
            return { reply: formatTransactionRows(safeDbResult) };
        }

        // Compile raw database tuples into natural English speech layout using heavily sliced data
        const replyPrompt = buildReplyPrompt(message, safeDbResult);
        const finalHumanReply = await askCloudflareAI(replyPrompt, message, safeHistory, env);

        return { reply: finalHumanReply };

    } catch (globalErr) {
        console.error("Global AI Chat Error:", globalErr);
        return { reply: "An internal server error occurred within the AI subsystem." };
    }
}
