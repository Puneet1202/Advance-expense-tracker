


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
      chat: "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
      
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

};

const config = {
  ...baseConfig[ENV],
  ...sharedConfig
};

export default config;
