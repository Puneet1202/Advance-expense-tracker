import { askCloudflareAI } from './providers/cloudflare.js';
import { buildPrompt } from './prompts.js';

export async function aiChat(env, transactions, accounts, message, history = []) {
    const systemPrompt = buildPrompt(transactions, accounts);
    const reply = await askCloudflareAI(systemPrompt, message, history, env);

    // Action check — agar AI ne JSON diya
    try {
        const json = JSON.parse(reply);
        if (json.action) return { action: json };
    } catch {
        // Plain text reply — normal answer
    }

    return { reply };
}