/**
 * gemini-parser.js
 * Yeh file Google Gemini Flash API ko call karti hai aur
 * bank statement ke text se transactions extract karti hai.
 * Input: raw text (CSV ya PDF ka content)
 * Output: parsed transactions array ya error
 */

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const SYSTEM_PROMPT = `Yeh ek Indian bank statement hai. 
Saari transactions extract karo aur exactly is JSON format mein do:
[
  {
    "date": "DD-MM-YYYY",
    "description": "transaction description",
    "amount": number,
    "type": "debit" ya "credit",
    "category": "Food/Shopping/Fuel/Bills/Salary/Transfer/Other",
    "balance": number ya null
  }
]
Sirf JSON array do, koi explanation mat do, koi markdown code block mat do.`;

/**
 * Gemini Flash API call karke transactions parse karta hai
 * @param {string} statementText - Bank statement ka raw text content
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<Array>} - Parsed transactions array
 */
export async function parseWithGemini(statementText, apiKey) {
  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: SYSTEM_PROMPT + '\n\nBank Statement:\n' + statementText,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,      // Low temp = deterministic JSON output
      maxOutputTokens: 8192,
    },
  };

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();

  // Gemini response se text nikalna
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Gemini ne koi response nahi diya');
  }

  // JSON clean karna — kabhi kabhi Gemini markdown wrap kar deta hai
  const cleaned = rawText
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/gi, '')
    .trim();

  let transactions;
  try {
    transactions = JSON.parse(cleaned);
  } catch (e) {
    throw new Error('Gemini ka response valid JSON nahi tha: ' + cleaned.substring(0, 200));
  }

  if (!Array.isArray(transactions)) {
    throw new Error('Gemini ne array nahi diya');
  }

  return transactions;
}

/**
 * PDF ke liye Gemini call — base64 inline data bhejta hai
 * @param {string} base64 - PDF ka base64 encoded string
 * @param {string} mimeType - 'application/pdf'
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<Array>} - Parsed transactions array
 */
export async function parseWithGeminiPdf(base64, mimeType, apiKey) {
  const requestBody = {
    contents: [
      {
        parts: [
          { text: SYSTEM_PROMPT },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
    },
  };

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini PDF API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Gemini ne PDF ke liye koi response nahi diya');

  const cleaned = rawText
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/gi, '')
    .trim();

  let transactions;
  try {
    transactions = JSON.parse(cleaned);
  } catch (e) {
    throw new Error('Gemini PDF response valid JSON nahi tha: ' + cleaned.substring(0, 200));
  }

  if (!Array.isArray(transactions)) throw new Error('Gemini PDF ne array nahi diya');
  return transactions;
}
