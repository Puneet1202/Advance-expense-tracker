/**
 * csv-handler.js
 * Yeh file uploaded CSV file ko text mein convert karti hai
 * taaki Gemini API usse process kar sake.
 * SBI aur HDFC CSV formats dono support karta hai.
 */

/**
 * CSV file ka content text mein extract karta hai
 * Cloudflare Workers mein File/Blob directly read ho sakta hai
 * @param {File|Blob} file - Uploaded CSV file
 * @returns {Promise<string>} - CSV ka raw text content
 */
export async function extractCsvText(file) {
  const text = await file.text();

  if (!text || text.trim().length === 0) {
    throw new Error('CSV file khali hai ya corrupt hai');
  }

  // Basic validation — CSV mein commas hone chahiye
  if (!text.includes(',') && !text.includes('\t')) {
    throw new Error('Yeh valid CSV format nahi lagti. Commas ya tabs nahi mile.');
  }

  return text;
}
