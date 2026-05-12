// const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
// const OLLAMA_MODEL = 'llama3'

// /**
//  * Specialized Ollama Client for Expense Tracker
//  * @param {string} systemPrompt - Strict specialized assistant prompt with pre-calculated numbers and RAG data
//  * @param {string} userQuestion - The user's specific finance query
//  * @param {Array} history - Previous conversation context (optional, appended if available)
//  */
// export const askOllama = async (systemPrompt, userQuestion, history = []) => {
//   // Construct messages array exactly as required: system first, then user.
//   // History is injected between system and user if available.
//   const messages = [
//     { role: 'system', content: systemPrompt },
//     ...history.slice(-6).map(h => ({
//       role: h.role === 'user' ? 'user' : 'assistant',
//       content: h.content
//     })),
//     { role: 'user', content: userQuestion }
//   ];

//   try {
//     const response = await fetch(`${OLLAMA_URL}/api/chat`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         model: OLLAMA_MODEL,
//         messages,
//         stream: false,
//         options: {
//           temperature: 0.1
//         }
//       }),
//       signal: AbortSignal.timeout(300000) // 300,000ms timeout
//     });

//     if (!response.ok) {
//       const errText = await response.text();
//       throw new Error(`Ollama HTTP Error ${response.status}: ${errText}`);
//     }

//     const data = await response.json();

//     if (!data?.message?.content) {
//       throw new Error('Invalid empty response from Ollama model.');
//     }

//     return data.message.content.trim();
//   } catch (error) {
//     console.error('[Ollama Client Error]:', error.message);
//     throw new Error(`Failed to communicate with local AI: ${error.message}`);
//   }
// }
















// 1. Environment se settings uthana
import { AI_CONFIG } from '../../ai-config.js'; // Root se import

/**
 * LOGIC 1: CHAT AI (Llama 3 vs Cloudflare Llama)
 * Iska kaam hai user se baatein karna aur report samjhana.
 */
export const askAI = async (systemPrompt, userQuestion, history = [], env = {}) => {
    
    // Switch Check
    if (AI_CONFIG.provider === 'local') {
        // --- YE HAI LOCAL CHAT AI (Ollama - Llama3) ---
        console.log("Using Local Llama3 for Chat...");
        const response = await fetch(`${AI_CONFIG.ollama.url}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3', // <--- Chat Model
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...history,
                    { role: 'user', content: userQuestion }
                ],
                stream: false
            })
        });
        const data = await response.json();
        return data.message.content;

    } else {
        // --- YE HAI CLOUD CHAT AI (Cloudflare - Llama3-8b) ---
        console.log("Using Cloudflare Workers AI for Chat...");
        const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
            messages: [
                { role: 'system', content: systemPrompt },
                ...history,
                { role: 'user', content: userQuestion }
            ]
        });
        return response.response;
    }
};

/**
 * LOGIC 2: EMBEDDING AI (Nomic-Embed vs Cloudflare BGE)
 * Iska kaam hai text ko 768-dim numbers mein badalna.
 */
export const getEmbeddings = async (text, env = {}) => {

    // Switch Check
    if (AI_CONFIG.provider === 'local') {
        // --- YE HAI LOCAL EMBEDDING AI (Ollama - Nomic-Embed-Text) ---
        console.log("Using Local Nomic-Embed for Vectors...");
        const response = await fetch(`${AI_CONFIG.ollama.url}/api/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'nomic-embed-text', // <--- Embedding Model (768 Dim)
                prompt: text
            })
        });
        const data = await response.json();
        return data.embedding; // Returns [0.12, -0.45, ...] (768 numbers)

    } else {
        // --- YE HAI CLOUD EMBEDDING AI (Cloudflare - BGE-Base) ---
        console.log("Using Cloudflare BGE for Vectors...");
        const response = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
            text: [text]
        });
        return response.data[0]; // Returns [0.88, 0.11, ...] (768 numbers)
    }
};