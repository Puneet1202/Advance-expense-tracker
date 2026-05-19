import { Hono } from 'hono';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { getTrackerData, updateSettings, addTransaction, deleteTransaction, addAccount, deleteAccount, resetAllData, undoLastTransaction, aiChatHandler } from '../controllers/tracker.controller.js';

const router = new Hono();

router.use('/*', authMiddleware);

router.get('/', getTrackerData);
router.post('/settings', updateSettings);

router.post('/transaction', addTransaction);
router.delete('/transaction/:id', deleteTransaction);

router.post('/undo', undoLastTransaction);
router.delete('/reset', resetAllData);

router.post('/account', addAccount);
router.delete('/account/:id', deleteAccount);

router.post('/ai-chat', aiChatHandler);

export default router;