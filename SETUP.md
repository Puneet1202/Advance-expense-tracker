# 🚀 Advance Expense Tracker — Setup Guide

## Office / New Machine pe Pull karne ke baad ye karo:

---

## 📁 1. Root Folder mein `.dev.vars` banao

Root folder (`Advance-expense-tracker/`) mein `.dev.vars` file banao:

```
ACCESS_TOKEN_SECRET=my_super_secret_access_key
REFRESH_TOKEN_SECRET=my_super_secret_refresh_key
RESEND_API_KEY=re_fNPxypjd_EZF8uyjCeT5YtS9eQky162Sd
EXCHANGE_RATE_API_KEY=107405ee941aa548653082fd
GEMINI_API_KEY=AIzaSyB6LkumhDaFg_MGh9Vt0VYDTsz6VgwAEVQ

SUPABASE_URL=https://gxnusrhlalhwspvhwkmm.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4bnVzcmhsYWxod3Nwdmh3a21tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODYzNDEwMywiZXhwIjoyMDk0MjEwMTAzfQ.ePMIV6f19XhwqCtsEdqoc3nbOBx-1CMKzX1Yq_A5Q0s
```

---

## 📁 2. `ai-engine/.env` banao

`ai-engine/` folder ke andar `.env` file banao:

```
SUPABASE_URL=https://gxnusrhlalhwspvhwkmm.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4bnVzcmhsYWxod3Nwdmh3a21tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODYzNDEwMywiZXhwIjoyMDk0MjEwMTAzfQ.ePMIV6f19XhwqCtsEdqoc3nbOBx-1CMKzX1Yq_A5Q0s
GEMINI_API_KEY=AIzaSyB6LkumhDaFg_MGh9Vt0VYDTsz6VgwAEVQ
```

---

## 🖥️ 3. Terminals Start karo (3 alag terminals chahiye)

### Terminal 1 — Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend: http://localhost:5173

### Terminal 2 — Backend (Cloudflare Worker)
```bash
# Root folder mein
npm install
npx wrangler dev
```
Backend: http://localhost:8787

### Terminal 3 — AI Engine (Cloudflare Worker)
```bash
cd ai-engine
npm install
npx wrangler dev
```
AI Engine: http://localhost:8788

---

## 🗄️ Supabase Project Details

- **Project Name:** expense-tracker
- **Project ID:** gxnusrhlalhwspvhwkmm
- **Region:** ap-south-1 (Mumbai)
- **Dashboard:** https://supabase.com/dashboard/project/gxnusrhlalhwspvhwkmm

### Tables:
- `users` — Login/Register
- `accounts` — Bank accounts
- `transactions` — Saari transactions (embeddings bhi)

### Current Data (migrated from D1):
- 1 User (id: 10, email: user@example.com)
- 4 Accounts (id: 1, 2, 35, 36)
- 87 Transactions (with vector embeddings)

---

## ⚠️ Important Notes

1. `.dev.vars` aur `ai-engine/.env` dono **gitignore mein hain** — har machine pe manually banana padega
2. Backend port `8787`, AI Engine port `8788`, Frontend port `5173`
3. Teen terminals ek saath chalenge
4. Agar `wrangler dev` error de to `npx wrangler login` karo pehle

---

## 🏗️ Architecture

```
Frontend (React/Vite :5173)
    ↓ API calls
Backend (Cloudflare Worker :8787)
    ↓ Auth + Data
Supabase (PostgreSQL + pgvector)
    ↓ AI Chat
AI Engine (Cloudflare Worker :8788)
    ↓ LLM
Cloudflare AI (Gemini fallback)
```
