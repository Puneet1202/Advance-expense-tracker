import AI_CONFIG from '../../ai-config.js';
import { askLocalAI } from './providers/ollama.js';
import { askCloudflareAI } from './providers/cloudflare.js';

// FILE: chat.js
// KAAM: Selects chat provider based on config and generates chat responses
// CONNECTS TO: ai/providers/cloudflare.js or ai/providers/ollama.js
// CONFIG: ai-config.js se ENV setting leta hai

export const getChatResponse = async (systemPrompt, userQuestion, history = [], env = {}) => {
    const provider = AI_CONFIG.CHAT_PROVIDER;
    
    if (provider === 'ollama') {
        console.log("Using Local Ollama for Chat...");
        return await askLocalAI(systemPrompt, userQuestion, history);
    } else if (provider === 'cloudflare') {
        console.log("Using Cloudflare Workers AI for Chat...");
        return await askCloudflareAI(systemPrompt, userQuestion, history, env);
    } else {
        throw new Error("Invalid CHAT_PROVIDER in ai-config.js");
    }
};
