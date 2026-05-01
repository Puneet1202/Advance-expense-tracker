import { Hono } from "hono";
import { authMiddleware } from "../middlewares/auth.middleware";
import { getTrackerData, updateSettings, addTransaction, deleteTransaction, addAccount, deleteAccount, resetAllData } from "../controllers/tracker.controller";
import { importStatementHandler } from "../features/ai-import/index.js";

const router = new Hono();

// Apply auth middleware to all tracker routes
router.use('/*', authMiddleware);

router.get('/', getTrackerData);
router.post('/settings', updateSettings);

router.post('/transaction', addTransaction);
router.delete('/transaction/:id', deleteTransaction);

router.delete('/reset', resetAllData);

router.post('/account', addAccount);
router.delete('/account/:id', deleteAccount);

// AI Import Route — naya feature
router.post('/import-statement', importStatementHandler);

export default router;
