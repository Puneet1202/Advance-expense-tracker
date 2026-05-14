// FILE: ai-config.js
// KAAM: Environment based AI provider and model configuration
// CONNECTS TO: AI Providers (cloudflare.js, ollama.js)
// CONFIG: Single source of truth for all AI settings

import { COMPOSED_EXPENSE_TRACKER_PROMPT, SYSTEM_PROMPTS, INTENT_PROMPTS, VALIDATION_PROMPTS, RESPONSE_PROMPTS } from './prompts/index.js';

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
      expenseTracker: COMPOSED_EXPENSE_TRACKER_PROMPT,
      templates: {
          system: SYSTEM_PROMPTS,
          intents: INTENT_PROMPTS,
          validation: VALIDATION_PROMPTS,
          responses: RESPONSE_PROMPTS
      },
      historyLimit: 6
  }
};

const config = {
  ...baseConfig[ENV],
  ...sharedConfig
};

export default config;
