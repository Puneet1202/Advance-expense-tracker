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

    for (const t of transactions) {
      const textToEmbed = `Description: ${t.description}, Amount: ${t.amount}, Category: ${t.category || 'General'}`;
      const embedding = await getEmbeddings(textToEmbed, env);

      // STEP 6: VECTORIZE REPLACE
      // We assume the transaction might already exist or needs to be inserted
      // Since it's a sync function, we can do an upsert based on the ID.
      const { error } = await supabase
        .from('expenses')
        .upsert({
          id: t.id.toString(), // assuming id is UUID compatible, otherwise we might need to handle it
          amount: t.amount,
          category: t.category,
          description: t.description,
          date: t.date || new Date().toISOString().split('T')[0],
          embedding: embedding,
          metadata: { userId: userId.toString() }
        });

      if (error) {
        console.error(`[Vector RAG] Failed to sync transaction ${t.id}:`, error.message);
      } else {
        successCount++;
      }
    }

    console.log(`[Vector RAG] Successfully synced ${successCount} vectors to Supabase.`);
    return true;
  } catch (error) {
    console.error(`[Vector RAG Sync Error]:`, error.message);
    return false;
  }
}
