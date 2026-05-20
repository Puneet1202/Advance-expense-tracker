const CHAT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

function normalizeMessages(messages = []) {
    const validMessages = [];

    for (const item of messages) {
        if (!item || typeof item.content !== 'string' || !item.content.trim()) continue;

        const role = item.role === 'system' || item.role === 'assistant' ? item.role : 'user';
        const content = item.content.trim();
        const previous = validMessages[validMessages.length - 1];

        if (previous?.role === role && role !== 'system') {
            previous.content += `\n${content}`;
        } else {
            validMessages.push({ role, content });
        }
    }

    return validMessages;
}

/**
 * Ultimate Robust text extractor matching any shape of Cloudflare Workers AI responses
 */
function extractText(response) {
    if (!response) throw new Error('Cloudflare AI returned an empty response object');

    // Case 1: Llama 3.3 Standard OpenAI-style block structure inside 'result'
    if (response?.result?.choices?.[0]?.message?.content) {
        return response.result.choices[0].message.content;
    }

    // Case 2: Direct choices layout
    if (response?.choices?.[0]?.message?.content) {
        return response.choices[0].message.content;
    }

    // Case 3: Agar direct 'response' key ke andar ek nested OBJECT aa jaye
    if (response?.response && typeof response.response === 'object') {
        return JSON.stringify(response.response);
    }

    // Case 4: Standard worker text generation strings
    if (typeof response?.result?.response === 'string') return response.result.response;
    if (typeof response?.response === 'string') return response.response;
    if (typeof response === 'string') return response;

    // Output debug logs to terminal if everything fails
    console.error('[Cloudflare Payload Error Check] Unexpected payload structure:', JSON.stringify(response));
    throw new Error('Cloudflare AI response did not include text');
}

/**
 * 🔥 MAIN EXPORTED FUNCTION — This fixes the Wrangler warning!
 */
export async function askCloudflareAI(systemPrompt, message, history = [], env) {
    if (!env?.AI?.run) {
        throw new Error('Cloudflare AI binding is missing');
    }

    const messages = normalizeMessages([
        { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
        ...history,
        { role: 'user', content: message || 'Hello' }
    ]);

    const response = await env.AI.run(CHAT_MODEL, {
        messages,
        temperature: 0.1, // Safe & strict for Text-to-SQL execution
        max_tokens: 400
    });

    return extractText(response).trim();
}