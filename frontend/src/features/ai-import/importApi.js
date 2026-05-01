/**
 * importApi.js
 * Yeh file backend ke AI import route se baat karti hai.
 * axios instance use karta hai jo already configured hai (cookies, base URL).
 */

import api from '../../api/axios';

/**
 * Bank statement file upload karta hai aur backend se response leta hai
 * @param {File} file - CSV ya PDF file
 * @param {number|string} accountId - Jis account mein import karna hai
 * @returns {Promise<{imported: number, skipped: number, message: string}>}
 */
export async function uploadStatement(file, accountId) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('account_id', String(accountId));

  const response = await api.post('/tracker/import-statement', formData, {
    headers: {
      // Content-Type mat set karo — browser automatically multipart set karta hai
      'Content-Type': 'multipart/form-data',
    },
    timeout: 60000, // 60 seconds — Gemini ko time lagta hai
  });

  return response.data;
}

/**
 * User ke "Yes" confirm karne pe balance adjust karta hai
 * @param {number} accountId - Account ID
 * @param {number} targetBalance - Statement mein dikha closing balance
 */
export async function confirmBalance(accountId, targetBalance) {
  const response = await api.post(`/tracker/account/${accountId}/adjust-balance`, {
    target_balance: targetBalance,
  });
  return response.data;
}
