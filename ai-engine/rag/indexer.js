/**
 * indexer.js
 * 100% Local In-Memory "RAG" Search.
 * NO Docker, NO ChromaDB server required. Runs pure JavaScript keyword matching.
 */

export async function syncTransactionsToChroma(userId, transactions) {
  // No longer needs to sync to an external vector DB.
  // We do this entirely in-memory now to avoid Docker/ChromaDB connection errors!
  console.log(`[Local RAG] Received ${transactions.length} transactions for user ${userId} in-memory.`);
  return true;
}

/**
 * Searches the transactions array in-memory based on the user's question.
 */
export async function searchRelevantTransactions(userId, question, transactions = [], k = 10) {
  if (!transactions || transactions.length === 0) return [];

  try {
    const tokens = question.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(t => t.length > 2);
    
    // If no meaningful keywords, return the most recent 10 transactions
    if (tokens.length === 0) {
      return transactions.slice(0, k).map(t => 
        `Date: ${(t.created_at||'').substring(0, 10)} | Type: ${t.type} | Amount: ₹${t.amount} | Desc: ${t.description} | Acc: ${t.account_name || 'N/A'}`
      );
    }

    // Score transactions
    const scored = transactions.map(t => {
      let score = 0;
      const desc = (t.description || '').toLowerCase();
      const type = (t.type || '').toLowerCase();
      const acc = (t.account_name || '').toLowerCase();
      
      tokens.forEach(token => {
        if (desc.includes(token)) score += 5; // High weight for description match
        if (acc.includes(token)) score += 3;  // Medium weight for account match
        if (type.includes(token)) score += 2; // Low weight for type match
      });

      return { transaction: t, score };
    });

    // Sort by score descending, then by newest date
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.transaction.created_at || 0) - new Date(a.transaction.created_at || 0);
    });

    // Take top K that have at least some match, otherwise fallback to recent
    let topK = scored.filter(s => s.score > 0).slice(0, k);
    
    if (topK.length === 0) {
      topK = scored.slice(0, 5); // Fallback to 5 most recent if no keywords matched
    }

    return topK.map(s => {
      const t = s.transaction;
      return `Date: ${(t.created_at||'').substring(0, 10)} | Type: ${t.type} | Amount: ₹${t.amount} | Desc: ${t.description} | Acc: ${t.account_name || 'N/A'}`;
    });

  } catch (error) {
    console.error(`[Local RAG Error] Failed to search transactions:`, error.message);
    return [];
  }
}
