import AI_CONFIG from '../../../ai-config.js';

// FILE: ollama.js
// KAAM: Local Ollama API calls for chat and embeddings
// CONNECTS TO: Local Ollama Instance
// CONFIG: ai-config.js se ENV setting leta hai

export const askLocalAI = async (systemPrompt, userQuestion, history = []) => {
    const response = await fetch(`${AI_CONFIG.OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: AI_CONFIG.MODEL.chat,
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
};

export const getLocalEmbeddings = async (text) => {
    const response = await fetch(`${AI_CONFIG.OLLAMA_URL}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: AI_CONFIG.MODEL.embedding,
            prompt: text
        })
    });
    const data = await response.json();
    return data.embedding; 
};
