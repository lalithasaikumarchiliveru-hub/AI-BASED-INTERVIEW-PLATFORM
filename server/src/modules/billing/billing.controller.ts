import { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { query, queryOne } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

const PRICE_MAP: Record<string, Record<string, string>> = {
    pro: { monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '', annual: process.env.STRIPE_PRICE_PRO_ANNUAL || '' },
    team: { monthly: process.env.STRIPE_PRICE_TEAM_MONTHLY || '', annual: process.env.STRIPE_PRICE_TEAM_ANNUAL || '' },
};

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

export class BillingController {
    /** POST /api/billing/create-checkout-session */
    async createCheckoutSession(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { plan, billing = 'monthly' } = req.body;
            const userId = req.user!.user_id;
            const userEmail = req.user!.email;

            if (!PRICE_MAP[plan]) {
                throw new AppError(400, 'Invalid plan selected', 'INVALID_PLAN');
            }

            const priceId = PRICE_MAP[plan][billing];
            if (!priceId) {
                throw new AppError(400, 'Stripe price not configured. Add STRIPE_PRICE_* env vars.', 'STRIPE_NOT_CONFIGURED');
            }

            // Get or create Stripe customer
            const existing = await queryOne<{ stripe_customer_id: string | null }>(
                'SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1', [userId]
            );

            let customerId = existing?.stripe_customer_id;
            if (!customerId) {
                const customer = await stripe.customers.create({ email: userEmail, metadata: { user_id: userId } });
                customerId = customer.id;
            }

            const session = await stripe.checkout.sessions.create({
                customer: customerId,
                payment_method_types: ['card'],
                mode: 'subscription',
                line_items: [{ price: priceId, quantity: 1 }],
                success_url: `${APP_URL}/dashboard.html?payment=success&plan=${plan}`,
                cancel_url: `${APP_URL}/pricing.html?payment=cancelled`,
                metadata: { user_id: userId, plan, billing },
                subscription_data: { metadata: { user_id: userId, plan } },
                allow_promotion_codes: true,
            });

            res.json({ success: true, url: session.url });
        } catch (err) { next(err); }
    }

    /** POST /api/billing/webhook — Stripe webhook handler */
    async webhook(req: Request, res: Response): Promise<void> {
        const sig = req.headers['stripe-signature'] as string;
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

        let event: Stripe.Event;
        try {
            event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } catch {
            res.status(400).send('Webhook signature invalid');
            return;
        }

        try {
            switch (event.type) {
                case 'checkout.session.completed': {
                    const session = event.data.object as Stripe.Checkout.Session;
                    const userId = session.metadata?.user_id;
                    const plan = session.metadata?.plan;
                    if (userId && plan && session.subscription) {
                        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
                        const subAny = sub as any;
                        await query(
                            `INSERT INTO subscriptions (user_id, plan_id, status, stripe_customer_id, stripe_subscription_id,
                             current_period_start, current_period_end)
                             VALUES ($1,$2,'active',$3,$4, to_timestamp($5), to_timestamp($6))
                             ON CONFLICT(user_id) DO UPDATE SET
                               plan_id=$2, status='active', stripe_customer_id=$3, stripe_subscription_id=$4,
                               current_period_start=to_timestamp($5), current_period_end=to_timestamp($6), updated_at=NOW()`,
                            [userId, plan, session.customer, session.subscription,
                                subAny.current_period_start ?? 0, subAny.current_period_end ?? 0]
                        );
                        logger.info('Subscription activated', { userId, plan });
                    }
                    break;
                }
                case 'customer.subscription.updated':
                case 'customer.subscription.deleted': {
                    const sub = event.data.object as Stripe.Subscription;
                    const userId = sub.metadata?.user_id;
                    if (userId) {
                        const newStatus = event.type === 'customer.subscription.deleted' ? 'cancelled' : sub.status;
                        const planId = newStatus === 'cancelled' ? 'free' : (sub.metadata?.plan || 'free');
                        await query(
                            `UPDATE subscriptions SET status=$1, plan_id=$2, updated_at=NOW() WHERE user_id=$3`,
                            [newStatus, planId, userId]
                        );
                    }
                    break;
                }
                case 'invoice.payment_failed': {
                    const invoice = event.data.object as Stripe.Invoice;
                    const cusId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
                    if (cusId) {
                        await query(`UPDATE subscriptions SET status='past_due', updated_at=NOW() WHERE stripe_customer_id=$1`, [cusId]);
                    }
                    break;
                }
            }
            res.json({ received: true });
        } catch (err) {
            logger.error('Webhook handler error', { error: err });
            res.status(500).json({ error: 'Webhook processing failed' });
        }
    }

    /** GET /api/billing/subscription — get current plan */
    async getSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const sub = await queryOne(
                `SELECT s.plan_id, s.status, s.current_period_end, s.cancel_at_period_end,
                        p.name, p.interview_limit_monthly, p.features
                 FROM subscriptions s JOIN plans p ON s.plan_id = p.plan_id
                 WHERE s.user_id = $1`,
                [req.user!.user_id]
            );
            if (!sub) {
                // Auto-assign free plan 
                await query(`INSERT INTO subscriptions (user_id, plan_id, status) VALUES ($1,'free','active') ON CONFLICT DO NOTHING`, [req.user!.user_id]);
            }
            res.json({ success: true, data: sub || { plan_id: 'free', status: 'active', name: 'Free', interview_limit_monthly: 3, features: {} } });
        } catch (err) { next(err); }
    }

    /** POST /api/billing/portal — Stripe Customer Portal */
    async customerPortal(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const sub = await queryOne<{ stripe_customer_id: string | null }>(
                'SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1', [req.user!.user_id]
            );
            if (!sub?.stripe_customer_id) {
                throw new AppError(400, 'No Stripe customer found. Please subscribe first.', 'NO_CUSTOMER');
            }
            const session = await stripe.billingPortal.sessions.create({
                customer: sub.stripe_customer_id,
                return_url: `${APP_URL}/dashboard.html`,
            });
            res.json({ success: true, url: session.url });
        } catch (err) { next(err); }
    }
}
