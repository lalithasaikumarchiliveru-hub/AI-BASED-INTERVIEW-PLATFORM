import { Router } from 'express';
import { BillingController } from './billing.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import express from 'express';

const router = Router();
const ctrl = new BillingController();

// Stripe webhook needs raw body — must come before json middleware
router.post('/webhook', express.raw({ type: 'application/json' }), ctrl.webhook.bind(ctrl));

// Authenticated routes
router.use(authMiddleware);
router.post('/create-checkout-session', ctrl.createCheckoutSession.bind(ctrl));
router.get('/subscription', ctrl.getSubscription.bind(ctrl));
router.post('/portal', ctrl.customerPortal.bind(ctrl));

export default router;
