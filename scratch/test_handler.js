import { handleChat } from '../backend/src/features/ai-chat/chat-handler.js';

(async () => {
  try {
    const res = await handleChat(
      "What is my total all-time expense?",
      [], // transactions
      [], // accounts
      [], // history
      "test-123"
    );
    console.log("RESULT:", res);
  } catch (e) {
    console.error("ERROR:", e);
  }
})();
