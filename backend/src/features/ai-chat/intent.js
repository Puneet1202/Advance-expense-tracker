/**
 * Code-based routing — LLM ko har message type guess nahi karwana.
 * @returns {'casual'|'data'|'action'|'vector'}
 */
export function classifyChatIntent(message) {
  const q = String(message || '').toLowerCase().trim();
  if (!q) return 'casual';

  if (
    /^(hi|hello|hey|hii|namaste|good\s*(morning|afternoon|evening|night)|how\s*are\s*you|kaise\s*ho|kya\s*haal|thanks?|thank\s*you|shukriya|dhanyavaad|ok|okay|bye|goodbye|theek\s*hai|thik\s*hai)\b/i.test(
      q
    )
  ) {
    return 'casual';
  }
  if (/^(hi|hello|hey)\b/i.test(q) && q.length < 50 && !/\d{3,}/.test(q)) {
    return 'casual';
  }

  if (
    /(saving|bachat|tips?|advice|suggest|recommend|kaise\s*bach|investment|budget\s*tip)/i.test(q) &&
    !/(kitna|balance|dikhao|transaction|kharcha|amount|₹|rs\b)/i.test(q)
  ) {
    return 'vector';
  }

  const pastQuery =
    /(tha|thi|the\b|kiya\s*tha|kiya\s*thi|dikhao|dikha|batao|kitna\s*(gaya|kharcha|hua|tha)|balance|history|last\s*\d|pehle|record|search|mila|hui\s*thi|order\s*kiya|wala\s*kharcha|wala\s*tha)/i.test(
      q
    );
  const hasAmount = /\d{2,}/.test(q);
  const addVerb = /(daal|add|log\s*kar|entry|kharcha\s*hua|pay\s*kiya|spent|kharid|mili|mila|received|credit)\b/i.test(q);
  const inlineAdd =
    hasAmount &&
    (/\b\w+\s+\d{2,}\s+\w+/i.test(message) || /\b(salary|petrol|dinner|lunch|uber|coffee)\s+\d{2,}/i.test(q));
  if ((addVerb || inlineAdd) && !pastQuery) {
    return 'action';
  }

  return 'data';
}
