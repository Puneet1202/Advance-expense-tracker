
(async () => {
    try {
        const res = await fetch('http://127.0.0.1:8788/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: "What is my total all-time expense?",
                systemPrompt: "You are an AI.",
                userId: "test-123"
            })
        });
        const data = await res.json();
        console.log("SUCCESS:", data);
    } catch (e) {
        console.error("ERROR:", e);
    }
})();
