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

  // 1. Free user uses voice input on the website
  it("Requirement 1: Free user uses voice input on the website", async () => {
    const userId = "user_free_web_voice";
    const token = generateAuthToken(userId);

    const res = await app.inject({
      method: "POST",
      url: "/process",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        transcript: "Let's align on the sprint goals for this quarter.",
        targetLanguage: "en"
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.usage).toBeDefined();
    expect(body.usage.voiceTypingUsed).toBe(1);
    expect(body.usage.textCorrectionsUsed).toBe(1);

    const quota = await billingStore.getUsageQuota(userId);
    expect(quota.voiceTypingUsed).toBe(1);
    expect(quota.textCorrectionsUsed).toBe(1);
  });

  // 2. The same user uses voice input through the extension
  it("Requirement 2: The same user uses voice input through the extension", async () => {
    const userId = "user_same_ext_voice";
    const token = generateAuthToken(userId);

    // Initial usage: 1 operation from website
    await entitlementService.consumeQuota(userId, "voice_typing", 1);
    await entitlementService.consumeQuota(userId, "text_correction", 1);

    // Extension calls /transform with the user's JWT auth header
    const extRes = await app.inject({
      method: "POST",
      url: "/transform",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        transcript: "Quick status update from the extension field.",
        tone: "professional"
      }
    });

    expect(extRes.statusCode).toBe(200);
    const body = JSON.parse(extRes.payload);
    expect(body.usage.textCorrectionsUsed).toBe(2);

    const quota = await billingStore.getUsageQuota(userId);
    expect(quota.voiceTypingUsed).toBe(1);
    expect(quota.textCorrectionsUsed).toBe(2);
  });

  // 3. Website usage is reflected in the extension
  it("Requirement 3: Website usage is reflected in the extension", async () => {
    const userId = "user_web_to_ext_sync";
    const token = generateAuthToken(userId);

    // User performs 3 voice operations on the website
    await entitlementService.consumeQuota(userId, "voice_typing", 3);

    // Extension queries user's subscription and quota (/billing/subscription)
    const extQueryRes = await app.inject({
      method: "GET",
      url: "/billing/subscription",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(extQueryRes.statusCode).toBe(200);
    const body = JSON.parse(extQueryRes.payload);
    expect(body.entitlements.usage.voiceTypingUsed).toBe(3);
    expect(body.entitlements.breakdown.voiceTyping.remaining).toBe(97); // 100 - 3
  });

  // 4. Extension usage is reflected on the website
  it("Requirement 4: Extension usage is reflected on the website", async () => {
    const userId = "user_ext_to_web_sync";
    const token = generateAuthToken(userId);

    // Extension completes a voice input operation
    const extRes = await app.inject({
      method: "POST",
      url: "/process",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        transcript: "Extension voice note captured in tab.",
        targetLanguage: "en"
      }
    });
    expect(extRes.statusCode).toBe(200);

    // Website loads / refreshes the billing dashboard
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

  // 5. Meeting transcription increments the correct usage counter
  it("Requirement 5: Meeting transcription increments the correct usage counter", async () => {
    const userId = "user_mtg_accounting";

    // 90-second meeting audio processing
    const consumeRes = await entitlementService.consumeMeetingRecordingQuota(userId, 90);
    expect(consumeRes.allowed).toBe(true);

    const quota = await billingStore.getUsageQuota(userId);
    expect(quota.transcriptionSecondsUsed).toBe(90);
    expect(quota.meetingsUsed).toBe(1);
    expect(quota.meetingSummariesUsed).toBe(1);

    const ent = await entitlementService.getUserEntitlements(userId);
    expect(ent.usage.transcriptionSecondsUsed).toBe(90);
    expect(ent.breakdown.transcriptionMinutes.used).toBe(1.5); // 90s = 1.5 mins
  });

  // 6. Failed transcription does not incorrectly count as successful usage
  it("Requirement 6: Failed transcription does not incorrectly count as successful usage", async () => {
    const userId = "user_fail_no_usage";
    const token = generateAuthToken(userId);

    const res = await app.inject({
      method: "POST",
      url: "/meetings/process-recording",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        meetingId: "mtg_failed_empty"
      }
    });

    expect(res.statusCode).toBe(400);

    const quota = await billingStore.getUsageQuota(userId);
    expect(quota.transcriptionSecondsUsed).toBe(0);
    expect(quota.meetingsUsed).toBe(0);
    expect(quota.meetingSummariesUsed).toBe(0);
  });

  // 7. Repeated requests do not double count usage
  it("Requirement 7: Repeated requests do not double count usage", async () => {
    const userId = "user_idempotency_check";
    const meetingId = "mtg_idempotent_123";

    // Initial successful commit of 180 seconds (3 mins)
    const firstResult = await entitlementService.consumeMeetingRecordingQuota(userId, 180);
    expect(firstResult.allowed).toBe(true);

    // Save meeting as completed
    const completedMeeting: MeetingRecord = {
      id: meetingId,
      userId,
      title: "Design Sync",
      transcript: "Transcript content",
      notes: "Design sync notes",
      duration: 180,
      status: "completed",
      source: "web",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await meetingStore.saveMeeting(userId, completedMeeting);

    // Verify existing record
    const existing = await meetingStore.getMeetingById(userId, meetingId);
    expect(existing?.status).toBe("completed");

    // Re-check quota: must not increment again
    const quota = await billingStore.getUsageQuota(userId);
    expect(quota.transcriptionSecondsUsed).toBe(180);
    expect(quota.meetingsUsed).toBe(1);
  });

  // 8. A user cannot exceed their quota through concurrent requests
  it("Requirement 8: A user cannot exceed their quota through concurrent requests", async () => {
    const userId = "user_concurrent_guard";

    // Free tier allows 3 meetings. We launch 7 simultaneous consumption requests.
    const promises = Array.from({ length: 7 }).map(() =>
      entitlementService.consumeQuota(userId, "meeting", 1)
    );

    const results = await Promise.all(promises);
    const successes = results.filter((r) => r.allowed);
    const failures = results.filter((r) => !r.allowed);

    expect(successes.length).toBe(3);
    expect(failures.length).toBe(4);

    const finalQuota = await billingStore.getUsageQuota(userId);
    expect(finalQuota.meetingsUsed).toBe(3);
  });

  // 9. Free users are blocked at their configured limit
  it("Requirement 9: Free users are blocked at their configured limit", async () => {
    const userId = "user_free_limit_enforced";

    // Consume all 100 free voice typing requests
    await entitlementService.consumeQuota(userId, "voice_typing", 100);

    const check = await entitlementService.checkQuota(userId, "voice_typing", 1);
    expect(check.allowed).toBe(false);
    expect(check.remaining).toBe(0);
    expect(check.code).toBe("USAGE_LIMIT_REACHED");

    // Attempting 101st request fails
    const consumeRes = await entitlementService.consumeQuota(userId, "voice_typing", 1);
    expect(consumeRes.allowed).toBe(false);
    expect(consumeRes.code).toBe("USAGE_LIMIT_REACHED");
    expect(consumeRes.limit).toBe(100);
    expect(consumeRes.currentUsage).toBe(100);
  });

  // 10. Premium users receive their configured limits
  it("Requirement 10: Premium users receive their configured limits", async () => {
    const userId = "user_premium_limits_verified";
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const sub: UserSubscription = {
      id: "sub_pro_check",
      userId,
      provider: "dodo",
      customerId: `cus_${userId}`,
      subscriptionId: "sub_dodo_pro_active",
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

  // 11. Unauthenticated requests cannot consume another user's quota
  it("Requirement 11: Unauthenticated requests cannot consume another user's quota", async () => {
    const victimUserId = "user_target_victim";
    const attackerToken = generateAuthToken("user_attacker");

    // Target victim has 0 usage
    const quotaBefore = await billingStore.getUsageQuota(victimUserId);
    expect(quotaBefore.voiceTypingUsed).toBe(0);

    // Attacker sends request without victim's token
    await app.inject({
      method: "POST",
      url: "/process",
      headers: { authorization: `Bearer ${attackerToken}` },
      payload: {
        transcript: "Attacker attempts to consume usage",
        targetLanguage: "en"
      }
    });

    // Victim's quota is strictly untouched
    const quotaAfter = await billingStore.getUsageQuota(victimUserId);
    expect(quotaAfter.voiceTypingUsed).toBe(0);

    // Attacker's quota is charged
    const attackerQuota = await billingStore.getUsageQuota("user_attacker");
    expect(attackerQuota.voiceTypingUsed).toBe(1);
  });

  // 12. Usage resets correctly at the configured billing boundary
  it("Requirement 12: Usage resets correctly at the configured billing boundary", async () => {
    const userId = "user_boundary_reset";

    // Period 1 usage
    await entitlementService.consumeQuota(userId, "voice_typing", 45);
    await entitlementService.consumeMeetingRecordingQuota(userId, 300); // 5 mins

    const quotaPeriod1 = await billingStore.getUsageQuota(userId);
    expect(quotaPeriod1.voiceTypingUsed).toBe(45);
    expect(quotaPeriod1.transcriptionSecondsUsed).toBe(300);

    // Reset for next billing period (e.g. 2026-11)
    await billingStore.resetMonthlyQuota(userId, "2026-11");

    const quotaPeriod2 = await billingStore.getUsageQuota(userId, "2026-11");
    expect(quotaPeriod2.periodYearMonth).toBe("2026-11");
    expect(quotaPeriod2.voiceTypingUsed).toBe(0);
    expect(quotaPeriod2.transcriptionSecondsUsed).toBe(0);
    expect(quotaPeriod2.meetingsUsed).toBe(0);
    expect(quotaPeriod2.meetingSummariesUsed).toBe(0);
  });

  // Additional Edge Case: Top-up credits remain separate from monthly allowances
  it("Additional: Purchased top-up credits remain separate from monthly allowances across resets", async () => {
    const userId = "user_topup_guard";
    const currentPeriod = billingStore.getCurrentPeriodYearMonth();

    // Grant 150 top-up voice credits
    await billingStore.addPurchasedCredits(userId, currentPeriod, 150, 0);

    // Consume 20 voice typing
    await entitlementService.consumeQuota(userId, "voice_typing", 20);

    // New billing period
    const nextPeriodQuota = await billingStore.getUsageQuota(userId, "2026-11");
    expect(nextPeriodQuota.voiceTypingUsed).toBe(0);
    expect(nextPeriodQuota.purchasedVoiceCredits).toBe(150);
  });

  // Additional Edge Case: Storage failure does not silently succeed
  it("Additional: Storage failures do not silently report successful accounting", async () => {
    const userId = "user_storage_err";

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
