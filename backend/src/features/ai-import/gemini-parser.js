const AI_ENGINE_URL = 'http://localhost:4000'

const SYSTEM_PROMPT = `Yeh ek Indian bank statement hai. 
Saari transactions extract karo aur exactly is JSON format mein do:
[
  {
    "date": "DD-MM-YYYY",
    "description": "transaction description",
    "amount": number,
    "type": "debit" ya "credit",
    "category": "Food/Shopping/Fuel/Bills/Salary/Transfer/Other",
    "balance": number ya null
  }
]
Sirf JSON array do, koi explanation mat do, koi markdown code block mat do.`;

// Text statement parse karna
export async function parseWithOllama(statementText) {
  const response = await fetch(`${AI_ENGINE_URL}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: SYSTEM_PROMPT + '\n\nBank Statement:\n' + statementText
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI Engine error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const transactions = data?.transactions;

  if (!Array.isArray(transactions)) {
    throw new Error('AI Engine ne array nahi diya');
  }

  return transactions;
}

// PDF parse karna
export async function parseWithOllamaPdf(base64, mimeType) {
  const response = await fetch(`${AI_ENGINE_URL}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: SYSTEM_PROMPT,
      base64,
      mimeType
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI Engine PDF error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const transactions = data?.transactions;

  if (!Array.isArray(transactions)) {
    throw new Error('AI Engine PDF ne array nahi diya');
  }

  return transactions;
}