export const sqlPrompt = `FINANCIAL DATA RULES:
- Use ONLY exact numbers from context — never calculate yourself
- For "last N transactions": show exactly N, newest first, format:
  📅 DATE • Description • ±₹Amount • Account
- For spending by category: use category totals from context
- For balance: use LIVE ACCOUNT BALANCES section
- NEVER say "I don't have data" if data exists in context`;
