import { getSupabaseClient } from '../db/supabase.js';
import { getEmbeddings } from '../ai/embedding.js';
import AI_CONFIG from '../../ai-config.js';

// FILE: watcher.js
// KAAM: Background polling watcher to auto-embed missing expenses
// CONNECTS TO: db/supabase.js, ai/embedding.js
// CONFIG: ai-config.js se ENV setting leta hai

let lastCheckTime = new Date(0).toISOString();
let isRunning = false;

// We need a dummy env object or process.env logic for background tasks 
// since Cloudflare's `c.env` isn't globally available if run standalone.
// Assuming this runs in a context where getSupabaseClient can resolve env.
const env = typeof process !== 'undefined' ? process.env : {};

export const startWatcher = () => {
    console.log("[CDC] Watcher started. Polling every 30 seconds...");
    
    setInterval(async () => {
        if (isRunning) return;
        isRunning = true;

        try {
            const supabase = getSupabaseClient(env);
            const currentCheckTime = new Date().toISOString();

            // SELECT * FROM expenses WHERE embedding IS NULL AND created_at > [last check time]
            const { data: newExpenses, error } = await supabase
                .from('expenses')
                .select('*')
                .is('embedding', null)
                .gt('created_at', lastCheckTime);

            if (error) throw error;

            if (newExpenses && newExpenses.length > 0) {
                for (const expense of newExpenses) {
                    const text = `${expense.description || 'Unknown'} ${expense.category || 'General'}`;
                    const embedding = await getEmbeddings(text, env);

                    if (embedding) {
                        const { error: updateError } = await supabase
                            .from('expenses')
                            .update({ embedding })
                            .eq('id', expense.id);

                        if (!updateError) {
                            // Console: "[CDC] New expense found: 'Zomato ₹350' → embedding done ✓"
                            console.log(`[CDC] New expense found: '${expense.description} ₹${expense.amount}' → embedding done ✓`);
                        }
                    }
                }
            }
            
            // Update last check time
            lastCheckTime = currentCheckTime;
            
        } catch (err) {
            console.error("[CDC] Polling error:", err.message);
        } finally {
            isRunning = false;
        }

    }, 30000); // Har 30 second mein
};
