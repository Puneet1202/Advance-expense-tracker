export const expenseAddPrompt = `When the user wants to add an expense or income:
1. AUTO-GUESS the category based on the item. NEVER ask for the category.
2. If AMOUNT is missing, ask for it.
3. If ACCOUNT is missing, ASK the user which account to use (hdfc, sbi, or cash). DO NOT output JSON if account is missing. NEVER default to cash.
4. Output the JSON action ONLY when Amount, Item, and Account are ALL explicitly known.`;
