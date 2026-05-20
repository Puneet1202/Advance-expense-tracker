import { askCloudflareAI } from '../providers/claudflare.js'; 
import { buildSQLPrompt, buildReplyPrompt, buildActionPrompt } from './prompts.js';

/**
 * Smart AI Chat Controller with Text-to-SQL & Action Routing for Supabase
 */
export async function aiChat(env, supabase, userId, message, history = [], dynamicSchema) {
    try {
        // STEP 1: AI se decision lo (SQL query ya Action)
        const sqlPrompt = buildSQLPrompt(message, dynamicSchema, userId);
        const firstReply = await askCloudflareAI(sqlPrompt, message, history, env);

        const decision = firstReply.trim();

        // ==========================================
        // FLOW A: AGAR AI NE "ACTION" DETECT KIYA
        // ==========================================
        if (decision === "ACTION") {
            const actionPrompt = buildActionPrompt(message, userId);
            const actionReply = await askCloudflareAI(actionPrompt, message, [], env);

            try {
                const actionJson = JSON.parse(actionReply);

                // Account Name se Id nikaalne ka logic
                if (actionJson.action === "ADD_TRANSACTION" && actionJson.data?.account_name) {
                    const accountName = actionJson.data.account_name.toLowerCase();
                    
                    // Live Supabase lookup with maybeSingle() to get object instead of array
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
                            reply: `Bhai, mujhe tumhara "${actionJson.data.account_name}" naam ka account nahi mila. Kripya sahi account specify karo.` 
                        };
                    }
                }

                return { action: actionJson };

            } catch (jsonErr) {
                console.error("Action JSON Parsing Failed:", jsonErr, "Raw output was:", actionReply);
                return { reply: "Mafi chahta hoon, action process karne mein thoda confusion ho gaya. Kripya dubara try karein." };
            }
        }

        // ==========================================
        // FLOW B: AGAR AI NE "SQL SELECT" QUERY DIYA
        // ==========================================
        const sqlQuery = decision;

        // Security Guardrail 1: Strictly SELECT check
        if (!sqlQuery.toUpperCase().includes("SELECT")) {
            return { reply: "Security Alert: Main sirf data dekhne ki queries chala sakta hoon." };
        }

        // Security Guardrail 2: Multi-tenant safety
        if (!sqlQuery.includes(userId)) {
            return { reply: "Security Alert: Unauthorized data access block kiya gaya." };
        }

        // Execute raw SQL on Supabase
        let dbResult;
        try {
            const { data, error } = await supabase.rpc('execute_raw_sql', { query_text: sqlQuery });
            if (error) throw error;
            dbResult = data || [];
        } catch (dbErr) {
            console.error("Supabase RPC Query Execution Failed:", dbErr, "Query was:", sqlQuery);
            return { reply: "Database se data nikalne mein thodi dikkat aa rahi hai. Kripya thodi der baad poochhein." };
        }

        // STEP 3: DB Result se final readable answer banwao
        const replyPrompt = buildReplyPrompt(message, dbResult);
        const finalHumanReply = await askCloudflareAI(replyPrompt, message, history, env);

        return { reply: finalHumanReply };

    } catch (globalErr) {
        console.error("Global AI Chat Error:", globalErr);
        return { reply: "Something went wrong! Server pe koi internal issue aaya hai." };
    }
}