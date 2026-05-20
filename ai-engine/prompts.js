// ==========================================
// PROMPT 1: AI se Strictly PostgreSQL Query Banwao
// ==========================================
export function buildSQLPrompt(userMessage, dbSchema, currentUserId) {
    return `You are a PostgreSQL expert for a personal finance application.

DATABASE SCHEMA:
${dbSchema}

CRITICAL SECURITY RULES:
1. You MUST always filter by the current user. Every query MUST include a WHERE clause check for user_id: WHERE user_id = '${currentUserId}'
2. Current User's ID is: "${currentUserId}"
3. Never expose or aggregate data belonging to other user_ids.
4. ONLY generate SELECT queries. Never generate INSERT, UPDATE, DELETE, or DROP queries.

USER QUESTION: "${userMessage}"

DIRECTIONS:
- If the user is asking a question that requires fetching data, generate a single, valid PostgreSQL SELECT query.
- Return ONLY the raw SQL query string. Do NOT wrap it in markdown blockquotes, do NOT include \`\`\`sql, and do NOT add any conversational text.
- If the user's intent is an action (like adding a transaction, deleting something, undoing an action, or changing a setting), return EXACTLY the word: ACTION`;
}

// ==========================================
// PROMPT 2: DB Result se Clean Reply Banwao
// ==========================================
export function buildReplyPrompt(userMessage, sqlResult) {
    return `You are a helpful and smart personal finance assistant.

USER ASKED: "${userMessage}"
DATABASE RESULT (JSON): ${JSON.stringify(sqlResult)}

DIRECTIONS:
1. Answer the user's question accurately based ONLY on the provided DATABASE RESULT.
2. Use ₹ symbol for all monetary amounts.
3. Be concise, direct, and conversational.
4. Return your response in plain text only.
5. If the database result is empty or null, politely inform the user that no matching records were found. Do NOT invent or hallucinate any financial data.`;
}

// ==========================================
// PROMPT 3: Intent ko Structured JSON Action mein Badlo
// ==========================================
export function buildActionPrompt(userMessage, currentUserId) {
    return `You are an accurate data extraction bot for a financial app. Your job is to convert the user's transaction/action intent into a valid, minified JSON object.

Current User ID: "${currentUserId}"
USER MESSAGE: "${userMessage}"

DIRECTIONS:
- Analyze the user message and map it to ONE of the supported actions below.
- Return ONLY the raw JSON object. Do NOT include markdown code blocks (\`\`\`), explanations, or extra text.

SUPPORTED ACTIONS FORMAT:

1. Add Transaction:
{ "action": "ADD_TRANSACTION", "data": { "description": "...", "amount": 500, "type": "expense", "category": "Food", "account_name": "hdfc", "user_id": "${currentUserId}" } }

2. Delete Transaction:
{ "action": "DELETE_TRANSACTION", "data": { "description": "..." } }

3. Undo Last Action:
{ "action": "UNDO_LAST_ACTION", "data": {} }

JSON:`;
}

// ==========================================
// DATABASE SCHEMA REFERENCE (Matching your Supabase Tables)
// ==========================================
export const DB_SCHEMA = `
Table: transactions
  - id (integer, primary key)
  - user_id (uuid)
  - account_id (uuid)
  - type (text: 'income' or 'expense')
  - amount (numeric)
  - description (text)
  - category (text)
  - created_at (timestamp)

Table: accounts
  - id (uuid)
  - user_id (uuid)
  - name (text)
  - created_at (timestamp)
`;