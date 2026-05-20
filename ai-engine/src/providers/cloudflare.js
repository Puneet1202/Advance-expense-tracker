const CHAT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const MAX_MESSAGE_CHARS = 4000;
const MAX_TOTAL_CHARS = 52000;

/**
 * Robust Message Normalization Layer - Fixed Syntax & Scope leaks
 */
export function normalizeMessages(messages = []) {
    const validMessages = [];
    let totalChars = 0;

    for (const item of messages) {
        if (!item || typeof item.content !== 'string' || !item.content.trim()) continue;

        const role = item.role === 'system' || item.role === 'assistant' ? item.role : 'user';
        
        // FIXED: Single declaration, variable can be updated dynamically
        let content = item.content.trim(); 

        // Message level truncation guardrail
        if (content.length > MAX_MESSAGE_CHARS) {
            content = `${content.slice(0, MAX_MESSAGE_CHARS)}\n[Message truncated to stay within AI context limits]`;
        }

        // Global context limit budget check
        if (totalChars + content.length > MAX_TOTAL_CHARS) {
            const remainingChars = MAX_TOTAL_CHARS - totalChars;
            if (remainingChars <= 200) break;
            content = `${content.slice(0, remainingChars)}\n[Context truncated to stay within AI context limits]`;
        }

        const previous = validMessages[validMessages.length - 1];

        // Merge consecutive messages with the same role to streamline LLM readability
        if (previous?.role === role && role !== 'system') {
            previous.content += `\n${content}`;
        } else {
            validMessages.push({ role, content });
        }

        totalChars += content.length;
    }

    return validMessages;
}

function extractText(response) {
    if (!response) throw new Error('Cloudflare AI returned an empty response object');

    if (response?.result?.choices?.[0]?.message?.content) {
        return response.result.choices[0].message.content;
    }

    if (response?.choices?.[0]?.message?.content) {
        return response.choices[0].message.content;
    }

    if (typeof response?.result?.response === 'string') return response.result.response;
    if (typeof response?.response === 'string') return response.response;
    if (typeof response === 'string') return response;

    if (response?.response && typeof response.response === 'object') {
        return JSON.stringify(response.response);
    }

    throw new Error('Cloudflare AI response did not include text');
}

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
        temperature: 0.1,
        max_tokens: 400
    });

    return extractText(response).trim();
}
