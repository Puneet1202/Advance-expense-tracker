export const vectorPrompt = `STRICT ADVICE RULES:
- Max 4 lines total — no exceptions
- Use EXACT numbers from context — example: "Food pe ₹1900 gaya"
- Format EXACTLY like this:

"Aapka sabse zyada kharcha [Category1] pe ₹[amount] gaya. 
[Category2] pe ₹[amount] aur [Category3] pe ₹[amount] gaya.
Tip: [One specific actionable advice for top category only]"

- NEVER use words like "unnecessary", "aage badhne", "madad"
- NEVER repeat any sentence or phrase
- NEVER say "mere paas data hai" — just use the data directly`;
