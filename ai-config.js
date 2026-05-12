// Root/ai-config.js

export const AI_CONFIG = {
    // 0. Provider Switch: 'local' = Ollama, 'cloudflare' = Workers AI
    provider: 'cloudflare', // Remote deploy ke liye 'cloudflare' rakho

    // Ollama local URL (local mode mein kaam aata hai)
    ollama: {
        url: 'http://localhost:11434'
    },

    // 1. Vector Search Settings (Sir ki requirement: Fast & Accurate)
    vectorConfig: {
        dimensions: 768,      // Nomic aur BGE dono 768 dete hain
        metric: 'cosine',     // AI similarity ke liye best
        topK: 5,              // Kitne milte-julte results D1 se fetch karne hain
        threshold: 0.75       // 75% se kam match hua toh ignore (Score 0 to 1)
    },

    // 2. Models Mapping (Hybrid Logic)
    models: {
        local: {
            chat: 'llama3',
            embedding: 'nomic-embed-text'
        },
        cloudflare: {
            chat: '@cf/meta/llama-3-8b-instruct',
            embedding: '@cf/baai/bge-base-en-v1.5'
        }
    },

    // 3. System Prompts (Hardcoding hatane ke liye)
    prompts: {
        expenseTracker: "You are an expert financial assistant. Use the provided transaction data to answer user queries accurately.",
        hospitalAgent: "You are a medical data assistant. Analyze patient records and provide insights based on clinical data.",
        historyLimit: 6
    }
};