/**
 * local-parser.js  (replaces gemini-parser.js)
 * Backend (Cloudflare Workers) se ai-engine (Node.js localhost:4000) ko file bhejta hai.
 *
 * ai-engine PDF/CSV ko locally parse karta hai — NO AI, NO third party API.
 *
 * Flow:
 *   Backend Worker → multipart POST /api/import (ai-engine) → transactions[]
 */

const AI_ENGINE_URL = 'http://localhost:4000'

/**
 * File object (PDF ya CSV) ko ai-engine ke paas bhejo parsing ke liye.
 * @param {File|Blob} file  - Uploaded file from formData
 * @returns {Promise<Array<{date, description, amount, type, balance}>>}
 */
export async function parseWithLocalEngine(file) {
  // Multipart form data banao — ai-engine field name 'file' expect karta hai
  const body = new FormData()
  body.append('file', file, file.name || 'statement')

  const response = await fetch(`${AI_ENGINE_URL}/api/import`, {
    method: 'POST',
    body
    // Note: Content-Type header mat lagao — browser/fetch khud boundary set karta hai
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`AI Engine parse error ${response.status}: ${errText.substring(0, 300)}`)
  }

  const data = await response.json()

  if (!Array.isArray(data?.transactions)) {
    throw new Error('AI Engine ne valid transactions array nahi diya')
  }

  return data.transactions
}
