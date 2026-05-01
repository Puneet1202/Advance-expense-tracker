# AI Instructions (PROMPT.md)

Yeh file future AI instructions ke liye hai.
Yahan aap AI ko custom instructions de sakte ho jo app mein use hongi.

---

## Current Instructions

Yeh ek Indian expense tracker app hai jisme:
- Users apne bank accounts track karte hain (SBI, HDFC, etc.)
- Transactions income ya expense ho sakti hain
- Monthly budget aur saving mode support hai

## Bank Statement Import Rules

Jab bhi bank statement parse karo:
1. Sirf actual transactions nikalo — opening/closing balance rows skip karo
2. UPI transactions mein description clean rakho (e.g., "UPI-Swiggy" → description: "Swiggy Food Order")
3. Category automatically assign karo:
   - Swiggy/Zomato/Restaurant → Food
   - Amazon/Flipkart/Mall → Shopping
   - Petrol/HP/BPCL/Indian Oil → Fuel
   - Electricity/Water/Gas/DTH/Internet → Bills
   - Salary/Stipend → Salary
   - NEFT/IMPS/Transfer → Transfer
   - Baaki sab → Other
4. Amount kabhi negative mat do — type field se debit/credit decide hota hai
5. Balance column null ho sakta hai agar available nahi

## Custom Instructions (Aap yahan likh sakte ho)

<!-- Yahan apni instructions likho -->
