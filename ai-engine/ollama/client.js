const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b'

export const askOllama = async (prompt) => {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [{ role: 'user', content: prompt }],
      stream: false
    }),
    signal: AbortSignal.timeout(300000)
  })

  const data = await response.json()
  
  // Debug ke liye
  console.log('Ollama response:', JSON.stringify(data))
  
  if (!data?.message?.content) {
    throw new Error('Ollama ne response nahi diya: ' + JSON.stringify(data))
  }

  return data.message.content
}