import { getSupabaseClient } from '../db/supabase.js';
import { getEmbeddings } from '../ai/embedding.js';
import AI_CONFIG from '../../ai-config.js';

// FILE: Searches relevant transactions using pgvector
// REPLACES: ai-engine/rag/indexer.js.old (searchRelevantTransactions part)
// CONNECTS TO: db/supabase.js (rpc match_expenses), ai/embedding.js

/**
 * Step 2: Semantic Search — "Meaning" se match karta hai, keyword se nahi
 * Ye function chat.js ke POST route se call hota hai
 */
export async function searchRelevantTransactions(userId, question, env) {
  try {
    const supabase = getSupabaseClient(env);

    // 1. User ke question ka vector banaao
    const queryVector = await getEmbeddings(question, env);

    // 2. Supabase pgvector (match_expenses RPC) se milte-julte expenses maango
    // STEP 6: VECTORIZE REPLACE -> pgvector
    const { data: matches, error } = await supabase.rpc('match_expenses', {
      query_embedding: queryVector,
      match_threshold: AI_CONFIG.vectorConfig.threshold,
      match_count: AI_CONFIG.vectorConfig.topK
    });

    if (error) {
      throw error;
    }

    if (!matches || matches.length === 0) {
      return { 
        relevantIDs: [], 
        searchStats: {
          query: question,
          vectorDimension: queryVector.length,
          totalScannedFromVectorize: 0,
          matchScores: [],
          finalSelectedCount: 0,
          message: "No vectors matched in the database for this threshold."
        } 
      };
    }

    // 3. IDs nikal lo, supabase wale rpc me filtering already done
    const filteredMatches = matches.map(m => m.id);

    // 🌟 FULL TERMINAL INFORMATION LOGGING 🌟
    console.log(`\n================= 🔍 SEARCH INFO =================`);
    console.log(`🗣️  User Query       : "${question}"`);
    console.log(`📏  Vector Dimension : ${queryVector.length} (768 is expected)`);
    console.log(`📊  Total Scanned    : ${matches.length} matches returned from Supabase pgvector`);
    
    // Log each match percentage
    console.log(`🎯  Match Scores     :`);
    matches.forEach((m, idx) => {
      const matchPercent = (m.similarity * 100).toFixed(2);
      console.log(`      [${idx + 1}] ID: ${m.id} | Score: ${matchPercent}% ✅`);
    });

    console.log(`✅  Final Selected   : ${filteredMatches.length} transactions`);
    console.log(`==================================================\n`);

    const searchStats = {
      query: question,
      vectorDimension: queryVector.length,
      totalScannedFromVectorize: matches.length,
      matchScores: matches.map(m => ({
        id: m.id,
        scorePercent: parseFloat((m.similarity * 100).toFixed(2)),
        passedThreshold: true // Since our RPC handles the threshold
      })),
      finalSelectedCount: filteredMatches.length
    };

    return { relevantIDs: filteredMatches, searchStats };

  } catch (error) {
    console.error(`[Vector RAG Search Error]:`, error.message);
    return { relevantIDs: [], searchStats: { error: error.message } };
  }
}
