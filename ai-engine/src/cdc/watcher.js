// import { getSupabaseClient } from '../db/supabase.js';
// import { getEmbeddings } from '../ai/embedding.js';

// // FILE: watcher.js
// // KAAM: CDC — Naye transactions ki embedding auto-banata hai
// // PROOF: Har run ki poori detail terminal mein print hoti hai

// let lastCheckTime = new Date(0).toISOString();
// let isRunning = false;
// let runCount = 0; // Kitni baar chal chuka hai

// export const startWatcher = (env) => {
//     console.log(`
// ╔══════════════════════════════════════════════╗
// ║  🚀 CDC WATCHER STARTED                     
// ║  Polling every: 30 seconds                  
// ║  Table: transactions (NOT expenses)         
// ║  Started at: ${new Date().toLocaleTimeString()}                
// ╚══════════════════════════════════════════════╝`);

//     setInterval(async () => {
//         if (isRunning) {
//             console.log(`[CDC] ⏭️  Skipping — previous run still in progress`);
//             return;
//         }
//         isRunning = true;
//         runCount++;

//         const runStart = Date.now();
//         const box = '─'.repeat(50);

//         console.log(`\n┌${box}┐`);
//         console.log(`│  🔄 CDC RUN #${runCount} — ${new Date().toLocaleTimeString()}`);
//         console.log(`│  Last check: ${lastCheckTime}`);
//         console.log(`├${box}┤`);

//         try {
//             const supabase = getSupabaseClient(env);
//             const currentCheckTime = new Date().toISOString();

//             // ── Step 1: NULL embedding wali transactions dhundho ──
//             const fetchStart = Date.now();
//             const { data: newTxns, error } = await supabase
//                 .from('transactions')  // ✅ transactions table
//                 .select('id, description, amount, category, type, user_id, created_at')
//                 .is('embedding', null)
//                 .gt('created_at', lastCheckTime)
//                 .order('created_at', { ascending: true });

//             const fetchTime = Date.now() - fetchStart;

//             if (error) throw error;

//             const total = newTxns?.length || 0;

//             console.log(`│  📊 DB SCAN RESULTS`);
//             console.log(`│    Query time    : ${fetchTime}ms`);
//             console.log(`│    Rows scanned  : transactions WHERE embedding IS NULL`);
//             console.log(`│    New found     : ${total} transactions`);
//             console.log(`│    Since         : ${lastCheckTime}`);

//             if (total === 0) {
//                 console.log(`│  ✅ Sab embeddings up-to-date hain!`);
//                 console.log(`└${box}┘`);
//                 lastCheckTime = currentCheckTime;
//                 isRunning = false;
//                 return;
//             }

//             console.log(`├${box}┤`);
//             console.log(`│  🧠 EMBEDDING GENERATION`);

//             let successCount = 0;
//             let failCount = 0;

//             for (const t of newTxns) {
//                 const embedStart = Date.now();
//                 const category = t.category || (t.type === 'income' ? 'Income' : 'General');
//                 const text = `Description: ${t.description || 'Unknown'}, Amount: ${t.amount}, Category: ${category}`;

//                 try {
//                     const embedding = await getEmbeddings(text, env);
//                     const embedTime = Date.now() - embedStart;

//                     if (embedding && Array.isArray(embedding)) {
//                         // DB mein update karo
//                         const updateStart = Date.now();
//                         const { error: updateError } = await supabase
//                             .from('transactions')
//                             .update({ embedding, category })
//                             .eq('id', t.id);
//                         const updateTime = Date.now() - updateStart;

//                         if (!updateError) {
//                             successCount++;
//                             console.log(`│    ✅ [${successCount}/${total}] ID: ${t.id}`);
//                             console.log(`│       Desc     : "${t.description}"`);
//                             console.log(`│       Amount   : ₹${t.amount}`);
//                             console.log(`│       Category : ${category}`);
//                             console.log(`│       Embed    : ${embedTime}ms | DB update: ${updateTime}ms`);
//                             console.log(`│       Vector   : [${embedding.slice(0, 3).map(n => n.toFixed(4)).join(', ')}...] (${embedding.length} dims)`);
//                         } else {
//                             failCount++;
//                             console.log(`│    ❌ [FAIL] ID: ${t.id} — DB update error: ${updateError.message}`);
//                         }
//                     } else {
//                         failCount++;
//                         console.log(`│    ❌ [FAIL] ID: ${t.id} — Invalid embedding returned`);
//                     }
//                 } catch (embedErr) {
//                     failCount++;
//                     console.log(`│    ❌ [FAIL] ID: ${t.id} — ${embedErr.message}`);
//                 }
//             }

