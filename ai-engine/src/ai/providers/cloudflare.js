import AI_CONFIG from '../../../ai-config.js';

// FILE: cloudflare.js
// KAAM: CF Workers AI API calls for chat and embeddings
// CONNECTS TO: Cloudflare Workers AI
// CONFIG: ai-config.js se ENV setting leta hai

export const askCloudflareAI = async (systemPrompt, userQuestion, history = [], env = {}) => {
    if (!env.AI) {
        throw new Error("Cloudflare AI binding missing!");
    }
    const rawMessages = [
        { role: 'system', content: systemPrompt || "You are a helpful assistant." },
        ...history,
        { role: 'user', content: userQuestion || "Hello" }
    ];

    // Cloudflare AI strict validation: no empty content, no consecutive same roles
    const validMessages = [];
    for (const msg of rawMessages) {
        if (!msg.content || msg.content.trim() === '') continue;
        // Don't add if previous role is the same (except system at start)
        if (validMessages.length > 0 && validMessages[validMessages.length - 1].role === msg.role) {
            validMessages[validMessages.length - 1].content += `\n${msg.content}`;
        } else {
            validMessages.push(msg);
        }
    }

    const response = await env.AI.run(AI_CONFIG.CF_MODEL.chat, {
        messages: validMessages,
        max_tokens: 2048
    });

    const answer = extractChatText(response);
    if (!answer || answer.length < 2) {
      return "Mujhe yeh samajh nahi aaya. Kripya dobara poochho.";
    }
    return answer;
};

/** CF models may return string, { response: string }, or nested objects (tools/json). */
function extractChatText(response) {
    if (response == null) return '';
    if (typeof response === 'string') return response.trim();

    const candidates = [
        response.response,
        response.result,
        response.text,
        response.output,
        response.choices?.[0]?.message?.content,
    ];

    for (const c of candidates) {
        if (typeof c === 'string' && c.trim()) return c.trim();
        if (c && typeof c === 'object') {
            if (typeof c.response === 'string' && c.response.trim()) return c.response.trim();
            if (typeof c.content === 'string' && c.content.trim()) return c.content.trim();
            if (typeof c.text === 'string' && c.text.trim()) return c.text.trim();
        }
    }

    if (typeof response.response === 'object' && response.response !== null) {
        try {
            return JSON.stringify(response.response);
        } catch {
            /* fall through */
        }
    }

    return '';
}

export const getCloudflareEmbeddings = async (text, env = {}) => {
    if (!env.AI) {
        throw new Error("Cloudflare AI binding missing!");
    }
    const response = await env.AI.run(AI_CONFIG.CF_MODEL.embedding, {
        text: [text]
    });
    return response.data[0]; 
};
