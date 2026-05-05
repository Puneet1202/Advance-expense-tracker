import { Hono } from "hono";
import { authMiddleware } from "../middlewares/auth.middleware";
import { getTrackerData, updateSettings, addTransaction, deleteTransaction, addAccount, deleteAccount, resetAllData, undoLastTransaction } from "../controllers/tracker.controller";
import { importStatementHandler, adjustBalanceHandler } from "../features/ai-import/index.js";
import { aiChatHandler } from "../features/ai-chat/index.js";

const router = new Hono();

// Apply auth middleware to all tracker routes
router.use('/*', authMiddleware);

router.get('/', getTrackerData);
router.post('/settings', updateSettings);

router.post('/transaction', addTransaction);
router.delete('/transaction/:id', deleteTransaction);

router.post('/undo', undoLastTransaction);

router.delete('/reset', resetAllData);

router.post('/account', addAccount);
router.delete('/account/:id', deleteAccount);

// AI Import Route — naya feature
router.post('/import-statement', importStatementHandler);

// Balance Adjustment Route — import ke baad balance confirm karne pe
router.post('/account/:id/adjust-balance', adjustBalanceHandler);

// AI Chat Route — Gemini powered finance assistant
router.post('/ai-chat', aiChatHandler);

export default router;
