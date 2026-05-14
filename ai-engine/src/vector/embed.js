import { getEmbeddings } from '../ai/embedding.js';
import { getSupabaseClient } from '../db/supabase.js';

// FILE: Converts text to vector
// REPLACES: ai-engine/rag/indexer.js.old (syncTransactionsToVectorDB part)
// CONNECTS TO: ai/embedding.js, db/supabase.js

/**
 * Step 1: Transactions ko pgvector DB (Supabase) mein sync karna
 */
export async function syncTransactionsToVectorDB(userId, transactions, env) {
  try {
    if (!transactions || transactions.length === 0) return true;

    console.log(`[Vector RAG] Syncing ${transactions.length} transactions for user ${userId}...`);
    
    const supabase = getSupabaseClient(env);
    let successCount = 0;
    let failCount = 0;

    for (const t of transactions) {
      // ✅ Category ka default 'General' — null kabhi nahi jayega
      const category = t.category || 'General';

      // ✅ Embedding ke liye text banana
      const textToEmbed = `Description: ${t.description}, Amount: ${t.amount}, Category: ${category}`;
      
      const embedding = await getEmbeddings(textToEmbed, env);

      if (!embedding) {
        console.error(`[Vector RAG] Embedding generate nahi hui for transaction ${t.id}`);
        failCount++;
        continue;
      }

      // ✅ FIXED: upsert nahi, sirf update — sirf embedding aur category set karo
      // ✅ FIXED: id directly number (bigint) — toString() nahi
      // ✅ FIXED: date aur metadata column transactions table mein nahi hain — remove kiya
      const { error } = await supabase
        .from('transactions')
        .update({
          embedding: embedding,  // ✅ vector save hoga
          category: category,    // ✅ null nahi ayegi
        })
        .eq('id', t.id)          // ✅ bigint id directly
        .eq('user_id', userId);  // ✅ extra safety — sirf apna data update ho

      if (error) {
        console.error(`[Vector RAG] Failed to sync transaction ${t.id}:`, error.message);
        failCount++;
      } else {
        successCount++;
        console.log(`[Vector RAG] Transaction ${t.id} synced ✅`);
      }
    }

    console.log(`[Vector RAG] Done! Success: ${successCount}, Failed: ${failCount}`);
    return failCount === 0;

  } catch (error) {
    console.error(`[Vector RAG Sync Error]:`, error.message);
    return false;
  }
}