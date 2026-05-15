# 🚀 AI Financial Engine - Troubleshooting & Developer Guide

Agar app mein koi bhi AI related error aata hai, toh aapko poora code dhoondhne ki zaroorat nahi hai. Niche di gayi list se match kijiye aur exact file mein jaakar fix kijiye!

---

## 🛑 Problem 1: AI purani baatein bhool raha hai ya repetitive questions pooch raha hai
**Symptom:** Aapne expense add kar diya, lekin AI dobara "Please provide amount" bol raha hai.
**Root Cause:** Frontend apni chat history se AI ki pichli baatein (success messages) delete/hide kar raha hai.
**Kahan Fix Karein:** 
👉 `frontend/src/features/ai-chat/useAiChat.js`
*   Yahan `history.filter()` function check karein.
*   Ensure karein ki `✅ Transaction add ho gaya` wala message history mein bacha rahe aur filter out na ho. AI ko apna kiya hua kaam yaad rehna chahiye!

---

## 🛑 Problem 2: AI zabardasti (default) "Cash" se paise kaat raha hai
**Symptom:** Aapne kaha "Food 500", aur AI ne bina bank pooche cash se 500 kaat liye.
**Root Cause:** Backend system prompt mein koi aisa JSON example likha hai jisme default "cash" value set hai, jisko Llama-3 copy kar raha hai.
**Kahan Fix Karein:** 
👉 `backend/src/features/ai-chat/chat-handler.js`
*   `[Add Transaction]` block ke neeche jo `{"action":"ADD_TRANSACTION", ...}` ka JSON example hai, usko check karein.
*   Wahan clear instruction likha hona chahiye: *"CRITICAL: NEVER default to cash. If account is missing, Ask them."*

---

## 🛑 Problem 3: AI sabhi kharcho ko "Other" category bata raha hai
**Symptom:** UI ya AI Insights mein saare expenses "Other" mein dikh rahe hain, chahe wo gym ho ya food.
**Root Cause:** Backend Supabase se database laate waqt `category` column fetch (SELECT) nahi kar raha hai.
**Kahan Fix Karein:** 
👉 `backend/src/features/ai-chat/index.js`
*   Database query `.select('id, type, amount, category, description, created_at, account_id, accounts(name)')` mein ensure karein ki **`category`** word zaroor likha ho. Agar `category` select nahi hogi, toh AI ko sab kuch "Other" lagega.

---

## 🛑 Problem 4: AI delete nahi kar pa raha, ya galat item delete kar raha hai
**Symptom:** Aapne kaha "Last transaction delete karo", aur usne error de diya.
**Root Cause:** AI ko us transaction ki Database ID (`id`) nahi pata hai kyunki history mein pass nahi ki gayi.
**Kahan Fix Karein:** 
👉 `ai-engine/src/api/chat.js`
*   `compactHistory` variable ko check karein.
*   Ensure karein ki string mapping mein `[ID: ${r.id}]` likha ho. Bina ID ke delete JSON fail ho jayega.

---

## 🛑 Problem 5: AI aapse history poochtne par "Add Transaction" ka natak kar raha hai
**Symptom:** Aap pooch rahe hain *"Maine food par kitna kharch kiya"*, par AI aapse Amount maangne lagta hai jaise naya expense add karna ho.
**Root Cause:** Intent Router ya `chat-handler.js` dono ko differentiate nahi kar paa raha ki user sawal pooch raha hai ya command de raha hai.
**Kahan Fix Karein:** 
👉 `backend/src/features/ai-chat/chat-handler.js`
*   Make sure ye line zaroor ho: *"If the user is asking a QUESTION about past expenses, DO NOT try to add a transaction."*
👉 `ai-engine/src/api/chat.js`
*   `isActionOrExact` wale regex ko check karein. Zaroorat padne par wahan words add/remove karein taaki routing sahi route (SQL ya VECTOR) par jaye.

---

## 🛑 Problem 6: AI ko bolne ka tareeqa (Tone) badalna hai
**Symptom:** AI bahut formal angrezi bol raha hai ya zyada lamba jawab de raha hai.
**Root Cause:** Behavioral prompts update karne padenge.
**Kahan Fix Karein:** 
👉 `ai-engine/prompts/responses/hinglish-style.js`
👉 `ai-engine/prompts/responses/casual-chat.js`
*   Yahan aap strictly likh sakte hain ki "Sirf 2 line mein jawab do" ya "Emoji kam use karo".

---

## 📝 Folder Summary
*   `frontend/` - UI, Design, User inputs, JSON action execution.
*   `backend/` - Secure database calls, AI ko live bank balance feed karna.
*   `ai-engine/` - AI ka dimaag, Vector search, Intent samajhna, Prompt rules apply karna.
