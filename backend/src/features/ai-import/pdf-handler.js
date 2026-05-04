/**
 * pdf-handler.js
 * Yeh file PDF ko Gemini ke liye base64 format mein encode karti hai.
 * Gemini Flash PDF ko directly process kar sakta hai via inline data.
 * Note: Cloudflare Workers mein PDF text extract karna limited hai,
 * isliye hum PDF ko base64 mein bhejte hain Gemini ko.
 */

/**
 * PDF file ko base64 string mein convert karta hai
 * @param {File|Blob} file - Uploaded PDF file
 * @returns {Promise<{base64: string, mimeType: string}>}
 */
export async function extractPdfBase64(file) {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // ArrayBuffer ko base64 mein convert karna
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const base64 = btoa(binary);

  return {
    base64,
    mimeType: 'application/pdf',
  };
}
