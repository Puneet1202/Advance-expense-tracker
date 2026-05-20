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

function extractText(response) {
    if (typeof response === 'string') return response;
    if (typeof response?.response === 'string') return response.response;
    if (typeof response?.result?.response === 'string') return response.result.response;
    if (typeof response?.text === 'string') return response.text;

    const content = response?.choices?.[0]?.message?.content;
    if (typeof content === 'string') return content;

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
        temperature: 0.2,
        max_tokens: 1200
    });

    return extractText(response).trim();
}
