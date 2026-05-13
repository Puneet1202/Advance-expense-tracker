import AI_CONFIG from '../../ai-config.js';
import { getLocalEmbeddings } from './providers/ollama.js';
import { getCloudflareEmbeddings } from './providers/cloudflare.js';

// FILE: embedding.js
// KAAM: Selects embedding provider based on config and generates embeddings
// CONNECTS TO: ai/providers/cloudflare.js or ai/providers/ollama.js
// CONFIG: ai-config.js se ENV setting leta hai

export const getEmbeddings = async (text, env = {}) => {
    const provider = AI_CONFIG.EMBEDDING_PROVIDER;

    if (provider === 'ollama') {
        console.log("Using Local Nomic-Embed for Vectors...");
        return await getLocalEmbeddings(text);
    } else if (provider === 'cloudflare') {
        console.log("Using Cloudflare BGE for Vectors...");
        return await getCloudflareEmbeddings(text, env);
    } else {
        throw new Error("Invalid EMBEDDING_PROVIDER in ai-config.js");
    }
};
