const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
const OLLAMA_MODEL = 'llama3'

/**
 * Specialized Ollama Client for Expense Tracker
 * @param {string} systemPrompt - Strict specialized assistant prompt with pre-calculated numbers and RAG data
 * @param {string} userQuestion - The user's specific finance query
 * @param {Array} history - Previous conversation context (optional, appended if available)
 */
export const askOllama = async (systemPrompt, userQuestion, history = []) => {
  // Construct messages array exactly as required: system first, then user.
  // History is injected between system and user if available.
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6).map(h => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.content
    })),
    { role: 'user', content: userQuestion }
  ];

  try {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
        options: {
          temperature: 0.1
        }
      }),
      signal: AbortSignal.timeout(300000) // 300,000ms timeout
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama HTTP Error ${response.status}: ${errText}`);
    }

    const data = await response.json();

    if (!data?.message?.content) {
      throw new Error('Invalid empty response from Ollama model.');
    }

    return data.message.content.trim();
  } catch (error) {
    console.error('[Ollama Client Error]:', error.message);
    throw new Error(`Failed to communicate with local AI: ${error.message}`);
  }
}