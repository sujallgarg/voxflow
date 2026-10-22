import { describe, it, expect, beforeEach } from "vitest";
import { Webhook } from "standardwebhooks";
import { buildServer } from "./server.js";
import { billingStore } from "./services/billing/billing-store.service.js";
import { entitlementService } from "./services/entitlement.service.js";
import { MockPaymentAdapter } from "./services/billing/mock.adapter.js";
import { DodoPaymentAdapter } from "./services/billing/dodo.adapter.js";
import { setPaymentGatewayAdapter } from "./routes/billing.js";
import { generateAuthToken } from "./services/auth.service.js";
import type { UserSubscription, BillingInvoice } from "@voxflow/shared";

describe("VoxFlow Billing & Security Audit Test Suite", { timeout: 30000 }, () => {
  const app = buildServer();
  const mockGateway = new MockPaymentAdapter("test_whsec_secret_key_abcdef123456");

  beforeEach(() => {
    billingStore.resetForTesting();
    setPaymentGatewayAdapter(mockGateway);
  });

  // Test 1: A free user cannot exceed quota or access premium-only limits
  it("Scenario 1: Free user is blocked with USAGE_LIMIT_REACHED once quota is exhausted", async () => {
    const userId = "user_free_test_1";
    const token = generateAuthToken(userId);

    // Free limit is 3 meetings
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/meetings",
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: {
          title: `Meeting ${i + 1}`
        }
      });
      expect(res.statusCode).toBe(201);
    }

    // 4th meeting must be rejected with 403 USAGE_LIMIT_REACHED
    const blockedRes = await app.inject({
      method: "POST",
      url: "/meetings",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        title: "Meeting 4 - Exceeds limit"
      }
    });

    expect(blockedRes.statusCode).toBe(403);
    const body = JSON.parse(blockedRes.payload);
    expect(body.code).toBe("USAGE_LIMIT_REACHED");
    expect(body.upgradeUrl).toBe("#/pricing");
  });

  // Test 2: A verified active subscriber can access the feature and higher limits
  it(
    "Scenario 2: A verified active subscriber can access features within expanded limits",
    async () => {
      const userId = "user_premium_test_2";
      const token = generateAuthToken(userId);

      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const sub: UserSubscription = {
        id: "sub_1",
        userId,
        provider: "mock",
        customerId: `cus_${userId}`,
        subscriptionId: "sub_test_active",
        planId: "premium_monthly",
        status: "active",
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
        cancelAtPeriodEnd: false,
        canceledAt: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };
      await billingStore.saveSubscription(sub);

      // Active subscriber can create beyond the Free tier limit (3) without being blocked
      for (let i = 0; i < 4; i++) {
        const res = await app.inject({
          method: "POST",
          url: "/meetings",
          headers: {
            authorization: `Bearer ${token}`
          },
          payload: {
            title: `Premium Meeting ${i + 1}`
          }
        });
        expect(res.statusCode).toBe(201);
      }

      const ent = await entitlementService.getUserEntitlements(userId);
      expect(ent.isPremium).toBe(true);
      expect(ent.status).toBe("active");
      expect(ent.usage.meetingsUsed).toBe(4);
    },
    15000
  );

  // Test 3: Canceled subscription retains access until period end
  it("Scenario 3: A canceled subscription (cancel_at_period_end) retains access until period end", async () => {
    const userId = "user_cancel_test_3";
    const token = generateAuthToken(userId);

    const now = new Date();
    const futurePeriodEnd = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days left
    const sub: UserSubscription = {
      id: "sub_3",
      userId,
      provider: "mock",
      customerId: `cus_${userId}`,
      subscriptionId: "sub_test_cancel_end",
      planId: "premium_monthly",
      status: "cancel_at_period_end",
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: futurePeriodEnd.toISOString(),
      cancelAtPeriodEnd: true,
      canceledAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    await billingStore.saveSubscription(sub);

    const ent = await entitlementService.getUserEntitlements(userId);
    expect(ent.isPremium).toBe(true);
    expect(ent.status).toBe("cancel_at_period_end");
    expect(ent.cancelAtPeriodEnd).toBe(true);
  });

  // Test 4: Expired subscription loses Premium access immediately
  it("Scenario 4: An expired subscription loses Premium access immediately regardless of client clock", async () => {
    const userId = "user_expired_test_4";

    const now = new Date();
    const pastPeriodEnd = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // Expired 2 days ago
    const sub: UserSubscription = {
      id: "sub_4",
      userId,
      provider: "mock",
      customerId: `cus_${userId}`,
      subscriptionId: "sub_test_expired",
      planId: "premium_monthly",
      status: "active", // Database status had not yet been swept
      currentPeriodStart: new Date(now.getTime() - 32 * 24 * 60 * 60 * 1000).toISOString(),
      currentPeriodEnd: pastPeriodEnd.toISOString(),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    await billingStore.saveSubscription(sub);

    const ent = await entitlementService.getUserEntitlements(userId);
    expect(ent.isPremium).toBe(false);
    expect(ent.status).toBe("expired");
    expect(ent.planId).toBe("free");
  });

  // Test 5: Failed renewal (past_due) updates entitlement correctly
  it("Scenario 5: Failed renewal sets status to past_due and revokes Premium access", async () => {
    const userId = "user_past_due_test_5";

    const now = new Date();
    const sub: UserSubscription = {
      id: "sub_5",
      userId,
      provider: "mock",
      customerId: `cus_${userId}`,
      subscriptionId: "sub_test_past_due",
      planId: "premium_monthly",
      status: "past_due",
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    await billingStore.saveSubscription(sub);

    const ent = await entitlementService.getUserEntitlements(userId);
    expect(ent.isPremium).toBe(false);
    expect(ent.status).toBe("past_due");
  });

  // Test 6: A forged client-side payment-success response grants no access
  it("Scenario 6: Landing on client-side success page or manipulating query parameters grants no Premium access", async () => {
    const userId = "user_attacker_test_6";
    const token = generateAuthToken(userId);

    // Attacker calls GET /billing/subscription directly without authoritative webhook having run
    const res = await app.inject({
      method: "GET",
      url: "/billing/subscription?payment_status=success&session_id=cs_fake_bypass",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.entitlements.isPremium).toBe(false);
    expect(body.entitlements.planId).toBe("free");
    expect(body.subscription).toBeNull();
  });

  // Test 7: Invalid webhook signature is rejected with 400
  it("Scenario 7: Invalid webhook signature is rejected with HTTP 400", async () => {
    const payload = JSON.stringify({
      id: "evt_tampered_1",
      type: "subscription.active",
      data: { object: {} }
    });

    const res = await app.inject({
      method: "POST",
      url: "/billing/webhook",
      headers: {
        "content-type": "application/json",
        "webhook-id": "msg_tampered_1",
        "webhook-timestamp": Math.floor(Date.now() / 1000).toString(),
        "webhook-signature": "v1,bad_forged_signature_hash"
      },
      payload
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("INVALID_WEBHOOK_SIGNATURE");
  });

  // Test 8: Duplicate webhook does not duplicate processing or billing side effects
  it("Scenario 8: Replayed/duplicate webhook deliveries are safely deduplicated", async () => {
    const userId = "user_webhook_idem_8";
    const eventId = "evt_dedup_unique_888";

    const payloadObj = {
      id: eventId,
      type: "subscription.active",
      data: {
        subscription_id: "sub_webhook_888",
        customer: { customer_id: `cus_${userId}`, name: userId },
        total_amount: 900,
        currency: "USD",
        metadata: { userId, planId: "premium_monthly" }
      }
    };
    const payloadStr = JSON.stringify(payloadObj);
    const dodoHeaders = mockGateway.createSignedDodoWebhookHeaders(payloadStr, eventId);

    // First delivery
    const res1 = await app.inject({
      method: "POST",
      url: "/billing/webhook",
      headers: {
        "content-type": "application/json",
        ...dodoHeaders
      },
      payload: payloadStr
    });
    expect(res1.statusCode).toBe(200);

    // Verify invoice created
    const invoices1 = await billingStore.getInvoicesByUserId(userId);
    expect(invoices1.length).toBe(1);

    // Duplicate delivery
    const res2 = await app.inject({
      method: "POST",
      url: "/billing/webhook",
      headers: {
        "content-type": "application/json",
        ...dodoHeaders
      },
      payload: payloadStr
    });
    expect(res2.statusCode).toBe(200);
    const body2 = JSON.parse(res2.payload);
    expect(body2.deduplicated).toBe(true);

    // Must NOT create a second invoice or duplicate records
    const invoices2 = await billingStore.getInvoicesByUserId(userId);
    expect(invoices2.length).toBe(1);
  });

  // Test 9: Two simultaneous checkout requests do not create duplicate billable subscriptions
  it("Scenario 9: Rapid concurrent checkout requests lock and reject duplicate sessions", async () => {
    const userId = "user_concurrent_test_9";
    const token = generateAuthToken(userId);

    // Simulate active lock already held
    billingStore.acquireCheckoutLock(userId);

    const res = await app.inject({
      method: "POST",
      url: "/billing/checkout",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        planId: "premium_monthly"
      }
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("CONCURRENT_CHECKOUT");

    billingStore.releaseCheckoutLock(userId);
  });

  // Test 10: Expired or invalid access token cannot manage billing
  it("Scenario 10: Expired or invalid authorization token is rejected from billing endpoints", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/billing/subscription",
      headers: {
        authorization: "Bearer invalid_tampered_token_string"
      }
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("INVALID_AUTH_TOKEN");
  });

  // Test 11: User B cannot view or modify User A's billing records / invoices
  it("Scenario 11: Cross-user billing isolation prevents User B from seeing User A's invoices", async () => {
    const userA = "user_alice_test_11";
    const userB = "user_bob_test_11";

    const tokenA = generateAuthToken(userA);
    const tokenB = generateAuthToken(userB);

    // Save invoice for User A
    const invoiceA: BillingInvoice = {
      id: "inv_alice_private",
      userId: userA,
      providerInvoiceId: "in_dodo_alice_123",
      amountPaidCents: 900,
      currency: "usd",
      status: "paid",
      periodStart: new Date().toISOString(),
      periodEnd: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    await billingStore.saveInvoice(invoiceA);

    // User A fetches invoices
    const resA = await app.inject({
      method: "GET",
      url: "/billing/invoices",
      headers: { authorization: `Bearer ${tokenA}` }
    });
    expect(resA.statusCode).toBe(200);
    const bodyA = JSON.parse(resA.payload);
    expect(bodyA.invoices.length).toBe(1);
    expect(bodyA.invoices[0].userId).toBe(userA);

    // User B fetches invoices: Must be empty
    const resB = await app.inject({
      method: "GET",
      url: "/billing/invoices",
      headers: { authorization: `Bearer ${tokenB}` }
    });
    expect(resB.statusCode).toBe(200);
    const bodyB = JSON.parse(resB.payload);
    expect(bodyB.invoices.length).toBe(0);
  });

  // Test 12: Changing price or plan in request cannot reduce server-authoritative price
  it("Scenario 12: Client cannot tamper with price or submit invalid plan identifiers", async () => {
    const userId = "user_tamper_test_12";
    const token = generateAuthToken(userId);

    const res = await app.inject({
      method: "POST",
      url: "/billing/checkout",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        planId: "free", // Attempt to checkout free plan
        priceUsd: 0.01 // Attempt to manipulate price
      }
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("INVALID_PLAN");
  });

  // Test 13: Usage limits cannot be bypassed through parallel requests
  it("Scenario 13: Parallel concurrent requests enforce atomic quota consumption", async () => {
    const userId = "user_atomic_race_13";
    const quotaPeriod = entitlementService.getCurrentPeriodKey();

    // Fire 10 parallel increments of 1 unit each
    const promises = Array.from({ length: 10 }).map(() =>
      entitlementService.consumeQuota(userId, "meeting", 1)
    );

    const results = await Promise.all(promises);

    // Free tier limit is 3 meetings. Exactly 3 must succeed, 7 must be rejected with USAGE_LIMIT_REACHED
    const allowedCount = results.filter((r) => r.allowed).length;
    const rejectedCount = results.filter((r) => !r.allowed && r.code === "USAGE_LIMIT_REACHED").length;

    expect(allowedCount).toBe(3);
    expect(rejectedCount).toBe(7);

    // Total stored usage must strictly equal 3
    const quota = await billingStore.getUsageQuota(userId, quotaPeriod);
    expect(quota.meetingsUsed).toBe(3);
  });

  // Test 14: Repeated cancellation requests are handled safely
  it("Scenario 14: Repeated cancellation requests are idempotent and do not fail", async () => {
    const userId = "user_repeat_cancel_14";
    const token = generateAuthToken(userId);

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const sub: UserSubscription = {
      id: "sub_14",
      userId,
      provider: "mock",
      customerId: `cus_${userId}`,
      subscriptionId: "sub_test_repeat_cancel",
      planId: "premium_monthly",
      status: "active",
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    await billingStore.saveSubscription(sub);
    mockGateway.setMockSubscription({
      ...sub,
      subscriptionId: sub.subscriptionId
    });

    // First cancel
    const res1 = await app.inject({
      method: "POST",
      url: "/billing/cancel",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(res1.statusCode).toBe(200);
    const body1 = JSON.parse(res1.payload);
    expect(body1.success).toBe(true);

    // Second cancel attempt: Idempotent message
    const res2 = await app.inject({
      method: "POST",
      url: "/billing/cancel",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(res2.statusCode).toBe(200);
    const body2 = JSON.parse(res2.payload);
    expect(body2.message).toContain("already scheduled to cancel");
  });

  // Test 15: Payment provider timeouts do not trigger an unsafe second charge
  it("Scenario 15: Idempotency keys protect checkout from duplicate charges on network retry", async () => {
    const userId = "user_idem_retry_15";
    const token = generateAuthToken(userId);
    const idemKey = "idem_key_network_retry_test_99999";

    const res1 = await app.inject({
      method: "POST",
      url: "/billing/checkout",
      headers: {
        authorization: `Bearer ${token}`,
        "x-idempotency-key": idemKey
      },
      payload: { planId: "premium_monthly" }
    });
    expect(res1.statusCode).toBe(200);
    const body1 = JSON.parse(res1.payload);

    // Retry with the exact same idempotency key (simulating network timeout retry)
    const res2 = await app.inject({
      method: "POST",
      url: "/billing/checkout",
      headers: {
        authorization: `Bearer ${token}`,
        "x-idempotency-key": idemKey
      },
      payload: { planId: "premium_monthly" }
    });
    expect(res2.statusCode).toBe(200);
    const body2 = JSON.parse(res2.payload);

    // Session URLs and identifiers must be identical
    expect(body2.sessionId).toBe(body1.sessionId);
    expect(body2.checkoutUrl).toBe(body1.checkoutUrl);
  });

  // Test 16: Verified payment webhook activates Premium
  it("Scenario 16: Verified payment webhook activates Premium and grants entitlements", async () => {
    const userId = "user_activation_test_16";
    const subId = "sub_act_16";
    const eventId = "evt_act_16";

    // 1. Initially user is Free
    const entBefore = await entitlementService.getUserEntitlements(userId);
    expect(entBefore.isPremium).toBe(false);
    expect(entBefore.planId).toBe("free");

    // 2. Gateway delivers signed subscription.active webhook
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const payloadObj = {
      id: eventId,
      type: "subscription.active",
      data: {
        subscription_id: subId,
        customer: { customer_id: `cus_${userId}`, name: userId },
        total_amount: 900,
        currency: "USD",
        current_period_start: now.toISOString(),
        next_billing_date: periodEnd.toISOString(),
        metadata: { userId, planId: "premium_monthly" }
      }
    };
    const payloadStr = JSON.stringify(payloadObj);
    const dodoHeaders = mockGateway.createSignedDodoWebhookHeaders(payloadStr, eventId);

    const webhookRes = await app.inject({
      method: "POST",
      url: "/billing/webhook",
      headers: {
        "content-type": "application/json",
        ...dodoHeaders
      },
      payload: payloadStr
    });
    expect(webhookRes.statusCode).toBe(200);

    // 3. User is now verified Premium
    const entAfter = await entitlementService.getUserEntitlements(userId);
    expect(entAfter.isPremium).toBe(true);
    expect(entAfter.planId).toBe("premium_monthly");
    expect(entAfter.status).toBe("active");
  });

  // Test 17: Immediate revocation removes Premium entitlement
  it("Scenario 17: Immediate revocation (subscription.cancelled) revokes Premium entitlement", async () => {
    const userId = "user_revoked_test_17";
    const subId = "sub_rev_17";

    // Start with active subscription
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
    const activeSub: UserSubscription = {
      id: "sub_rec_17",
      userId,
      provider: "mock",
      customerId: `cus_${userId}`,
      subscriptionId: subId,
      planId: "premium_monthly",
      status: "active",
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    await billingStore.saveSubscription(activeSub);
    mockGateway.setMockSubscription(activeSub);

    // Webhook delivers subscription.cancelled
    const eventId = "evt_cancelled_17";
    const payloadObj = {
      id: eventId,
      type: "subscription.cancelled",
      data: {
        subscription_id: subId,
        metadata: { userId }
      }
    };
    const payloadStr = JSON.stringify(payloadObj);
    const dodoHeaders = mockGateway.createSignedDodoWebhookHeaders(payloadStr, eventId);

    const webhookRes = await app.inject({
      method: "POST",
      url: "/billing/webhook",
      headers: {
        "content-type": "application/json",
        ...dodoHeaders
      },
      payload: payloadStr
    });
    expect(webhookRes.statusCode).toBe(200);

    // Entitlement must be revoked
    const ent = await entitlementService.getUserEntitlements(userId);
    expect(ent.isPremium).toBe(false);
    expect(ent.status).toBe("canceled");
    expect(ent.planId).toBe("free");
  });

  // Test 18: Out-of-order webhook delivery protection
  it("Scenario 18: Out-of-order webhook delivery does not resurrect a canceled subscription", async () => {
    const userId = "user_ooo_test_18";
    const subId = "sub_ooo_18";

    // 1. Subscription was already canceled
    const now = new Date();
    const canceledSub: UserSubscription = {
      id: "sub_rec_18",
      userId,
      provider: "mock",
      customerId: `cus_${userId}`,
      subscriptionId: subId,
      planId: "premium_monthly",
      status: "canceled",
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      canceledAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    await billingStore.saveSubscription(canceledSub);

    // 2. An older/delayed subscription.updated event arrives
    const eventId = "evt_delayed_update_18";
    const payloadObj = {
      id: eventId,
      type: "subscription.updated",
      data: {
        subscription_id: subId,
        status: "active",
        metadata: { userId }
      }
    };
    const payloadStr = JSON.stringify(payloadObj);
    const dodoHeaders = mockGateway.createSignedDodoWebhookHeaders(payloadStr, eventId);

    const webhookRes = await app.inject({
      method: "POST",
      url: "/billing/webhook",
      headers: {
        "content-type": "application/json",
        ...dodoHeaders
      },
      payload: payloadStr
    });
    expect(webhookRes.statusCode).toBe(200);

    // 3. Status must remain canceled, not resurrected to active
    const stored = await billingStore.getSubscriptionByUserId(userId);
    expect(stored?.status).toBe("canceled");

    const ent = await entitlementService.getUserEntitlements(userId);
    expect(ent.isPremium).toBe(false);
    expect(ent.status).toBe("canceled");
  });

  // Test 21: Pro User exhausts one quota -> non-exhausted feature remains accessible
  it("Scenario 21: Pro User exhausts meeting quota while voice dictation remains unexhausted and active", async () => {
    const userId = "user_pro_isolation_21";
    const token = generateAuthToken(userId);

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sub: UserSubscription = {
      id: "sub_pro_21",
      userId,
      provider: "mock",
      customerId: `cus_${userId}`,
      subscriptionId: "sub_mock_pro_21",
      planId: "premium_monthly",
      status: "active",
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    await billingStore.saveSubscription(sub);

    // Simulate exhausting meetings quota (25 meetings)
    const periodKey = entitlementService.getCurrentPeriodKey();
    await billingStore.setUsageQuota(userId, periodKey, 5, 25);

    // Checking meeting creation should be blocked
    const meetingCheck = await entitlementService.checkFeature(userId, "meeting_creation");
    expect(meetingCheck.allowed).toBe(false);
    expect(meetingCheck.reason).toMatch(/Monthly meeting limit.*reached/);

    // But voice dictation is NOT exhausted and must remain allowed
    const voiceCheck = await entitlementService.checkFeature(userId, "voice_dictation");
    expect(voiceCheck.allowed).toBe(true);

    const entitlements = await entitlementService.getUserEntitlements(userId);
    expect(entitlements.meetings?.isExhausted).toBe(true);
    expect(entitlements.meetings?.remaining).toBe(0);
    expect(entitlements.voice?.isExhausted).toBe(false);
    expect(entitlements.voice?.remaining).toBe(295); // 300 - 5 = 295
    expect(entitlements.resetDate).toBeDefined();
  });

  // Test 22: Pro User early renewal checkout & verified webhook handling
  it("Scenario 22: Pro User executes early renewal, quota resets, and period extends without duplicate subscription", async () => {
    const userId = "user_pro_renewal_22";
    const token = generateAuthToken(userId);

    const now = new Date();
    const originalEnd = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days remaining
    const sub: UserSubscription = {
      id: "sub_pro_22",
      userId,
      provider: "mock",
      customerId: `cus_${userId}`,
      subscriptionId: "sub_mock_pro_22",
      planId: "premium_monthly",
      status: "active",
      currentPeriodStart: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000).toISOString(),
      currentPeriodEnd: originalEnd.toISOString(),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    await billingStore.saveSubscription(sub);

    const periodKey = entitlementService.getCurrentPeriodKey();
    await billingStore.setUsageQuota(userId, periodKey, 2000, 100);

    // 1. Regular checkout must reject active subscriber
    const duplicateRes = await app.inject({
      method: "POST",
      url: "/billing/checkout",
      headers: { authorization: `Bearer ${token}` },
      payload: { planId: "premium_monthly", action: "new" }
    });
    expect(duplicateRes.statusCode).toBe(409);

    // 2. Early renewal checkout must succeed
    const earlyRes = await app.inject({
      method: "POST",
      url: "/billing/checkout",
      headers: { authorization: `Bearer ${token}` },
      payload: { planId: "premium_monthly", action: "early_renewal" }
    });
    expect(earlyRes.statusCode).toBe(200);
    const earlyBody = JSON.parse(earlyRes.payload);
    expect(earlyBody.sessionId).toBeDefined();

    // 3. Simulated verified webhook for early renewal payment
    const eventId = "evt_early_renewal_22";
    const paymentId = "pay_early_22";
    const payloadObj = {
      id: eventId,
      type: "payment.succeeded",
      data: {
        payment_id: paymentId,
        total_amount: 900,
        currency: "USD",
        metadata: { userId, action: "early_renewal", planId: "premium_monthly" }
      }
    };
    const payloadStr = JSON.stringify(payloadObj);
    const dodoHeaders = mockGateway.createSignedDodoWebhookHeaders(payloadStr, eventId);

    const webhookRes = await app.inject({
      method: "POST",
      url: "/billing/webhook",
      headers: {
        "content-type": "application/json",
        ...dodoHeaders
      },
      payload: payloadStr
    });
    expect(webhookRes.statusCode).toBe(200);

    // 4. Verify existing subscription record was updated, NOT duplicated
    const existingSub = await billingStore.getSubscriptionByUserId(userId);
    expect(existingSub?.subscriptionId).toBe("sub_mock_pro_22"); // Preserved subscription ID
    const newEnd = new Date(existingSub!.currentPeriodEnd);
    expect(newEnd.getTime()).toBeGreaterThan(originalEnd.getTime()); // Period extended by 30 days

    // 5. Verify usage quota was reset to 0 so user has fresh quota immediately
    const quota = await billingStore.getUsageQuota(userId, periodKey);
    expect(quota.voiceTranscriptionsUsed).toBe(0);
    expect(quota.meetingsUsed).toBe(0);

    // 6. Verify an invoice for $9 was saved
    const invoices = await billingStore.getInvoicesByUserId(userId);
    expect(invoices.length).toBe(1);
    expect(invoices[0].amountPaidCents).toBe(900);
    expect(invoices[0].providerInvoiceId).toBe(paymentId);
  });

  // Test 23: Duplicate webhooks for early renewal do not grant duplicate renewals or extensions
  it("Scenario 23: Replayed early renewal webhooks are safely deduplicated without duplicate extensions", async () => {
    const userId = "user_pro_dedup_23";
    const now = new Date();
    const originalEnd = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    const sub: UserSubscription = {
      id: "sub_pro_23",
      userId,
      provider: "mock",
      customerId: `cus_${userId}`,
      subscriptionId: "sub_mock_pro_23",
      planId: "premium_monthly",
      status: "active",
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: originalEnd.toISOString(),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    await billingStore.saveSubscription(sub);

    const eventId = "evt_dedup_early_23";
    const payloadObj = {
      id: eventId,
      type: "checkout.session.completed",
      data: {
        payment_id: "pay_dedup_23",
        subscription_id: "sub_mock_pro_23",
        total_amount: 900,
        currency: "USD",
        metadata: { userId, action: "early_renewal", planId: "premium_monthly" }
      }
    };
    const payloadStr = JSON.stringify(payloadObj);
    const dodoHeaders = mockGateway.createSignedDodoWebhookHeaders(payloadStr, eventId);

    // First delivery
    const res1 = await app.inject({
      method: "POST",
      url: "/billing/webhook",
      headers: { "content-type": "application/json", ...dodoHeaders },
      payload: payloadStr
    });
    expect(res1.statusCode).toBe(200);

    const subAfter1 = await billingStore.getSubscriptionByUserId(userId);
    const periodEnd1 = subAfter1!.currentPeriodEnd;

    // Second delivery (replay)
    const res2 = await app.inject({
      method: "POST",
      url: "/billing/webhook",
      headers: { "content-type": "application/json", ...dodoHeaders },
      payload: payloadStr
    });
    expect(res2.statusCode).toBe(200);
    expect(JSON.parse(res2.payload).deduplicated).toBe(true);

    const subAfter2 = await billingStore.getSubscriptionByUserId(userId);
    expect(subAfter2!.currentPeriodEnd).toBe(periodEnd1); // Did not double-extend
  });

  // Test 24: Top-up usage pack accounting & priority
  it("Scenario 24: Additional usage pack top-up grants credits and consumes allowance first", async () => {
    const userId = "user_topup_24";
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sub: UserSubscription = {
      id: "sub_topup_24",
      userId,
      provider: "mock",
      customerId: `cus_${userId}`,
      subscriptionId: "sub_mock_topup_24",
      planId: "premium_monthly",
      status: "active",
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    await billingStore.saveSubscription(sub);

    const periodKey = entitlementService.getCurrentPeriodKey();

    // 1. Webhook grants topup pack (150 transcription minutes)
    const eventId = "evt_topup_24";
    const payloadObj = {
      id: eventId,
      type: "payment.succeeded",
      data: {
        payment_id: "pay_topup_24",
        total_amount: 400,
        currency: "USD",
        metadata: {
          userId,
          action: "topup",
          planId: "premium_monthly",
          packId: "addon_transcription_150",
          minutes: "150"
        }
      }
    };
    const payloadStr = JSON.stringify(payloadObj);
    const dodoHeaders = mockGateway.createSignedDodoWebhookHeaders(payloadStr, eventId);

    const webhookRes = await app.inject({
      method: "POST",
      url: "/billing/webhook",
      headers: { "content-type": "application/json", ...dodoHeaders },
      payload: payloadStr
    });
    expect(webhookRes.statusCode).toBe(200);

    // 2. Verify purchased transcription credits in entitlements
    const entBefore = await entitlementService.getUserEntitlements(userId);
    expect(entBefore.voice?.purchasedCredits).toBe(150);
    expect(entBefore.voice?.totalRemaining).toBe(450); // 300 monthly + 150 top-up

    // 3. Consume all 300 monthly allowance
    await billingStore.setUsageQuota(userId, periodKey, 300, 0);

    // 4. Feature is still allowed because of top-up credits!
    const check1 = await entitlementService.checkFeature(userId, "voice_dictation");
    expect(check1.allowed).toBe(true);

    // 5. Consuming quota now consumes from purchased credits
    const consumeRes = await entitlementService.consumeQuota(userId, "voice", 30);
    expect(consumeRes.allowed).toBe(true);

    const quotaAfter = await billingStore.getUsageQuota(userId, periodKey);
    expect(quotaAfter.usedVoiceCredits).toBe(30);

    const entAfter = await entitlementService.getUserEntitlements(userId);
    expect(entAfter.voice?.remainingCredits).toBe(120);
    expect(entAfter.voice?.totalRemaining).toBe(120);
  });

  // Test 25: Cross-user billing access and early renewal isolation
  it("Scenario 25: Cross-user isolation prevents User B from accessing User A's invoices or renewing User A's subscription", async () => {
    const userA = "user_victim_25a";
    const userB = "user_attacker_25b";
    const tokenB = generateAuthToken(userB);

    const now = new Date();
    const subA: UserSubscription = {
      id: "sub_a",
      userId: userA,
      provider: "mock",
      customerId: `cus_${userA}`,
      subscriptionId: "sub_a_123",
      planId: "premium_monthly",
      status: "active",
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    await billingStore.saveSubscription(subA);

    // Save invoice for User A
    const invA: BillingInvoice = {
      id: "inv_a",
      userId: userA,
      providerInvoiceId: "inv_secret_a",
      amountPaidCents: 900,
      currency: "usd",
      status: "paid",
      periodStart: now.toISOString(),
      periodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now.toISOString()
    };
    await billingStore.saveInvoice(invA);

    // User B attempts to view invoices
    const invoicesRes = await app.inject({
      method: "GET",
      url: "/billing/invoices",
      headers: { authorization: `Bearer ${tokenB}` }
    });
    expect(invoicesRes.statusCode).toBe(200);
    const invoicesBody = JSON.parse(invoicesRes.payload);
    expect(invoicesBody.invoices.length).toBe(0); // User B cannot see User A's invoices

    // User B attempts to early renew without an active subscription
    const earlyRenewRes = await app.inject({
      method: "POST",
      url: "/billing/checkout",
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { planId: "premium_monthly", action: "early_renewal" }
    });
    expect(earlyRenewRes.statusCode).toBe(400);
    expect(JSON.parse(earlyRenewRes.payload).code).toBe("NO_ACTIVE_SUBSCRIPTION");
  });

  // Test 26: Business plan checkout is strictly disabled (Coming Soon)
  it("Scenario 26: Business plan checkout is rejected with PLAN_NOT_AVAILABLE", async () => {
    const userId = "user_biz_test_26";
    const token = generateAuthToken(userId);

    const res = await app.inject({
      method: "POST",
      url: "/billing/checkout",
      headers: { authorization: `Bearer ${token}` },
      payload: { planId: "business_monthly" }
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("PLAN_NOT_AVAILABLE");
  });

  // Test 27: Add-on discrete slider quote endpoint validates server prices
  it("Scenario 27: Slider quote endpoint returns server-authoritative discrete pricing", async () => {
    const userId = "user_slider_quote_27";
    const token = generateAuthToken(userId);

    // Step 0: 60 min -> $2
    const res0 = await app.inject({
      method: "GET",
      url: "/billing/addon-quote?index=0",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(res0.statusCode).toBe(200);
    const body0 = JSON.parse(res0.payload);
    expect(body0.minutes).toBe(60);
    expect(body0.priceUsd).toBe(2);
    expect(body0.oneTimePurchase).toBe(true);

    // Step 1: 150 min -> $4
    const res1 = await app.inject({
      method: "GET",
      url: "/billing/addon-quote?index=1",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(res1.statusCode).toBe(200);
    const body1 = JSON.parse(res1.payload);
    expect(body1.minutes).toBe(150);
    expect(body1.priceUsd).toBe(4);

    // Step 2: 300 min -> $7
    const res2 = await app.inject({
      method: "GET",
      url: "/billing/addon-quote?index=2",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(res2.statusCode).toBe(200);
    const body2 = JSON.parse(res2.payload);
    expect(body2.minutes).toBe(300);
    expect(body2.priceUsd).toBe(7);
  });

  // Test 28: Duplicate webhook does not grant duplicate top-up credits (idempotency)
  it("Scenario 28: Duplicate top-up webhook does not grant duplicate credits", async () => {
    const userId = "user_topup_dedup_28";
    const now = new Date();
    const sub: UserSubscription = {
      id: "sub_topup_28",
      userId,
      provider: "mock",
      customerId: `cus_${userId}`,
      subscriptionId: "sub_mock_topup_28",
      planId: "premium_monthly",
      status: "active",
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    await billingStore.saveSubscription(sub);

    const eventId = "evt_topup_dedup_28";
    const payloadObj = {
      id: eventId,
      type: "payment.succeeded",
      data: {
        payment_id: "pay_topup_dedup_28",
        total_amount: 200,
        currency: "USD",
        metadata: {
          userId,
          action: "topup",
          planId: "premium_monthly",
          packId: "addon_transcription_60",
          minutes: "60"
        }
      }
    };
    const payloadStr = JSON.stringify(payloadObj);
    const dodoHeaders = mockGateway.createSignedDodoWebhookHeaders(payloadStr, eventId);

    // First arrival
    const res1 = await app.inject({
      method: "POST",
      url: "/billing/webhook",
      headers: { "content-type": "application/json", ...dodoHeaders },
      payload: payloadStr
    });
    expect(res1.statusCode).toBe(200);

    // Second arrival (replay / duplicate webhook)
    const res2 = await app.inject({
      method: "POST",
      url: "/billing/webhook",
      headers: { "content-type": "application/json", ...dodoHeaders },
      payload: payloadStr
    });
    expect(res2.statusCode).toBe(200);
    expect(JSON.parse(res2.payload).deduplicated).toBe(true);

    // Credits must strictly be 60, not 120
    const ent = await entitlementService.getUserEntitlements(userId);
    expect(ent.voice?.purchasedCredits).toBe(60);
  });

  // Test 29: Purchased top-up credits are preserved across monthly renewals
  it("Scenario 29: Top-up credits roll over and are preserved across monthly renewals", async () => {
    const userId = "user_rollover_29";
    const pastPeriod = "2026-09";
    const currentPeriod = entitlementService.getCurrentPeriodKey();

    // User had purchased 150 minutes in past month, and used 30
    await billingStore.addPurchasedCredits(userId, pastPeriod, 150, 0);
    await billingStore.incrementUsedCredits(userId, pastPeriod, "voice", 30);

    // In current month, remaining 120 minutes must automatically roll over
    const currentQuota = await billingStore.getUsageQuota(userId, currentPeriod);
    expect(currentQuota.purchasedVoiceCredits).toBe(120);
    expect(currentQuota.usedVoiceCredits).toBe(0);
  });

  // Test 30: Concurrent requests do not overspend quota or credits
  it("Scenario 30: Concurrent requests serialize atomically and do not overspend quota", async () => {
    const userId = "user_concurrent_30";
    const now = new Date();
    const sub: UserSubscription = {
      id: "sub_concurrent_30",
      userId,
      provider: "mock",
      customerId: `cus_${userId}`,
      subscriptionId: "sub_mock_concurrent_30",
      planId: "premium_monthly",
      status: "active",
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    await billingStore.saveSubscription(sub);

    const periodKey = entitlementService.getCurrentPeriodKey();
    // Set user to 298 minutes used out of 300 limit (only 2 minutes remaining)
    await billingStore.setUsageQuota(userId, periodKey, 298, 0);

    // Launch 5 concurrent requests, each asking for 1 minute
    const results = await Promise.all([
      entitlementService.consumeQuota(userId, "voice", 1),
      entitlementService.consumeQuota(userId, "voice", 1),
      entitlementService.consumeQuota(userId, "voice", 1),
      entitlementService.consumeQuota(userId, "voice", 1),
      entitlementService.consumeQuota(userId, "voice", 1)
    ]);

    const allowedCount = results.filter((r) => r.allowed).length;
    const rejectedCount = results.filter((r) => !r.allowed).length;

    // Exactly 2 must succeed, and 3 must be rejected with USAGE_LIMIT_REACHED
    expect(allowedCount).toBe(2);
    expect(rejectedCount).toBe(3);
  });
});

describe("DodoPaymentAdapter Direct Unit Tests", () => {
  const webhookKey = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
  const adapter = new DodoPaymentAdapter({
    apiKey: "test_api_key",
    webhookKey,
    productId: "pdt_premium_monthly",
    environment: "test_mode"
  });

  it("should successfully construct and verify valid Dodo webhook event", () => {
    const wh = new Webhook(webhookKey);
    const eventId = "msg_dodo_test_valid_1";
    const now = new Date();
    const payload = JSON.stringify({
      type: "subscription.active",
      data: {
        subscription_id: "sub_dodo_123",
        customer: { customer_id: "cus_dodo_123" },
        status: "active"
      }
    });

    const sig = wh.sign(eventId, now, payload);
    const event = adapter.constructWebhookEvent(payload, sig, {
      "webhook-id": eventId,
      "webhook-timestamp": Math.floor(now.getTime() / 1000).toString(),
      "webhook-signature": sig
    });

    expect(event.id).toBe(eventId);
    expect(event.type).toBe("subscription.active");
    expect(event.data.object.subscription_id).toBe("sub_dodo_123");
  });

  it("should reject invalid Dodo webhook signature", () => {
    const payload = JSON.stringify({ type: "subscription.active", data: {} });
    expect(() => {
      adapter.constructWebhookEvent(payload, "v1,bad_signature", {
        "webhook-id": "msg_bad",
        "webhook-timestamp": Math.floor(Date.now() / 1000).toString(),
        "webhook-signature": "v1,bad_signature"
      });
    }).toThrow();
  });
});