//             // ── Summary ──
//             const totalTime = Date.now() - runStart;
//             console.log(`├${box}┤`);
//             console.log(`│  📋 CDC RUN #${runCount} SUMMARY`);
//             console.log(`│    Total found   : ${total}`);
//             console.log(`│    ✅ Success    : ${successCount}`);
//             console.log(`│    ❌ Failed     : ${failCount}`);
//             console.log(`│    ⏱️  Total time : ${totalTime}ms`);
//             console.log(`│    Next run in  : 30 seconds`);
//             console.log(`└${box}┘`);

//             lastCheckTime = currentCheckTime;

//         } catch (err) {
//             console.log(`│  ❌ CDC ERROR: ${err.message}`);
//             console.log(`└${box}┘`);
//         } finally {
//             isRunning = false;
//         }

//     }, 30000); // Har 30 second mein
// };




import { getSupabaseClient } from '../db/supabase.js';
import { getEmbeddings } from '../ai/embedding.js';

// FILE: watcher.js
// KAAM: True CDC — Supabase Realtime (WAL based)
// DB scan nahi hota — sirf changes capture hoti hain

let isSubscribed = false;

export const startWatcher = (env) => {
    if (isSubscribed) return; // Sirf ek baar subscribe karo
    isSubscribed = true;

    const supabase = getSupabaseClient(env);

    console.log(`
╔══════════════════════════════════════════════════╗
║  🚀 CDC WATCHER STARTED (Supabase Realtime)     
║  Mode     : WAL Based — Zero DB scan!           
║  Listening: transactions INSERT/UPDATE           
║  Started  : ${new Date().toLocaleTimeString()}                    
╚══════════════════════════════════════════════════╝`);

    supabase
        .channel('transactions-cdc')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'transactions'
            },
            async (payload) => {
                const t = payload.new;
                const box = '─'.repeat(50);

                console.log(`\n┌${box}┐`);
                console.log(`│  🔔 CDC EVENT — INSERT DETECTED`);
                console.log(`│  ⏰ Time      : ${new Date().toLocaleTimeString()}`);
                console.log(`│  🆔 ID        : ${t.id}`);
                console.log(`│  📝 Desc      : ${t.description}`);
                console.log(`│  💰 Amount    : ₹${t.amount}`);
                console.log(`│  📂 Category  : ${t.category || 'NULL'}`);
                console.log(`│  🗄️  DB Load   : ZERO — WAL se aaya, scan nahi hua`);
                console.log(`├${box}┤`);

                if (t.embedding) {
                    console.log(`│  ✅ Embedding already exists — skip`);
                    console.log(`└${box}┘`);
                    return;
                }

                try {
                    const embedStart = Date.now();
                    const category = t.category || (t.type === 'income' ? 'Income' : 'General');
                    const text = `Description: ${t.description || 'Unknown'}, Amount: ${t.amount}, Category: ${category}`;

                    console.log(`│  🧠 Generating embedding...`);

                    const embedding = await getEmbeddings(text, env);
                    const embedTime = Date.now() - embedStart;

                    if (embedding && Array.isArray(embedding)) {
                        const updateStart = Date.now();
                        const { error } = await supabase
                            .from('transactions')
                            .update({ embedding, category })
                            .eq('id', t.id);
                        const updateTime = Date.now() - updateStart;

                        if (!error) {
                            console.log(`│  ✅ EMBEDDING DONE!`);
                            console.log(`│    Embed time  : ${embedTime}ms`);
                            console.log(`│    DB update   : ${updateTime}ms`);
                            console.log(`│    Vector dims : ${embedding.length}`);
                            console.log(`│    Sample      : [${embedding.slice(0, 3).map(n => n.toFixed(4)).join(', ')}...]`);
                        } else {
                            console.log(`│  ❌ DB Update failed: ${error.message}`);
                        }
                    } else {
                        console.log(`│  ❌ Invalid embedding returned`);
                    }
                } catch (err) {
                    console.log(`│  ❌ Error: ${err.message}`);
                }

                console.log(`└${box}┘\n`);
            }
        )
        .on(
            'postgres_changes',
            {
                event: 'DELETE',
                schema: 'public',
                table: 'transactions'
            },
            (payload) => {
                console.log(`\n[CDC] 🗑️  DELETE — ID: ${payload.old?.id} | "${payload.old?.description}"`);
            }
        )
        .subscribe((status) => {
            console.log(`\n[CDC] Status: ${status}`);
            if (status === 'SUBSCRIBED') {
                console.log(`[CDC] ✅ Realtime LIVE — Waiting for changes...`);
            } else if (status === 'CHANNEL_ERROR') {
                console.log(`[CDC] ❌ Channel error!`);
            }
        });
};