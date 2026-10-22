import dotenv from "dotenv";
import type { FastifyPluginAsync } from "fastify";
import { authenticateRequest } from "../services/auth.service.js";
import { billingStore } from "../services/billing/billing-store.service.js";
import { entitlementService } from "../services/entitlement.service.js";
import { DodoPaymentAdapter } from "../services/billing/dodo.adapter.js";
import { MockPaymentAdapter } from "../services/billing/mock.adapter.js";
import type { IPaymentGatewayAdapter } from "../services/billing/payment-gateway.interface.js";
import type { PlanId, UserSubscription, BillingInvoice, SubscriptionStatus } from "@voxflow/shared";
import { PLAN_CONFIGS, TOPUP_CONFIG, ADDON_PACKS } from "@voxflow/shared";

// Explicit gateway adapter override (e.g. for testing)
let explicitGateway: IPaymentGatewayAdapter | null = null;

export function setPaymentGatewayAdapter(adapter: IPaymentGatewayAdapter) {
  explicitGateway = adapter;
}

export function getPaymentGatewayAdapter(): IPaymentGatewayAdapter {
  if (explicitGateway) {
    return explicitGateway;
  }
  if (!process.env.DODO_PAYMENTS_API_KEY) {
    dotenv.config();
  }
  return process.env.DODO_PAYMENTS_API_KEY
    ? new DodoPaymentAdapter()
    : new MockPaymentAdapter();
}

