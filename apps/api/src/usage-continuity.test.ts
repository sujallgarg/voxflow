import { describe, it, expect, beforeEach } from "vitest";
import { buildServer } from "./server.js";
import { billingStore } from "./services/billing/billing-store.service.js";
import { entitlementService } from "./services/entitlement.service.js";
import { generateAuthToken } from "./services/auth.service.js";
import { MockPaymentAdapter } from "./services/billing/mock.adapter.js";
import { setPaymentGatewayAdapter } from "./routes/billing.js";
import type { UserSubscription } from "@voxflow/shared";

describe("VoxFlow Usage Continuity & Quota Accounting Regression Suite", { timeout: 30000 }, () => {
  const app = buildServer();
  const mockGateway = new MockPaymentAdapter("whsec_test_continuity_secret_123");

  beforeEach(() => {
    billingStore.resetForTesting();
    setPaymentGatewayAdapter(mockGateway);
  });

  // Helper to send signed webhook
  async function sendSignedWebhook(eventId: string, type: string, data: any) {
    const payloadObj = {
      id: eventId,
      type,
      data
    };
    const payloadStr = JSON.stringify(payloadObj);
    const dodoHeaders = mockGateway.createSignedDodoWebhookHeaders(payloadStr, eventId);
    return app.inject({
      method: "POST",
      url: "/billing/webhook",
      headers: {
        "content-type": "application/json",
        ...dodoHeaders
      },
      payload: payloadStr
    });
  }

  // 1. Early renewal preserves current-period usage
  it("Requirement 1: Early renewal preserves current-period usage", async () => {
    const userId = "user_early_renewal_preserves_usage";
    const now = new Date();
    const originalEnd = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days left

    // Set up active Pro subscription
    const sub: UserSubscription = {
      id: "sub_rec_1",
      userId,
      provider: "dodo",
      customerId: "cust_rec_1",
      subscriptionId: "sub_dodo_1",
      planId: "premium_monthly",
      status: "active",
      currentPeriodStart: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      currentPeriodEnd: originalEnd.toISOString(),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await billingStore.saveSubscription(sub);

    // User consumes 180 minutes of transcription (180 * 60 seconds)
    const periodKey = entitlementService.getCurrentPeriodKey();
    await billingStore.setUsageQuota(userId, periodKey, 50, 10, 180 * 60);

    // Verify initial consumed usage is 180 minutes (10800s)
    const initialQuota = await billingStore.getUsageQuota(userId, periodKey);
    expect(initialQuota.transcriptionSecondsUsed).toBe(10800);

    // Early renewal payment webhook arrives
    const eventId = "evt_early_ren_req1";
    const paymentId = "pay_early_ren_req1";
    const webhookRes = await sendSignedWebhook(eventId, "payment.succeeded", {
      payment_id: paymentId,
      total_amount: 900,
      currency: "USD",
      metadata: { userId, action: "early_renewal", planId: "premium_monthly" }
    });
    expect(webhookRes.statusCode).toBe(200);

    // Check subscription period was extended
    const updatedSub = await billingStore.getSubscriptionByUserId(userId);
    expect(new Date(updatedSub!.currentPeriodEnd).getTime()).toBeGreaterThan(originalEnd.getTime());

    // CRITICAL: Consumed usage must NOT be reset to 0! It must remain 10800s (180 mins)
    const afterQuota = await billingStore.getUsageQuota(userId, periodKey);
    expect(afterQuota.transcriptionSecondsUsed).toBe(10800);
    expect(afterQuota.voiceTranscriptionsUsed).toBe(50);
    expect(afterQuota.meetingsUsed).toBe(10);

    // Check entitlement calculation reflects continuous usage
    const entitlements = await entitlementService.getUserEntitlements(userId);
    expect(entitlements.breakdown!.transcriptionMinutes.used).toBe(180);
    expect(entitlements.breakdown!.transcriptionMinutes.remaining).toBe(300 - 180); // 120 remaining of 300 base
  });

  // 2. Renewal at the actual period boundary starts the correct new period
  it("Requirement 2: Renewal at the actual period boundary starts the correct new period", async () => {
    const userId = "user_boundary_renewal";
    
    // In period 2026-10, user consumes 150 minutes
    await billingStore.setUsageQuota(userId, "2026-10", 80, 5, 150 * 60);
    const octQuota = await billingStore.getUsageQuota(userId, "2026-10");
    expect(octQuota.transcriptionSecondsUsed).toBe(9000);

    // When next billing month arrives (e.g. 2026-11), recurring quota for 2026-11 starts fresh at 0
    const novQuota = await billingStore.getUsageQuota(userId, "2026-11");
    expect(novQuota.transcriptionSecondsUsed).toBe(0);
    expect(novQuota.voiceTranscriptionsUsed).toBe(0);

    // October historical usage remains intact and immutable
    const preservedOctQuota = await billingStore.getUsageQuota(userId, "2026-10");
    expect(preservedOctQuota.transcriptionSecondsUsed).toBe(9000);
    expect(preservedOctQuota.voiceTranscriptionsUsed).toBe(80);
  });

  // 3. Renewal after expiry follows the defined billing policy
  it("Requirement 3: Renewal after expiry follows the defined billing policy", async () => {
    const userId = "user_renewal_after_expiry";
    const pastStart = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const expiredEnd = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // Expired 5 days ago

    // Expired subscription
    const expiredSub: UserSubscription = {
      id: "sub_exp_3",
      userId,
      provider: "dodo",
      customerId: "cust_exp_3",
      subscriptionId: "sub_expired_3",
      planId: "premium_monthly",
      status: "expired",
      currentPeriodStart: pastStart.toISOString(),
      currentPeriodEnd: expiredEnd.toISOString(),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      createdAt: pastStart.toISOString(),
      updatedAt: expiredEnd.toISOString()
    };
    await billingStore.saveSubscription(expiredSub);

    // User had consumed usage during that past period
    await billingStore.setUsageQuota(userId, "2026-09", 120, 8, 200 * 60);

    // User now pays to renew their subscription
    const eventId = "evt_renew_post_expiry";
    const paymentId = "pay_post_expiry_3";
    const res = await sendSignedWebhook(eventId, "checkout.session.completed", {
      payment_id: paymentId,
      customer: { customer_id: "cust_exp_3" },
      subscription_id: "sub_new_active_3",
      metadata: { userId, planId: "premium_monthly", action: "new" }
    });
    expect(res.statusCode).toBe(200);

    // Subscription is reactivated with fresh period starting now
    const activeSub = await billingStore.getSubscriptionByUserId(userId);
    expect(activeSub?.status).toBe("active");
    expect(new Date(activeSub!.currentPeriodEnd).getTime()).toBeGreaterThan(Date.now());

    // Historical usage record from past period is preserved
    const pastQuota = await billingStore.getUsageQuota(userId, "2026-09");
    expect(pastQuota.transcriptionSecondsUsed).toBe(12000);
  });

  // 4. A usage add-on increases available credits without resetting existing usage
  it("Requirement 4: A usage add-on increases available credits without resetting existing usage", async () => {
    const userId = "user_addon_increase_continuity";
    const periodKey = entitlementService.getCurrentPeriodKey();

    // Free user has 100 voice typing requests included.
    // User has consumed 70 requests.
    await billingStore.setUsageQuota(userId, periodKey, 70, 0, 0, 70);

    const initialEntitlements = await entitlementService.getUserEntitlements(userId);
    expect(initialEntitlements.breakdown!.voiceTyping.used).toBe(70);
    expect(initialEntitlements.breakdown!.voiceTyping.remaining).toBe(30);
    expect(initialEntitlements.breakdown!.voiceTyping.totalRemaining).toBe(30);

    // User purchases an add-on of 100 voice-typing requests
    const eventId = "evt_addon_topup_4";
    const paymentId = "pay_addon_topup_4";
    const topupRes = await sendSignedWebhook(eventId, "payment.succeeded", {
      payment_id: paymentId,
      total_amount: 500,
      currency: "USD",
      metadata: {
        userId,
        action: "topup",
        packId: "addon_requests_100"
      }
    });
    expect(topupRes.statusCode).toBe(200);

    // VERIFICATION:
    // 1. Existing usage consumed must REMAIN 70 (never reset!)
    const currentQuota = await billingStore.getUsageQuota(userId, periodKey);
    expect(currentQuota.voiceTypingUsed).toBe(70);

    // 2. Total remaining should be 30 original remaining + 100 additional = 130 remaining
    const updatedEntitlements = await entitlementService.getUserEntitlements(userId);
    expect(updatedEntitlements.breakdown!.voiceTyping.used).toBe(70);
    expect(updatedEntitlements.breakdown!.voiceTyping.remaining).toBe(30);
    expect(updatedEntitlements.breakdown!.voiceTyping.purchasedCredits).toBe(100);
    expect(updatedEntitlements.breakdown!.voiceTyping.totalRemaining).toBe(130);
  });

  // 5. Duplicate successful payment webhooks do not duplicate credits
  it("Requirement 5: Duplicate successful payment webhooks do not duplicate credits", async () => {
    const userId = "user_dedup_addon_credits";
    const eventId = "evt_dedup_topup_5";
    const paymentId = "pay_dedup_topup_5";

    const payload = {
      payment_id: paymentId,
      total_amount: 500,
      currency: "USD",
      metadata: {
        userId,
        action: "topup",
        packId: "addon_requests_100"
      }
    };

    // First delivery
    const res1 = await sendSignedWebhook(eventId, "payment.succeeded", payload);
    expect(res1.statusCode).toBe(200);

    const available1 = await billingStore.getAvailableAddonCredits(userId, "voice_typing");
    expect(available1.remaining).toBe(100);

    // Redelivery / duplicate delivery with identical eventId & paymentId
    const res2 = await sendSignedWebhook(eventId, "payment.succeeded", payload);
    expect(res2.statusCode).toBe(200);

    // Verify credits were NOT granted twice
    const available2 = await billingStore.getAvailableAddonCredits(userId, "voice_typing");
    expect(available2.remaining).toBe(100);

    // Even if eventId differs (e.g. gateway re-dispatches under new event ID for same paymentId)
    const res3 = await sendSignedWebhook("evt_dedup_diff_id_5", "payment.succeeded", payload);
    expect(res3.statusCode).toBe(200);

    const available3 = await billingStore.getAvailableAddonCredits(userId, "voice_typing");
    expect(available3.remaining).toBe(100); // Still exactly 100!
  });

  // 6. Duplicate subscription events do not reset usage
  it("Requirement 6: Duplicate subscription events do not reset usage", async () => {
    const userId = "user_dup_sub_event_no_reset";
    const periodKey = entitlementService.getCurrentPeriodKey();
    await billingStore.setUsageQuota(userId, periodKey, 50, 10, 60 * 60, 50);

    const subId = "sub_dup_6";
    mockGateway.setMockSubscription({
      subscriptionId: subId,
      customerId: "cust_dup_6",
      userId,
      planId: "premium_monthly",
      status: "active",
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      canceledAt: null
    });

    // Deliver subscription.updated webhook
    const eventId = "evt_sub_update_6";
    const res1 = await sendSignedWebhook(eventId, "subscription.updated", {
      subscription_id: subId,
      customer: { customer_id: "cust_dup_6" },
      metadata: { userId }
    });
    expect(res1.statusCode).toBe(200);

    // Deliver duplicate subscription event
    const res2 = await sendSignedWebhook(eventId, "subscription.updated", {
      subscription_id: subId,
      customer: { customer_id: "cust_dup_6" },
      metadata: { userId }
    });
    expect(res2.statusCode).toBe(200);

    // Verify usage is completely intact
    const quota = await billingStore.getUsageQuota(userId, periodKey);
    expect(quota.voiceTypingUsed).toBe(50);
    expect(quota.transcriptionSecondsUsed).toBe(3600);
  });

  // 7. Out-of-order webhook events cannot roll back newer subscription state
  it("Requirement 7: Out-of-order webhook events cannot roll back newer subscription state", async () => {
    const userId = "user_out_of_order_protection";
    const now = new Date();
    const extendedEnd = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000); // Day 45
    const olderEnd = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // Day 15

    // Current state has extended period end
    const currentSub: UserSubscription = {
      id: "sub_current_7",
      userId,
      provider: "dodo",
      customerId: "cust_7",
      subscriptionId: "sub_7",
      planId: "premium_monthly",
      status: "active",
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: extendedEnd.toISOString(),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    await billingStore.saveSubscription(currentSub);

    // Stale/out-of-order webhook attempts to overwrite subscription with older period end
    const staleSub: UserSubscription = {
      id: "sub_current_7",
      userId,
      provider: "dodo",
      customerId: "cust_7",
      subscriptionId: "sub_7",
      planId: "premium_monthly",
      status: "active",
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: olderEnd.toISOString(),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    await billingStore.saveSubscription(staleSub);

    // Verify period end was protected against rollback
    const verifiedSub = await billingStore.getSubscriptionByUserId(userId);
    expect(new Date(verifiedSub!.currentPeriodEnd).getTime()).toBe(extendedEnd.getTime());
  });

  // 8. Failed payments do not grant credits or extend access
  it("Requirement 8: Failed payments do not grant credits or extend access", async () => {
    const userId = "user_failed_payment_guard";
    const initialEnd = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

    const sub: UserSubscription = {
      id: "sub_fail_8",
      userId,
      provider: "dodo",
      customerId: "cust_fail_8",
      subscriptionId: "sub_fail_8",
      planId: "premium_monthly",
      status: "active",
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: initialEnd.toISOString(),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await billingStore.saveSubscription(sub);

    // Webhook delivers payment.failed
    const eventId = "evt_pay_failed_8";
    const res = await sendSignedWebhook(eventId, "payment.failed", {
      payment_id: "pay_failed_8",
      total_amount: 900,
      currency: "USD",
      metadata: { userId, action: "early_renewal", planId: "premium_monthly" }
    });
    expect(res.statusCode).toBe(200);

    // Subscription periodEnd was NOT extended
    const postSub = await billingStore.getSubscriptionByUserId(userId);
    expect(new Date(postSub!.currentPeriodEnd).getTime()).toBe(initialEnd.getTime());

    // No addon credits granted
    const credits = await billingStore.getAvailableAddonCredits(userId, "voice_typing");
    expect(credits.remaining).toBe(0);
  });

  // 9. Concurrent usage requests cannot exceed quota limits
  it("Requirement 9: Concurrent usage requests cannot exceed quota limits", async () => {
    const userId = "user_concurrent_limits";
    const periodKey = entitlementService.getCurrentPeriodKey();

    // Free tier includes 100 voice typing requests.
    // Set usage to 98 consumed. Exactly 2 requests left!
    await billingStore.setUsageQuota(userId, periodKey, 98, 0, 0, 98);

    // Launch 5 concurrent consumption attempts of 1 unit each
    const attempts = await Promise.all(
      Array.from({ length: 5 }).map(() =>
        entitlementService.consumeQuota(userId, "voice_typing", 1)
      )
    );

    // Exactly 2 must have succeeded (allowed: true) and 3 must have failed (allowed: false)
    const successful = attempts.filter((result) => result.allowed === true).length;
    const failed = attempts.filter((result) => result.allowed === false).length;

    expect(successful).toBe(2);
    expect(failed).toBe(3);

    // Total consumed must be exactly 100, not 103!
    const quota = await billingStore.getUsageQuota(userId, periodKey);
    expect(quota.voiceTypingUsed).toBe(100);
  });

  // 10. Failed operations do not incorrectly consume usage
  it("Requirement 10: Failed operations do not incorrectly consume usage", async () => {
    const userId = "user_failed_op_no_consume";
    const token = generateAuthToken(userId);
    const periodKey = entitlementService.getCurrentPeriodKey();

    const beforeQuota = await billingStore.getUsageQuota(userId, periodKey);
    const beforeUsed = beforeQuota.voiceTypingUsed;

    // Send invalid request missing required transcript field
    const res = await app.inject({
      method: "POST",
      url: "/process",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        // missing transcript
        targetLanguage: "en"
      }
    });

    expect(res.statusCode).toBe(400);

    // Usage must be completely unchanged
    const afterQuota = await billingStore.getUsageQuota(userId, periodKey);
    expect(afterQuota.voiceTypingUsed).toBe(beforeUsed);
  });

  // 11. An immediate upgrade follows defined allowance policy while preserving usage consumed
  it("Requirement 11: An immediate upgrade follows defined allowance policy while preserving usage consumed", async () => {
    const userId = "user_immediate_upgrade_preserves_usage";
    const periodKey = entitlementService.getCurrentPeriodKey();

    // User starts on Free plan and consumes 8 voice typing requests
    await billingStore.setUsageQuota(userId, periodKey, 8, 0, 0, 8);

    const freeEntitlements = await entitlementService.getUserEntitlements(userId);
    expect(freeEntitlements.planId).toBe("free");
    expect(freeEntitlements.breakdown!.voiceTyping.used).toBe(8);
    expect(freeEntitlements.breakdown!.voiceTyping.limit).toBe(100);
    expect(freeEntitlements.breakdown!.voiceTyping.remaining).toBe(92);

    // User upgrades to Pro immediately
    const eventId = "evt_upgrade_pro_11";
    const paymentId = "pay_upgrade_pro_11";
    const upgradeRes = await sendSignedWebhook(eventId, "checkout.session.completed", {
      payment_id: paymentId,
      customer: { customer_id: "cust_upg_11" },
      subscription_id: "sub_pro_11",
      metadata: { userId, planId: "premium_monthly", action: "new" }
    });
    expect(upgradeRes.statusCode).toBe(200);

    // Check Pro entitlements:
    // Consumed usage of 8 is preserved, limit is now 1000, remaining is 1000 - 8 = 992
    const proEntitlements = await entitlementService.getUserEntitlements(userId);
    expect(proEntitlements.planId).toBe("premium_monthly");
    expect(proEntitlements.breakdown!.voiceTyping.used).toBe(8);
    expect(proEntitlements.breakdown!.voiceTyping.limit).toBe(1000);
    expect(proEntitlements.breakdown!.voiceTyping.remaining).toBe(992);
  });

  // 12. Users cannot modify another user's usage or add-on credits
  it("Requirement 12: Users cannot modify another user's usage or add-on credits", async () => {
    const userA = "user_alice_credits";
    const userB = "user_bob_attacker";

    // Grant 100 credits to userA
    await billingStore.addAddonCredits({
      userId: userA,
      quotaType: "voice_typing",
      amount: 100,
      paymentId: "pay_alice_12"
    });

    // Verify User A has 100 credits and User B has 0 credits
    expect((await billingStore.getAvailableAddonCredits(userA, "voice_typing")).remaining).toBe(100);
    expect((await billingStore.getAvailableAddonCredits(userB, "voice_typing")).remaining).toBe(0);

    // User B tries to consume quota using their own session
    await entitlementService.consumeQuota(userB, "voice_typing", 1);

    // User A's add-on credits remain strictly untouched at 100
    expect((await billingStore.getAvailableAddonCredits(userA, "voice_typing")).remaining).toBe(100);
    expect((await billingStore.getAvailableAddonCredits(userB, "voice_typing")).remaining).toBe(0);
  });

  // 13. Frontend refresh displays the persisted backend state
  it("Requirement 13: Frontend refresh displays the persisted backend state", async () => {
    const userId = "user_frontend_refresh_state";
    const token = generateAuthToken(userId);
    const periodKey = entitlementService.getCurrentPeriodKey();

    // Consume 15 voice typing requests and add 50 add-on credits
    await billingStore.setUsageQuota(userId, periodKey, 15, 0, 0, 15);
    await billingStore.addAddonCredits({
      userId,
      quotaType: "voice_typing",
      amount: 50,
      paymentId: "pay_fe_13"
    });

    // Frontend queries /billing/subscription
    const subRes = await app.inject({
      method: "GET",
      url: "/billing/subscription",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(subRes.statusCode).toBe(200);
    const subBody = JSON.parse(subRes.payload);
    expect(subBody.entitlements.breakdown.voiceTyping.used).toBe(15);
    expect(subBody.entitlements.breakdown.voiceTyping.purchasedCredits).toBe(50);
    expect(subBody.entitlements.breakdown.voiceTyping.totalRemaining).toBe(100 - 15 + 50); // 135
    expect(subBody.entitlements.usage.voiceTypingUsed).toBe(15);
  });

  // 14. Different quota types remain independent
  it("Requirement 14: Different quota types remain independent", async () => {
    const userId = "user_independent_quotas";
    const periodKey = entitlementService.getCurrentPeriodKey();

    // Consume 50 voice typing requests
    await entitlementService.consumeQuota(userId, "voice_typing", 50);

    const quota = await billingStore.getUsageQuota(userId, periodKey);
    expect(quota.voiceTypingUsed).toBe(50);
    expect(quota.transcriptionSecondsUsed).toBe(0);
    expect(quota.meetingsUsed).toBe(0);
    expect(quota.textCorrectionsUsed).toBe(0);
    expect(quota.meetingSummariesUsed).toBe(0);

    // Consume 3 meetings
    await entitlementService.consumeQuota(userId, "meeting", 3);
    const quotaAfterMeetings = await billingStore.getUsageQuota(userId, periodKey);
    expect(quotaAfterMeetings.voiceTypingUsed).toBe(50);
    expect(quotaAfterMeetings.meetingsUsed).toBe(3);
    expect(quotaAfterMeetings.transcriptionSecondsUsed).toBe(0);
  });

  // 15. Expiring add-on credits follow the intended expiration policy
  it("Requirement 15: Expiring add-on credits follow the intended expiration policy", async () => {
    const userId = "user_expiring_credits_policy";

    // Grant 1: Expired yesterday (should NOT be counted)
    await billingStore.addAddonCredits({
      userId,
      quotaType: "voice_typing",
      amount: 40,
      paymentId: "pay_expired_15",
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    });

    // Grant 2: Expires in 3 days (earliest unexpired)
    await billingStore.addAddonCredits({
      userId,
      quotaType: "voice_typing",
      amount: 50,
      paymentId: "pay_early_exp_15",
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    });

    // Grant 3: Expires in 30 days
    await billingStore.addAddonCredits({
      userId,
      quotaType: "voice_typing",
      amount: 50,
      paymentId: "pay_late_exp_15",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });

    // Available unexpired credits should be exactly 50 + 50 = 100 (expired 40 is excluded)
    const available = await billingStore.getAvailableAddonCredits(userId, "voice_typing");
    expect(available.remaining).toBe(100);

    // Exhaust base allowance first so consumption draws from add-on credits
    const periodKey = entitlementService.getCurrentPeriodKey();
    await billingStore.setUsageQuota(userId, periodKey, 100, 0, 0, 100); // 100 used of 100 included

    // Consume 30 credits
    const consumed = await entitlementService.consumeQuota(userId, "voice_typing", 30);
    expect(consumed.allowed).toBe(true);

    // Check that consumption drew from Grant 2 (earliest expiry):
    // Available remaining should now be 70
    const remainingAfter = await billingStore.getAvailableAddonCredits(userId, "voice_typing");
    expect(remainingAfter.remaining).toBe(70);

    // Consume another 30 credits (exhausts remainder of Grant 2 and draws 10 from Grant 3)
    const consumed2 = await entitlementService.consumeQuota(userId, "voice_typing", 30);
    expect(consumed2.allowed).toBe(true);
    expect((await billingStore.getAvailableAddonCredits(userId, "voice_typing")).remaining).toBe(40);
  });
});
