# Advance Expense Tracker - AI Engine Architecture & Context

This document contains the complete context of how the AI Financial Engine is built. 
**If you are another AI assistant, read this carefully before suggesting any code changes!**

## 🏗️ 1. System Architecture (Microservices)
The project is divided into three distinct parts:
1. **Frontend (React/Vite):** `frontend/` - Handles UI, Chat Panel, and executes JSON actions.
2. **Backend (Hono/Cloudflare Workers):** `backend/` - Handles Supabase DB connections, Auth, and constructs the Live Data prompt for the AI.
3. **AI-Engine (Cloudflare AI):** `ai-engine/` - A dedicated microservice using `@cloudflare/ai` (Llama-3-8b-instruct) for natural language processing, vector embeddings, and semantic routing.

## 🔄 2. The Chat Request Flow
1. **User types a message** in the React Frontend (`useAiChat.js`).
2. **Frontend sends history** (excluding JSON action payloads to prevent AI looping) to the Backend.
3. **Backend (`chat-handler.js`)** securely fetches:
   - Live Account Balances.
   - Last 20 Transactions (including ID, Amount, Category, Description).
   - Monthly Totals (Income vs Expense).
4. **Backend constructs a System Prompt** containing this strict financial data and the "JSON Action Rules" (e.g., ADD_TRANSACTION, DELETE_TRANSACTION).
5. **Backend forwards the payload** to `ai-engine/src/api/chat.js`.
6. **AI-Engine detects the Intent:**
   - Matches keywords (e.g., "kharch", "add", "kitna") -> Routes to `SQL` or `EXPENSE_ADD`.
   - Appends specific behavioral prompt layers from `ai-engine/prompts/`.
7. **Llama-3 generates a response:** Either natural Hinglish text OR a strict JSON action object.
8. **Frontend receives the response:** If it's a JSON action, it executes the API call (e.g., POST `/tracker/transaction`) and shows a success toast.

## 🧠 3. Critical AI Prompt Rules (Do Not Change These Recklessly)

### A. The "Do Not Default to Cash" Rule
In `backend/src/features/ai-chat/chat-handler.js`, the ADD_TRANSACTION JSON example MUST use a specific bank (like `hdfc`) and explicitly forbid defaulting to cash. If the user says "food 500", the AI MUST ask "Kaunse account se?".

### B. The "Question vs Action" Boundary
If the user asks a historical question (e.g., "Maine food par kitna kharch kiya?"), the AI MUST NOT try to output an `ADD_TRANSACTION` JSON. It should read the injected database history and answer naturally.

### C. The History Scrubbing Rule
In `frontend/src/features/ai-chat/useAiChat.js`, the chat history sent to the backend MUST INCLUDE the AI's success messages (e.g., "✅ Transaction add ho gaya"). If these are filtered out, the AI will suffer from amnesia and ask repetitive questions about transactions it already completed.

## 📂 4. Key Files
*   `frontend/src/features/ai-chat/useAiChat.js`: Manages local chat state, history filtering, and API calls.
*   `backend/src/features/ai-chat/index.js`: Supabase query that MUST select `category` and `id` to feed the AI correctly.
*   `backend/src/features/ai-chat/chat-handler.js`: The bridge. Injects live balances and strict JSON rules.
*   `ai-engine/src/api/chat.js`: The brain. Detects intents (SQL vs Vector), fetches semantic matches, and calculates token/route diagnostics.
*   `ai-engine/prompts/index.js`: The Prompt Router that layers different prompt behaviors dynamically.

## 🛠️ 5. Diagnostics
The AI-Engine returns a `diagnostics` object. The Frontend logs this to the Browser Console (F12) so developers can see:
`🤖 [AI Route]: SQL | ⚡ [Cache Hit]: true | 📊 [Tokens]: 854`
