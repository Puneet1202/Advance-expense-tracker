import { syncTransactionsToVectorDB } from './embed.js';
import { searchRelevantTransactions } from './search.js';

// FILE: Exports vector embed and search modules
// REPLACES: ai-engine/rag/indexer.js.old (exports)
// CONNECTS TO: vector/embed.js, vector/search.js

export {
  syncTransactionsToVectorDB,
  searchRelevantTransactions
};
