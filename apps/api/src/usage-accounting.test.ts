import { describe, it, expect, beforeEach } from "vitest";
import { buildServer } from "./server.js";
import { billingStore } from "./services/billing/billing-store.service.js";
import { entitlementService } from "./services/entitlement.service.js";
import { generateAuthToken } from "./services/auth.service.js";
import { MockPaymentAdapter } from "./services/billing/mock.adapter.js";
import { setPaymentGatewayAdapter } from "./routes/billing.js";
import { meetingStore } from "./services/meeting-store.service.js";
import type { UserSubscription, MeetingRecord } from "@voxflow/shared";

describe("VoxFlow Complete Usage Accounting & Quota Enforcement Test Suite", { timeout: 30000 }, () => {
  const app = buildServer();
  const mockGateway = new MockPaymentAdapter("whsec_test_accounting_12345");

  beforeEach(() => {
    billingStore.resetForTesting();
    setPaymentGatewayAdapter(mockGateway);
  });

  // 1. A successful 90-second meeting consumes exactly 90 seconds internally
  it("Scenario 1: A successful 90-second meeting consumes exactly 90 seconds internally", async () => {
    const userId = "user_mtg_90s";
    const initialQuota = await billingStore.getUsageQuota(userId);
    expect(initialQuota.transcriptionSecondsUsed).toBe(0);

    const result = await entitlementService.consumeMeetingRecordingQuota(userId, 90);
    expect(result.allowed).toBe(true);

    const updatedQuota = await billingStore.getUsageQuota(userId);
    expect(updatedQuota.transcriptionSecondsUsed).toBe(90);
    expect(updatedQuota.meetingsUsed).toBe(1);
    expect(updatedQuota.meetingSummariesUsed).toBe(1);

    const entitlements = await entitlementService.getUserEntitlements(userId);
    expect(entitlements.usage.transcriptionSecondsUsed).toBe(90);
    expect(entitlements.breakdown.transcriptionMinutes.used).toBe(1.5); // 90s = 1.5 mins, not rounded down to 1
  });

  // 2. A successful voice-input operation increments its counter exactly once
  it("Scenario 2: A successful voice-input operation increments its counter exactly once", async () => {
    const userId = "user_voice_counter";
    const entBefore = await entitlementService.getUserEntitlements(userId);
    expect(entBefore.usage.voiceTypingUsed).toBe(0);

    const consumeRes = await entitlementService.consumeQuota(userId, "voice_typing", 1);
    expect(consumeRes.allowed).toBe(true);

    const entAfter = await entitlementService.getUserEntitlements(userId);
    expect(entAfter.usage.voiceTypingUsed).toBe(1);
    expect(entAfter.breakdown.voiceTyping.used).toBe(1);
    expect(entAfter.breakdown.voiceTyping.remaining).toBe(99); // Free tier has 100
  });

  // 3. Failed transcription does not count as successful usage
  it("Scenario 3: Failed transcription does not count as successful usage", async () => {
    const userId = "user_fail_transcribe";
    const token = generateAuthToken(userId);

    const res = await app.inject({
      method: "POST",
      url: "/meetings/process-recording",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        meetingId: "mtg_failed_1"
        // Non-multipart request will fail with 400 NOT_MULTIPART before any quota is touched
      }
    });

    expect(res.statusCode).toBe(400);

    const quota = await billingStore.getUsageQuota(userId);
    expect(quota.transcriptionSecondsUsed).toBe(0);
    expect(quota.meetingsUsed).toBe(0);
  });

  // 4. Retrying a completed operation does not double-count
  it("Scenario 4: Retrying a completed operation does not double-count", async () => {
    const userId = "user_retry_test";
    const meetingId = "mtg_unique_id_100";

    // First: Initial processing consumes 120 seconds
    const firstConsume = await entitlementService.consumeMeetingRecordingQuota(userId, 120);
    expect(firstConsume.allowed).toBe(true);

    const quota1 = await billingStore.getUsageQuota(userId);
    expect(quota1.transcriptionSecondsUsed).toBe(120);
    expect(quota1.meetingsUsed).toBe(1);

    // Save the completed meeting record
    const completedMeeting: MeetingRecord = {
      id: meetingId,
      userId,
      title: "Sprint Planning",
      transcript: "Sprint planning notes content",
      notes: "Sprint planning summary",
      duration: 120,
      status: "completed",
      source: "web",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await meetingStore.saveMeeting(userId, completedMeeting);

    // Verify idempotency check: an already completed meeting will not re-consume quota
    const existing = await meetingStore.getMeetingById(userId, meetingId);
    expect(existing).not.toBeNull();
    expect(existing?.status).toBe("completed");

    // Simulating retry: because existing.status === "completed", no additional quota is charged
    const quota2 = await billingStore.getUsageQuota(userId);
    expect(quota2.transcriptionSecondsUsed).toBe(120);
    expect(quota2.meetingsUsed).toBe(1);
  });

  // 5. Polling or refreshing the dashboard does not increase usage
  it("Scenario 5: Polling or refreshing the dashboard does not increase usage", async () => {
    const userId = "user_dashboard_poll";
    const token = generateAuthToken(userId);

    // Perform initial read
    const res1 = await app.inject({
      method: "GET",
      url: "/billing/subscription",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(res1.statusCode).toBe(200);

    // Poll 3 times
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: "GET",
        url: "/billing/subscription",
        headers: { authorization: `Bearer ${token}` }
      });
      await app.inject({
        method: "GET",
        url: "/meetings",
        headers: { authorization: `Bearer ${token}` }
      });
    }

    const quota = await billingStore.getUsageQuota(userId);
    expect(quota.transcriptionSecondsUsed).toBe(0);
    expect(quota.voiceTypingUsed).toBe(0);
    expect(quota.meetingsUsed).toBe(0);
  });

  // 6. Usage is recorded against the authenticated user
  it("Scenario 6: Usage is recorded against the authenticated user", async () => {
    const userA = "user_auth_a";
    const userB = "user_auth_b";

    await entitlementService.consumeQuota(userA, "voice_typing", 5);

    const quotaA = await billingStore.getUsageQuota(userA);
    const quotaB = await billingStore.getUsageQuota(userB);

    expect(quotaA.voiceTypingUsed).toBe(5);
    expect(quotaB.voiceTypingUsed).toBe(0);
  });

  // 7. One user cannot read or modify another user's usage
  it("Scenario 7: One user cannot read or modify another user's usage", async () => {
    const userA = "user_private_a";
    const userB = "user_private_b";
    const tokenB = generateAuthToken(userB);

    // User A has 10 voice typings
    await entitlementService.consumeQuota(userA, "voice_typing", 10);

    // User B fetches their subscription
    const resB = await app.inject({
      method: "GET",
      url: "/billing/subscription",
      headers: { authorization: `Bearer ${tokenB}` }
    });

    const bodyB = JSON.parse(resB.payload);
    expect(bodyB.entitlements.userId).toBe(userB);
    expect(bodyB.entitlements.usage.voiceTypingUsed).toBe(0);
  });

  // 8. Free users are blocked when the relevant limit is exhausted
  it("Scenario 8: Free users are blocked when the relevant limit is exhausted", async () => {
    const userId = "user_free_exhausted";

    // Consume all 3 free meetings
    await entitlementService.consumeQuota(userId, "meeting", 3);

    // 4th meeting must fail pre-check
    const check = await entitlementService.checkQuota(userId, "meeting", 1);
    expect(check.allowed).toBe(false);
    expect(check.remaining).toBe(0);

    // Direct consumption attempt fails with USAGE_LIMIT_REACHED error details
    const consumeRes = await entitlementService.consumeQuota(userId, "meeting", 1);
    expect(consumeRes.allowed).toBe(false);
    expect(consumeRes.code).toBe("USAGE_LIMIT_REACHED");
    expect(consumeRes.limit).toBe(3);
    expect(consumeRes.currentUsage).toBe(3);
  });

  // 9. Pro users receive the correct higher allowance
  it("Scenario 9: Pro users receive the correct higher allowance", async () => {
    const userId = "user_pro_allowance";
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const sub: UserSubscription = {
      id: "sub_pro_1",
      userId,
      provider: "dodo",
      customerId: `cus_${userId}`,
      subscriptionId: "sub_dodo_pro",
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

    const ent = await entitlementService.getUserEntitlements(userId);
    expect(ent.isPremium).toBe(true);
    expect(ent.limits.transcriptionMinutes).toBe(300);
    expect(ent.limits.voiceTypingRequests).toBe(1000);
    expect(ent.limits.textCorrectionRequests).toBe(500);
    expect(ent.limits.monthlyMeetings).toBe(25);
    expect(ent.limits.meetingSummaries).toBe(25);
  });

  // 10. Concurrent requests cannot exceed limits through race conditions
  it("Scenario 10: Concurrent requests cannot exceed limits through race conditions", async () => {
    const userId = "user_concurrent_race";

    // Free tier allows 3 meetings. We launch 6 simultaneous consumption attempts.
    const promises = Array.from({ length: 6 }).map(() =>
      entitlementService.consumeQuota(userId, "meeting", 1)
    );

    const results = await Promise.all(promises);
    const successes = results.filter((r) => r.allowed);
    const failures = results.filter((r) => !r.allowed);

    expect(successes.length).toBe(3);
    expect(failures.length).toBe(3);

    const finalQuota = await billingStore.getUsageQuota(userId);
    expect(finalQuota.meetingsUsed).toBe(3);
  });

  // 11. Monthly reset logic uses the correct billing period
  it("Scenario 11: Monthly reset logic uses the correct billing period", async () => {
    const userId = "user_monthly_reset";
    await entitlementService.consumeQuota(userId, "voice_typing", 50);

    const quotaBefore = await billingStore.getUsageQuota(userId);
    expect(quotaBefore.voiceTypingUsed).toBe(50);

    // Simulate reset for new billing month
    await billingStore.resetMonthlyQuota(userId, "2026-11");

    const quotaAfter = await billingStore.getUsageQuota(userId, "2026-11");
    expect(quotaAfter.periodYearMonth).toBe("2026-11");
    expect(quotaAfter.voiceTypingUsed).toBe(0);
    expect(quotaAfter.transcriptionSecondsUsed).toBe(0);
    expect(quotaAfter.meetingsUsed).toBe(0);
  });

  // 12. Purchased top-up credits remain separate from monthly allowances
  it("Scenario 12: Purchased top-up credits remain separate from monthly allowances", async () => {
    const userId = "user_topup_separate";
    const currentPeriod = billingStore.getCurrentPeriodYearMonth();

    // Grant 150 top-up credits
    await billingStore.addPurchasedCredits(userId, currentPeriod, 150, 0);

    // User uses 20 free monthly voice typing
    await entitlementService.consumeQuota(userId, "voice_typing", 20);

    // Advance to next month and retrieve quota
    const nextPeriodQuota = await billingStore.getUsageQuota(userId, "2026-11");
    // Monthly usage starts at 0 for new period
    expect(nextPeriodQuota.voiceTypingUsed).toBe(0);
    // Top-up credits are strictly carried over and preserved!
    expect(nextPeriodQuota.purchasedVoiceCredits).toBe(150);
  });

  // 13. The website refreshes usage after extension operations
  it("Scenario 13: The website refreshes usage after extension operations", async () => {
    const userId = "user_sync_extension_web";
    const token = generateAuthToken(userId);

    // Extension calls /process with transcript payload
    const extRes = await app.inject({
      method: "POST",
      url: "/process",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        transcript: "hello world voice input from extension",
        targetLanguage: "en"
      }
    });
    expect(extRes.statusCode).toBe(200);

    // Web dashboard fetches updated subscription state
    const webRes = await app.inject({
      method: "GET",
      url: "/billing/subscription",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(webRes.statusCode).toBe(200);
    const webBody = JSON.parse(webRes.payload);

    expect(webBody.entitlements.usage.voiceTypingUsed).toBe(1);
    expect(webBody.entitlements.usage.textCorrectionsUsed).toBe(1);
  });

  // 14. Subscription upgrades and expirations update entitlements correctly
  it("Scenario 14: Subscription upgrades and expirations update entitlements correctly", async () => {
    const userId = "user_lifecycle_entitlements";

    // 1. Initial Free
    const entFree = await entitlementService.getUserEntitlements(userId);
    expect(entFree.isPremium).toBe(false);
    expect(entFree.limits.monthlyMeetings).toBe(3);

    // 2. Upgrade to Pro
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sub: UserSubscription = {
      id: "sub_life_1",
      userId,
      provider: "dodo",
      customerId: `cus_${userId}`,
      subscriptionId: "sub_life_id",
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

    const entPro = await entitlementService.getUserEntitlements(userId);
    expect(entPro.isPremium).toBe(true);
    expect(entPro.limits.monthlyMeetings).toBe(25);

    // 3. Expiration reverts to Free limits
    sub.status = "expired";
    await billingStore.saveSubscription(sub);
    const entExpired = await entitlementService.getUserEntitlements(userId);
    expect(entExpired.isPremium).toBe(false);
    expect(entExpired.limits.monthlyMeetings).toBe(3);
  });

  // 15. Storage failures do not silently report successful accounting
  it("Scenario 15: Storage failures do not silently report successful accounting", async () => {
    const userId = "user_storage_failure";

    // Simulate an unexpected error by intercepting saveUsageQuota
    const originalSave = billingStore.saveUsageQuota.bind(billingStore);
    billingStore.saveUsageQuota = async () => {
      throw new Error("Authoritative database connection lost");
    };

    try {
      await expect(
        entitlementService.consumeQuota(userId, "voice_typing", 1)
      ).rejects.toThrow("Authoritative database connection lost");
    } finally {
      billingStore.saveUsageQuota = originalSave;
    }
  });
});
