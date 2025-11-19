import { Router } from 'express';
import { handleWebhook } from '../controllers/webhookController.js';

const router = Router();

// POST /api/webhook
router.post('/webhook', handleWebhook);

export default router;
