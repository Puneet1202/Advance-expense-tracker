import { getEmbeddings } from '../ollama/client.js';
import { AI_CONFIG } from '../../ai-config.js';

/**
 * Step 1: Transactions ko Vectorize DB mein sync karna
 * Ye function admin.js ke sync-all route se call hota hai
 */
export async function syncTransactionsToVectorDB(userId, transactions, env) {
  try {
    if (!transactions || transactions.length === 0) return true;

    console.log(`[Vector RAG] Syncing ${transactions.length} transactions for user ${userId}...`);
    const vectors = [];

    for (const t of transactions) {
      const textToEmbed = `Description: ${t.description}, Amount: ${t.amount}, Type: ${t.type}, Category: ${t.category || 'General'}`;
      const embedding = await getEmbeddings(textToEmbed, env);

      vectors.push({
        id: t.id.toString(),
        values: embedding,
        namespace: userId.toString(), // ✅ Har user ka data alag
        metadata: {
          description: t.description,
          amount: t.amount,
          type: t.type
        }
      });
    }

    await env.VECTOR_DB.upsert(vectors);
    console.log(`[Vector RAG] Successfully synced ${vectors.length} vectors to Cloudflare.`);
    return true;
  } catch (error) {
    console.error(`[Vector RAG Sync Error]:`, error.message);
    return false;
  }
}

/**
 * Step 2: Semantic Search — "Meaning" se match karta hai, keyword se nahi
 * Ye function chat.js ke POST route se call hota hai
 */
export async function searchRelevantTransactions(userId, question, env) {
  try {
    // 1. User ke question ka vector banaao
    const queryVector = await getEmbeddings(question, env);

    // 2. Vectorize se top 5 milte-julte transactions ke IDs maango
    const matches = await env.VECTOR_DB.query(queryVector, {
      topK: AI_CONFIG.vectorConfig.topK,       // 5
      namespace: userId.toString(),             // Sirf is user ka data
      returnMetadata: true
    });

    if (!matches || matches.matches.length === 0) {
      return { 
        relevantIDs: [], 
        searchStats: {
          query: question,
          vectorDimension: queryVector.length,
          totalScannedFromVectorize: 0,
          matchScores: [],
          finalSelectedCount: 0,
          message: "No vectors matched in the database for this namespace."
        } 
      };
    }

    // 3. Sirf 75%+ match wale results lo
    const filteredMatches = matches.matches
      .filter(m => m.score >= AI_CONFIG.vectorConfig.threshold)
      .map(m => m.id);

    // 🌟 FULL TERMINAL INFORMATION LOGGING 🌟
    console.log(`\n================= 🔍 SEARCH INFO =================`);
    console.log(`🗣️  User Query       : "${question}"`);
    console.log(`📏  Vector Dimension : ${queryVector.length} (768 is expected for BGE/Nomic)`);
    console.log(`📊  Total Scanned    : ${matches.matches.length} matches returned from Vectorize`);
    
    // Log each match percentage
    console.log(`🎯  Match Scores     :`);
    matches.matches.forEach((m, idx) => {
      const matchPercent = (m.score * 100).toFixed(2);
      const passed = m.score >= AI_CONFIG.vectorConfig.threshold ? '✅' : '❌';
      console.log(`      [${idx + 1}] ID: ${m.id} | Score: ${matchPercent}% ${passed}`);
    });

    console.log(`✅  Final Selected   : ${filteredMatches.length} transactions passed the ${AI_CONFIG.vectorConfig.threshold * 100}% threshold`);
    console.log(`==================================================\n`);

    const searchStats = {
      query: question,
      vectorDimension: queryVector.length,
      totalScannedFromVectorize: matches.matches.length,
      matchScores: matches.matches.map(m => ({
        id: m.id,
        scorePercent: parseFloat((m.score * 100).toFixed(2)),
        passedThreshold: m.score >= AI_CONFIG.vectorConfig.threshold
      })),
      finalSelectedCount: filteredMatches.length
    };

    return { relevantIDs: filteredMatches, searchStats };

  } catch (error) {
    console.error(`[Vector RAG Search Error]:`, error.message);
    return { relevantIDs: [], searchStats: { error: error.message } };
  }
}