const billingRoute: FastifyPluginAsync = async (app) => {
  // 1. POST /billing/checkout — Create secure hosted checkout session
  app.post("/billing/checkout", async (request, reply) => {
    const user = await authenticateRequest(request, reply);
    if (!user) return;
    const userId = user.id;

    const body = request.body as {
      planId?: string;
      packId?: string;
      successUrl?: string;
      cancelUrl?: string;
      action?: "new" | "early_renewal" | "topup";
    };

    const action = body?.action || "new";
    const planId: PlanId = (body?.planId as PlanId) || "premium_monthly";

    // 0. Disable checkout for Business plan (Coming Soon)
    if (planId === "business_monthly") {
      return reply.code(400).send({
        error: "Business plan ($29/mo) is currently Coming Soon and not available for checkout.",
        code: "PLAN_NOT_AVAILABLE"
      });
    }

    // Validate plan
    if (planId !== "premium_monthly") {
      return reply.code(400).send({
        error: "Invalid plan identifier. Only 'premium_monthly' ($9/mo) is eligible for checkout.",
        code: "INVALID_PLAN"
      });
    }

    // Validate top-up pack if action is topup
    let selectedPack = ADDON_PACKS[0];
    if (action === "topup") {
      if (body?.packId) {
        const found = ADDON_PACKS.find((p) => p.id === body.packId);
        if (!found) {
          return reply.code(400).send({
            error: `Invalid add-on pack ID: ${body.packId}. Valid options: ${ADDON_PACKS.map((p) => p.id).join(", ")}`,
            code: "INVALID_ADDON_PACK"
          });
        }
        selectedPack = found;
      }
    }

    // 1. Guard against duplicate active subscriptions or invalid early renewals
    const existingSub = await billingStore.getSubscriptionByUserId(userId);
    const now = new Date();
    const periodEnd = existingSub ? new Date(existingSub.currentPeriodEnd) : null;
    const isSubActive =
      existingSub &&
      (existingSub.status === "active" ||
        existingSub.status === "cancel_at_period_end" ||
        existingSub.status === "past_due") &&
      periodEnd !== null &&
      now <= periodEnd;

    if (action === "early_renewal") {
      if (!isSubActive) {
        return reply.code(400).send({
          error: "You do not have an active Pro subscription to renew early. Please purchase a regular subscription.",
          code: "NO_ACTIVE_SUBSCRIPTION"
        });
      }
    } else if (action === "topup") {
      if (!isSubActive) {
        return reply.code(403).send({
          error: "Additional usage packs are only available for active Pro subscribers.",
          code: "PRO_SUBSCRIPTION_REQUIRED"
        });
      }
    } else {
      if (isSubActive) {
        return reply.code(409).send({
          error: "You already have an active VoxFlow subscription.",
          code: "ALREADY_SUBSCRIBED",
          subscriptionId: existingSub!.subscriptionId,
          status: existingSub!.status
        });
      }
    }

    // 2. Concurrency lock: Prevent rapid double-clicks or racing checkout creations
    const lockAcquired = billingStore.acquireCheckoutLock(userId);
    if (!lockAcquired) {
      return reply.code(409).send({
        error: "A checkout request is already in progress. Please wait a moment.",
        code: "CONCURRENT_CHECKOUT"
      });
    }

    try {
      // 3. Server-authoritative idempotency key
      const clientSuppliedKey = request.headers["x-idempotency-key"] as string | undefined;
      const idempotencyKey =
        clientSuppliedKey ||
        (action === "early_renewal"
          ? `idem_checkout_${userId}_early_renewal_${Date.now()}`
          : action === "topup"
            ? `idem_checkout_${userId}_topup_${selectedPack.id}_${Date.now()}`
            : `idem_checkout_${userId}_${planId}_${entitlementService.getCurrentPeriodKey()}`);

      const host = request.headers.host || "localhost:5173";
      const protocol = request.headers["x-forwarded-proto"] || "http";
      const defaultSuccessUrl = `${protocol}://${host}/#/billing/success?session_id={CHECKOUT_SESSION_ID}`;
      const defaultCancelUrl = `${protocol}://${host}/#/billing/cancel`;

      const sessionResult = await getPaymentGatewayAdapter().createCheckoutSession({
        userId,
        email: user.email || `${userId}@voxflow.app`,
        planId,
        successUrl: body?.successUrl || defaultSuccessUrl,
        cancelUrl: body?.cancelUrl || defaultCancelUrl,
        idempotencyKey,
        metadata: {
          action,
          userId,
          planId,
          packId: selectedPack.id,
          minutes: String(selectedPack.minutes),
          priceCents: String(selectedPack.priceCents)
        }
      });

      return reply.code(200).send({
        sessionId: sessionResult.sessionId,
        checkoutUrl: sessionResult.checkoutUrl
      });
    } catch (error: any) {
      app.log.error(error);
      const message = error instanceof Error ? error.message : "Failed to initiate checkout session";
      return reply.code(500).send({
        error: message,
        code: "CHECKOUT_SESSION_FAILED"
      });
    } finally {
      billingStore.releaseCheckoutLock(userId);
    }
  });

  // 2. POST /billing/portal — Customer billing portal session
  app.post("/billing/portal", async (request, reply) => {
    const user = await authenticateRequest(request, reply);
    if (!user) return;
    const userId = user.id;

    const existingSub = await billingStore.getSubscriptionByUserId(userId);
    if (!existingSub || !existingSub.customerId) {
      return reply.code(404).send({
        error: "No active billing customer found for this account.",
        code: "NO_BILLING_CUSTOMER"
      });
    }

    const host = request.headers.host || "localhost:5173";
    const protocol = request.headers["x-forwarded-proto"] || "http";
    const returnUrl = `${protocol}://${host}/#/billing`;

    try {
      const portalResult = await getPaymentGatewayAdapter().createCustomerPortalSession({
        customerId: existingSub.customerId,
        returnUrl
      });

      return reply.code(200).send({
        portalUrl: portalResult.portalUrl
      });
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({
        error: "Failed to open customer billing portal.",
        code: "PORTAL_SESSION_FAILED"
      });
    }
  });

  // 3. POST /billing/webhook — Secure authoritative webhook endpoint
  app.post("/billing/webhook", async (request, reply) => {
    const sigHeader =
      (request.headers["webhook-signature"] as string) ||
      (request.headers["x-mock-signature"] as string) ||
      "";

    // In Fastify, raw body is preserved via our preParsing rawBody plugin or request.body
    const rawBody: Buffer | string =
      (request as any).rawBody ||
      (typeof request.body === "string" ? request.body : JSON.stringify(request.body || {}));

    let event: any;
    try {
      event = getPaymentGatewayAdapter().constructWebhookEvent(
        rawBody,
        sigHeader,
        request.headers as Record<string, string | string[] | undefined>
      );
    } catch (err: any) {
      app.log.warn({ msg: "Webhook signature verification failed", error: err.message });
      return reply.code(400).send({
        error: `Webhook verification failed: ${err.message}`,
        code: "INVALID_WEBHOOK_SIGNATURE"
      });
    }

    const eventId = event.id;
    const provider = getPaymentGatewayAdapter().providerName;

    // 1. Deduplication / Replay protection: Check if event ID was already processed
    const alreadyProcessed = await billingStore.isWebhookEventProcessed(provider, eventId);
    if (alreadyProcessed) {
      app.log.info({ msg: "Ignoring replayed webhook event", eventId, provider });
      return reply.code(200).send({ received: true, deduplicated: true });
    }

    // 2. Record event in audit ledger
    await billingStore.recordWebhookEvent(provider, eventId, event.type, "processing");

    try {
      const eventObj = event.data?.object || {};

      switch (event.type) {
        case "subscription.active":
        case "checkout.session.completed": {
          const subId = eventObj.subscription_id || eventObj.subscription || eventObj.id;
          const userId = eventObj.metadata?.userId || eventObj.client_reference_id || eventObj.customer?.name;
          const planId: PlanId = (eventObj.metadata?.planId as PlanId) || "premium_monthly";
          const customerId = eventObj.customer?.customer_id || eventObj.customer || `cus_${userId}`;
          const action = eventObj.metadata?.action;
          const paymentId = eventObj.payment_id || eventObj.invoice || eventObj.id;

          if (userId) {
            const now = new Date();
            const periodKey = entitlementService.getCurrentPeriodKey();

            if (action === "early_renewal") {
              const existingSub = await billingStore.getSubscriptionByUserId(userId);
              if (existingSub) {
                const alreadyProcessed = paymentId
                  ? await billingStore.hasInvoiceWithProviderId(userId, paymentId)
                  : false;

                if (!alreadyProcessed) {
                  await billingStore.resetMonthlyQuota(userId, periodKey);
                  const currentEnd = new Date(existingSub.currentPeriodEnd);
                  const baseTime = currentEnd > now ? currentEnd.getTime() : now.getTime();
                  const newPeriodEnd = new Date(baseTime + 30 * 24 * 60 * 60 * 1000).toISOString();

                  existingSub.currentPeriodEnd = newPeriodEnd;
                  existingSub.status = "active";
                  existingSub.cancelAtPeriodEnd = false;
                  existingSub.canceledAt = null;
                  existingSub.updatedAt = now.toISOString();
                  await billingStore.saveSubscription(existingSub);

                  const amountCents = eventObj.total_amount || eventObj.amount_total || 900;
                  const invoice: BillingInvoice = {
                    id: `inv_rec_${Date.now()}`,
                    userId,
                    providerInvoiceId: paymentId || `inv_early_${Date.now()}`,
                    amountPaidCents: amountCents,
                    currency: (eventObj.currency || "usd").toLowerCase(),
                    status: "paid",
                    hostedInvoiceUrl: eventObj.invoice_url || eventObj.hosted_invoice_url,
                    periodStart: existingSub.currentPeriodStart,
                    periodEnd: newPeriodEnd,
                    createdAt: now.toISOString()
                  };
                  await billingStore.saveInvoice(invoice);
                }
                break;
              }
            } else if (action === "topup") {
              const packId = eventObj.metadata?.packId;
              const pack = ADDON_PACKS.find((p) => p.id === packId) || ADDON_PACKS[0];
              const minutes = eventObj.metadata?.minutes
                ? parseInt(eventObj.metadata.minutes, 10)
                : pack.minutes;

              const { alreadyProcessed } = await billingStore.addPurchasedCredits(
                userId,
                periodKey,
                minutes,
                0, // transcription minutes only
                paymentId
              );

              if (!alreadyProcessed) {
                const amountCents = eventObj.total_amount || eventObj.amount_total || pack.priceCents;
                const invoice: BillingInvoice = {
                  id: `inv_rec_${Date.now()}`,
                  userId,
                  providerInvoiceId: paymentId || `inv_topup_${Date.now()}`,
                  amountPaidCents: amountCents,
                  currency: (eventObj.currency || "usd").toLowerCase(),
                  status: "paid",
                  hostedInvoiceUrl: eventObj.invoice_url || eventObj.hosted_invoice_url,
                  periodStart: now.toISOString(),
                  periodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                  createdAt: now.toISOString()
                };
                await billingStore.saveInvoice(invoice);

                app.log.info({
                  msg: "Successfully credited usage add-on minutes",
                  userId,
                  packId: pack.id,
                  minutes,
                  paymentId
                });
              }
              break;
            }

            if (subId) {
            const now = new Date();
            const oneMonthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            // Fetch authoritative subscription data if available from provider
            let currentPeriodStart = eventObj.previous_billing_date
              ? new Date(eventObj.previous_billing_date).toISOString()
              : now.toISOString();
            let currentPeriodEnd = eventObj.next_billing_date
              ? new Date(eventObj.next_billing_date).toISOString()
              : oneMonthFromNow.toISOString();

            if (subId && typeof getPaymentGatewayAdapter().getAuthoritativeSubscription === "function") {
              const authSub = await getPaymentGatewayAdapter().getAuthoritativeSubscription(subId);
              if (authSub) {
                currentPeriodStart = authSub.currentPeriodStart;
                currentPeriodEnd = authSub.currentPeriodEnd;
              }
            }

            const newSub: UserSubscription = {
              id: `sub_rec_${Date.now()}`,
              userId,
              provider: provider as any,
              customerId,
              subscriptionId: subId,
              planId,
              status: "active",
              currentPeriodStart,
              currentPeriodEnd,
              cancelAtPeriodEnd: !!eventObj.cancel_at_next_billing_date,
              canceledAt: null,
              createdAt: now.toISOString(),
              updatedAt: now.toISOString()
            };

            await billingStore.saveSubscription(newSub);

            // Also record an initial invoice if amount was present
            const amountCents = eventObj.total_amount || eventObj.amount_total;
            if (amountCents) {
              const invoice: BillingInvoice = {
                id: `inv_rec_${Date.now()}`,
                userId,
                providerInvoiceId: eventObj.payment_id || eventObj.invoice || `inv_${Date.now()}`,
                amountPaidCents: amountCents,
                currency: (eventObj.currency || "usd").toLowerCase(),
                status: "paid",
                hostedInvoiceUrl: eventObj.invoice_url || eventObj.hosted_invoice_url,
                periodStart: currentPeriodStart,
                periodEnd: currentPeriodEnd,
                createdAt: now.toISOString()
              };
              await billingStore.saveInvoice(invoice);
            }
          }
        }
        break;
      }

        case "subscription.renewed": {
          const subId = eventObj.subscription_id || eventObj.id;
          const userId = eventObj.metadata?.userId;
          if (subId) {
            const authSub = await getPaymentGatewayAdapter().getAuthoritativeSubscription(subId);
            const targetUserId = userId || authSub?.userId;
            if (targetUserId) {
              const existing = await billingStore.getSubscriptionByUserId(targetUserId);
              const now = new Date();
              const currentPeriodStart = eventObj.previous_billing_date
                ? new Date(eventObj.previous_billing_date).toISOString()
                : authSub?.currentPeriodStart || now.toISOString();
              const currentPeriodEnd = eventObj.next_billing_date
                ? new Date(eventObj.next_billing_date).toISOString()
                : authSub?.currentPeriodEnd || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

              const updatedSub: UserSubscription = {
                id: existing ? existing.id : `sub_rec_${Date.now()}`,
                userId: targetUserId,
                provider: provider as any,
                customerId: eventObj.customer?.customer_id || authSub?.customerId || existing?.customerId || "",
                subscriptionId: subId,
                planId: (eventObj.metadata?.planId as PlanId) || authSub?.planId || "premium_monthly",
                status: "active",
                currentPeriodStart,
                currentPeriodEnd,
                cancelAtPeriodEnd: false,
                canceledAt: null,
                createdAt: existing ? existing.createdAt : new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };

              await billingStore.saveSubscription(updatedSub);
            }
          }
          break;
        }

        case "subscription.updated":
        case "customer.subscription.updated": {
          const subId = eventObj.subscription_id || eventObj.id;
          const userId = eventObj.metadata?.userId;
          if (subId) {
            // Check out-of-order protection: Fetch authoritative subscription
            const authSub = await getPaymentGatewayAdapter().getAuthoritativeSubscription(subId);
            if (authSub && (userId || authSub.userId)) {
              const targetUserId = userId || authSub.userId;
              const existing = await billingStore.getSubscriptionByUserId(targetUserId);

              // Out-of-order protection: Do not overwrite terminal canceled or expired states with stale update events
              if (existing && (existing.status === "canceled" || existing.status === "expired")) {
                app.log.warn({
                  msg: "Ignoring out-of-order subscription.updated for terminal subscription state",
                  userId: targetUserId,
                  currentStatus: existing.status
                });
                break;
              }

              const cancelAtPeriodEnd = !!(eventObj.cancel_at_next_billing_date ?? authSub.cancelAtPeriodEnd);
              const status: SubscriptionStatus = cancelAtPeriodEnd ? "cancel_at_period_end" : authSub.status;

              const updatedSub: UserSubscription = {
                id: existing ? existing.id : `sub_rec_${Date.now()}`,
                userId: targetUserId,
                provider: provider as any,
                customerId: authSub.customerId,
                subscriptionId: subId,
                planId: authSub.planId,
                status,
                currentPeriodStart: authSub.currentPeriodStart,
                currentPeriodEnd: authSub.currentPeriodEnd,
                cancelAtPeriodEnd,
                canceledAt: cancelAtPeriodEnd ? (existing?.canceledAt || new Date().toISOString()) : null,
                createdAt: existing ? existing.createdAt : new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };

              await billingStore.saveSubscription(updatedSub);
            }
          }
          break;
        }

        case "subscription.cancelled":
        case "customer.subscription.deleted": {
          const subId = eventObj.subscription_id || eventObj.id;
          const userId = eventObj.metadata?.userId;
          if (subId) {
            const authSub = await getPaymentGatewayAdapter().getAuthoritativeSubscription(subId);
            const targetUserId = userId || authSub?.userId;
            if (targetUserId) {
              const existing = await billingStore.getSubscriptionByUserId(targetUserId);
              if (existing) {
                existing.status = "canceled";
                existing.canceledAt = new Date().toISOString();
                existing.updatedAt = new Date().toISOString();
                await billingStore.saveSubscription(existing);
              }
            }
          }
          break;
        }

        case "subscription.expired": {
          const subId = eventObj.subscription_id || eventObj.id;
          const userId = eventObj.metadata?.userId;
          if (subId) {
            const authSub = await getPaymentGatewayAdapter().getAuthoritativeSubscription(subId);
            const targetUserId = userId || authSub?.userId;
            if (targetUserId) {
              const existing = await billingStore.getSubscriptionByUserId(targetUserId);
              if (existing) {
                existing.status = "expired";
                existing.updatedAt = new Date().toISOString();
                await billingStore.saveSubscription(existing);
              }
            }
          }
          break;
        }

        case "payment.succeeded":
        case "invoice.payment_succeeded": {
          const userId =
            eventObj.metadata?.userId ||
            eventObj.customer?.name ||
            eventObj.subscription_details?.metadata?.userId ||
            eventObj.lines?.data?.[0]?.metadata?.userId;
          const paymentId = eventObj.payment_id || eventObj.id;
          const action = eventObj.metadata?.action;

          if (userId && paymentId) {
            const now = new Date();
            const periodKey = entitlementService.getCurrentPeriodKey();

            const alreadyProcessed = await billingStore.hasInvoiceWithProviderId(userId, paymentId);

            if (!alreadyProcessed) {
              if (action === "early_renewal") {
                const existingSub = await billingStore.getSubscriptionByUserId(userId);
                if (existingSub) {
                  await billingStore.resetMonthlyQuota(userId, periodKey);
                  const currentEnd = new Date(existingSub.currentPeriodEnd);
                  const baseTime = currentEnd > now ? currentEnd.getTime() : now.getTime();
                  const newPeriodEnd = new Date(baseTime + 30 * 24 * 60 * 60 * 1000).toISOString();
                  existingSub.currentPeriodEnd = newPeriodEnd;
                  existingSub.status = "active";
                  existingSub.cancelAtPeriodEnd = false;
                  existingSub.canceledAt = null;
                  existingSub.updatedAt = now.toISOString();
                  await billingStore.saveSubscription(existingSub);
                }
              } else if (action === "topup") {
                const packId = eventObj.metadata?.packId;
                const pack = ADDON_PACKS.find((p) => p.id === packId) || ADDON_PACKS[0];
                const minutes = eventObj.metadata?.minutes
                  ? parseInt(eventObj.metadata.minutes, 10)
                  : pack.minutes;
                await billingStore.addPurchasedCredits(
                  userId,
                  periodKey,
                  minutes,
                  0,
                  paymentId
                );
              }
            }

            const packId = eventObj.metadata?.packId;
            const pack = ADDON_PACKS.find((p) => p.id === packId) || ADDON_PACKS[0];
            const amountPaidCents =
              eventObj.total_amount ||
              eventObj.amount_paid ||
              eventObj.amount ||
              (action === "topup" ? pack.priceCents : 900);

            const invoice: BillingInvoice = {
              id: `inv_rec_${Date.now()}`,
              userId,
              providerInvoiceId: paymentId,
              amountPaidCents,
              currency: (eventObj.currency || "usd").toLowerCase(),
              status: "paid",
              invoicePdfUrl: eventObj.invoice_pdf,
              hostedInvoiceUrl: eventObj.invoice_url || eventObj.hosted_invoice_url,
              periodStart: eventObj.service_periods?.[0]?.service_period_start || (eventObj.period_start ? new Date(eventObj.period_start * 1000).toISOString() : new Date().toISOString()),
              periodEnd: eventObj.service_periods?.[0]?.service_period_end || (eventObj.period_end ? new Date(eventObj.period_end * 1000).toISOString() : new Date().toISOString()),
              createdAt: new Date().toISOString()
            };
            await billingStore.saveInvoice(invoice);

            // Re-affirm active status if past_due
            const existing = await billingStore.getSubscriptionByUserId(userId);
            if (existing && existing.status === "past_due") {
              existing.status = "active";
              existing.updatedAt = new Date().toISOString();
              await billingStore.saveSubscription(existing);
            }
          }
          break;
        }

        case "subscription.past_due":
        case "subscription.failed":
        case "subscription.on_hold":
        case "payment.failed":
        case "invoice.payment_failed": {
          const userId =
            eventObj.metadata?.userId ||
            eventObj.customer?.name ||
            eventObj.subscription_details?.metadata?.userId ||
            eventObj.lines?.data?.[0]?.metadata?.userId;
          if (userId) {
            const existing = await billingStore.getSubscriptionByUserId(userId);
            if (existing) {
              existing.status = "past_due";
              existing.updatedAt = new Date().toISOString();
              await billingStore.saveSubscription(existing);
            }
          }
          break;
        }
      }

      await billingStore.recordWebhookEvent(provider, eventId, event.type, "processed");
      return reply.code(200).send({ received: true });
    } catch (processErr: any) {
      app.log.error(processErr);
      await billingStore.recordWebhookEvent(provider, eventId, event.type, "failed");
      return reply.code(500).send({ error: "Failed to process webhook event.", code: "WEBHOOK_PROCESS_ERROR" });
    }
  });

  // 4. GET /billing/subscription — Current user's subscription and entitlements
  app.get("/billing/subscription", async (request, reply) => {
    const user = await authenticateRequest(request, reply);
    if (!user) return;
    const userId = user.id;

    const query = request.query as Record<string, string | undefined> | undefined;
    const sessionId = query?.session_id;

    let subscription = await billingStore.getSubscriptionByUserId(userId);

    // If no active subscription is stored locally, query provider to sync authoritative state
    if (!subscription || (subscription.status !== "active" && subscription.status !== "cancel_at_period_end")) {
      const adapter = getPaymentGatewayAdapter();
      if (typeof adapter.findUserSubscription === "function") {
        try {
          const authSub = await adapter.findUserSubscription(userId, sessionId);
          if (
            authSub &&
            authSub.userId === userId &&
            (authSub.status === "active" || authSub.status === "cancel_at_period_end")
          ) {
            const now = new Date();
            const syncedSub: UserSubscription = {
              id: subscription?.id || `sub_rec_${Date.now()}`,
              userId,
              provider: adapter.providerName as any,
              customerId: authSub.customerId,
              subscriptionId: authSub.subscriptionId,
              planId: authSub.planId,
              status: authSub.status,
              currentPeriodStart: authSub.currentPeriodStart,
              currentPeriodEnd: authSub.currentPeriodEnd,
              cancelAtPeriodEnd: authSub.cancelAtPeriodEnd,
              canceledAt: authSub.canceledAt,
              createdAt: subscription?.createdAt || now.toISOString(),
              updatedAt: now.toISOString()
            };
            await billingStore.saveSubscription(syncedSub);
            subscription = syncedSub;

            app.log.info({
              msg: "Synchronized authoritative subscription directly from payment provider",
              userId,
              subscriptionId: authSub.subscriptionId,
              status: authSub.status
            });
          }
        } catch (syncErr: any) {
          app.log.warn({
            msg: "Provider subscription sync query failed",
            userId,
            error: syncErr.message
          });
        }
      }
    }

    const entitlements = await entitlementService.getUserEntitlements(userId);

    return {
      entitlements,
      subscription
    };
  });

  // 5. GET /billing/invoices — Strictly isolated user billing history
  app.get("/billing/invoices", async (request, reply) => {
    const user = await authenticateRequest(request, reply);
    if (!user) return;
    const userId = user.id;

    const invoices = await billingStore.getInvoicesByUserId(userId);
    return { invoices };
  });

  // 6. POST /billing/cancel — Safe cancellation at period end
  app.post("/billing/cancel", async (request, reply) => {
    const user = await authenticateRequest(request, reply);
    if (!user) return;
    const userId = user.id;

    const subscription = await billingStore.getSubscriptionByUserId(userId);
    if (!subscription || subscription.status === "canceled" || subscription.status === "expired") {
      return reply.code(400).send({
        error: "No active subscription found to cancel.",
        code: "NO_ACTIVE_SUBSCRIPTION"
      });
    }

    if (subscription.cancelAtPeriodEnd) {
      return {
        success: true,
        message: "Subscription is already scheduled to cancel at the end of the billing period.",
        subscription
      };
    }

    try {
      const updated = await getPaymentGatewayAdapter().cancelSubscription(subscription.subscriptionId, true);
      subscription.status = "cancel_at_period_end";
      subscription.cancelAtPeriodEnd = true;
      subscription.canceledAt = updated.canceledAt || new Date().toISOString();
      subscription.updatedAt = new Date().toISOString();

      await billingStore.saveSubscription(subscription);

      return {
        success: true,
        message: "Your subscription has been canceled and will expire at the end of the current billing cycle.",
        subscription
      };
    } catch (err: any) {
      app.log.error(err);
      return reply.code(500).send({
        error: "Failed to cancel subscription with payment provider.",
        code: "CANCEL_FAILED"
      });
    }
  });

  // 7. GET /billing/addons — Available discrete top-up packs
  app.get("/billing/addons", async (_request, _reply) => {
    return {
      packs: ADDON_PACKS,
      notice: "Add-on packs provide additional voice transcription minutes. Available exclusively to Pro subscribers."
    };
  });

  // 8. GET /billing/addon-quote — Server-authoritative quote for slider
  app.get("/billing/addon-quote", async (request, reply) => {
    const user = await authenticateRequest(request, reply);
    if (!user) return;
    const userId = user.id;

    const query = request.query as { packId?: string; index?: string };
    let pack = ADDON_PACKS[0];

    if (query?.packId) {
      const found = ADDON_PACKS.find((p) => p.id === query.packId);
      if (found) pack = found;
    } else if (query?.index !== undefined) {
      const idx = parseInt(query.index, 10);
      if (!isNaN(idx) && idx >= 0 && idx < ADDON_PACKS.length) {
        pack = ADDON_PACKS[idx];
      }
    }

    const entitlements = await entitlementService.getUserEntitlements(userId);
    const subscription = await billingStore.getSubscriptionByUserId(userId);

    return {
      pack,
      priceUsd: pack.priceUsd,
      priceCents: pack.priceCents,
      minutes: pack.minutes,
      isPro: entitlements.isPremium,
      currentPlan: entitlements.planName,
      renewalDate: subscription?.currentPeriodEnd || entitlements.expiresAt || null,
      oneTimePurchase: true,
      proposed: pack.proposed
    };
  });
};

export default billingRoute;
