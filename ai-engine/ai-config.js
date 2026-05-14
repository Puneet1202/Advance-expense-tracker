// FILE: ai-config.js
// KAAM: Environment based AI provider and model configuration
// CONNECTS TO: AI Providers (cloudflare.js, ollama.js)
// CONFIG: Single source of truth for all AI settings

const ENV = "production" // "local" | "production"
// SIRF YAHAN CHANGE KARO — baaki sab 
// automatically is hisaab se chalega

const baseConfig = {
  local: {
    EMBEDDING_PROVIDER: "ollama",
    CHAT_PROVIDER: "ollama",
    OLLAMA_URL: "http://localhost:11434",
    MODEL: {
      embedding: "nomic-embed-text",
      chat: "llama3"
    }
  },
  production: {
    EMBEDDING_PROVIDER: "cloudflare",
    CHAT_PROVIDER: "cloudflare",
    CF_MODEL: {
      embedding: "@cf/baai/bge-base-en-v1.5",
      chat: "@cf/meta/llama-3-8b-instruct"
    }
  }
}

// Keep the required configs for other files
const sharedConfig = {
  vectorConfig: {
      dimensions: 768,      
      metric: 'cosine',     
      topK: 5,              
      threshold: 0.70       
  },
  prompts: {
      expenseTracker: "You are an expert financial assistant. Use the provided transaction data to answer user queries accurately.",
      historyLimit: 6
  }
};

const config = {
  ...baseConfig[ENV],
  ...sharedConfig
};

export default config;
