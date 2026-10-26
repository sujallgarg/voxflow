import dotenv from "dotenv";
dotenv.config();

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildServer } from "./server.js";
import { billingStore } from "./services/billing/billing-store.service.js";
import { entitlementService } from "./services/entitlement.service.js";
import { generateAuthToken } from "./services/auth.service.js";
import { MockPaymentAdapter } from "./services/billing/mock.adapter.js";
import { setPaymentGatewayAdapter } from "./routes/billing.js";
import { createClient } from "@supabase/supabase-js";
import { UserSubscription } from "../../../packages/shared/src/plans.js";

describe("VoxFlow Complete Usage Database Audit & Verification Test Suite", { timeout: 45000 }, () => {
  const app = buildServer();
  const mockGateway = new MockPaymentAdapter("whsec_test_audit_db_12345");

  const SUPABASE_URL = process.env.SUPABASE_URL || "";
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const supabaseClient =
    SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith("https://")
      ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
      : null;

  beforeEach(() => {
    billingStore.resetForTesting();
    setPaymentGatewayAdapter(mockGateway);
  });

  afterAll(async () => {
    // Clean up any test records created in Supabase
    if (supabaseClient) {
      await supabaseClient
        .from("usage_quotas")
        .delete()
        .in("user_id", [
          "a0000000-0000-0000-0000-000000000001",
          "a0000000-0000-0000-0000-000000000002",
          "a0000000-0000-0000-0000-000000000003"
        ]);
    }
  });

  // 1. Initial usage initialized correctly (all zero counters for new period)
  it("Scenario 1: Initial usage is initialized correctly with zero counters", async () => {
    const userId = "usr_init_test_001";
    const period = entitlementService.getCurrentPeriodKey();
    const quota = await billingStore.getUsageQuota(userId, period);

    expect(quota.userId).toBe(userId);
    expect(quota.periodYearMonth).toBe(period);
    expect(quota.voiceTranscriptionsUsed).toBe(0);
    expect(quota.meetingsUsed).toBe(0);
    expect(quota.transcriptionSecondsUsed).toBe(0);
    expect(quota.voiceTypingUsed).toBe(0);
    expect(quota.textCorrectionsUsed).toBe(0);
    expect(quota.meetingSummariesUsed).toBe(0);
  });

  // 2. Successful voice-input operation updates usage correctly
  it("Scenario 2: Successful voice-input operation updates voice_typing and text_corrections counters", async () => {
    const userId = "usr_voice_input_002";
    const token = generateAuthToken(userId);

    const res = await app.inject({
      method: "POST",
      url: "/process",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        transcript: "Meeting summary test transcript.",
        targetLanguage: "en"
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.usage.voiceTypingUsed).toBe(1);
    expect(body.usage.textCorrectionsUsed).toBe(1);

    const quota = await billingStore.getUsageQuota(userId);
    expect(quota.voiceTypingUsed).toBe(1);
    expect(quota.textCorrectionsUsed).toBe(1);
  });

  // 3. Successful transcription records exact duration in seconds and minutes
  it("Scenario 3: Successful transcription records correct duration in seconds and minutes", async () => {
    const userId = "usr_transcribe_dur_003";
    const durationSeconds = 145; // 2 mins 25 secs -> converts to 2.4 minutes used
    const periodKey = entitlementService.getCurrentPeriodKey();

    const commitResult = await entitlementService.consumeQuota(userId, "transcription_seconds", durationSeconds);
    expect(commitResult.allowed).toBe(true);
    expect(commitResult.currentUsage).toBe(2.4);

    const quota = await billingStore.getUsageQuota(userId, periodKey);
    expect(quota.transcriptionSecondsUsed).toBe(145);
    expect(quota.voiceTranscriptionsUsed).toBe(3); // Math.ceil(145 / 60) = 3
  });

  // 4. Successful meeting creation and summary updates intended usage counters independently
  it("Scenario 4: Meeting creation and AI summary counters increment independently", async () => {
    const userId = "usr_meeting_sum_004";
    const periodKey = entitlementService.getCurrentPeriodKey();

    await entitlementService.consumeQuota(userId, "meeting", 1);
    await entitlementService.consumeQuota(userId, "summary", 1);

    const quota = await billingStore.getUsageQuota(userId, periodKey);
    expect(quota.meetingsUsed).toBe(1);
    expect(quota.meetingSummariesUsed).toBe(1);
    expect(quota.voiceTypingUsed).toBe(0);
  });

  // 5. Failed operation does not consume quota
  it("Scenario 5: A failed operation does not consume user quota", async () => {
    const userId = "usr_failed_op_005";
    const token = generateAuthToken(userId);

    const res = await app.inject({
      method: "POST",
      url: "/process",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        transcript: "" // Missing/empty transcript causes 400 validation error
      }
    });

    expect(res.statusCode).toBe(400);

    const quota = await billingStore.getUsageQuota(userId);
    expect(quota.voiceTypingUsed).toBe(0);
    expect(quota.textCorrectionsUsed).toBe(0);
  });

  // 6. Concurrency: Parallel requests cannot exceed quota limits (serialized per-user mutex)
  it("Scenario 6: Concurrent requests cannot exceed quota limits", async () => {
    const userId = "usr_concurrency_006";
    // Set usage to 99 out of 100 limit
    await billingStore.setUsageQuota(userId, entitlementService.getCurrentPeriodKey(), 0, 0, 0, 99);

    // Fire 5 concurrent requests simultaneously
    const results = await Promise.all([
      entitlementService.consumeQuota(userId, "voice_typing", 1),
      entitlementService.consumeQuota(userId, "voice_typing", 1),
      entitlementService.consumeQuota(userId, "voice_typing", 1),
      entitlementService.consumeQuota(userId, "voice_typing", 1),
      entitlementService.consumeQuota(userId, "voice_typing", 1)
    ]);

    const allowed = results.filter((r) => r.allowed);
    const rejected = results.filter((r) => !r.allowed);

    expect(allowed.length).toBe(1); // exactly 1 request permitted to reach limit of 100
    expect(rejected.length).toBe(4); // remaining 4 rejected with USAGE_LIMIT_REACHED
    expect(rejected[0].code).toBe("USAGE_LIMIT_REACHED");

    const quota = await billingStore.getUsageQuota(userId);
    expect(quota.voiceTypingUsed).toBe(100); // exactly 100, never corrupted or exceeded
  });

  // 7. Usage resets correctly at a billing-period boundary
  it("Scenario 7: Usage resets at a new billing period boundary without affecting previous periods", async () => {
    const userId = "usr_period_reset_007";
    const octPeriod = "2026-10";
    const novPeriod = "2026-11";

    // Consume in October
    await billingStore.setUsageQuota(userId, octPeriod, 25, 2, 1500, 80);

    // Read November (new period)
    const novQuota = await billingStore.getUsageQuota(userId, novPeriod);
    expect(novQuota.voiceTypingUsed).toBe(0);
    expect(novQuota.meetingsUsed).toBe(0);

    // October usage remains intact
    const octQuota = await billingStore.getUsageQuota(userId, octPeriod);
    expect(octQuota.voiceTypingUsed).toBe(80);
    expect(octQuota.meetingsUsed).toBe(2);
  });

  // 8. Early subscription renewal preserves current-period usage
  it("Scenario 8: Early subscription renewal preserves current-period consumed usage", async () => {
    const userId = "usr_early_renew_008";
    const token = generateAuthToken(userId);
    const period = entitlementService.getCurrentPeriodKey();

    // Consume 180 of 300 minutes on Pro plan
    await billingStore.setUsageQuota(userId, period, 3, 1, 10800, 250); // 10800s = 180 mins

    const sub: UserSubscription = {
      id: "sub_test_early",
      userId,
      provider: "dodo",
      customerId: "cust_test_early",
      subscriptionId: "dodo_sub_early_123",
      planId: "premium_monthly",
      status: "active",
      currentPeriodStart: new Date(Date.now() - 10 * 86400000).toISOString(),
      currentPeriodEnd: new Date(Date.now() + 20 * 86400000).toISOString(),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await billingStore.saveSubscription(sub);

    // Simulate early renewal webhook payment (extends currentPeriodEnd by 30 days)
    const extendedPeriodEnd = new Date(Date.now() + 50 * 86400000).toISOString();
    const updatedSub = { ...sub, currentPeriodEnd: extendedPeriodEnd, updatedAt: new Date().toISOString() };
    await billingStore.saveSubscription(updatedSub);

    // Verify existing 180 minutes remain consumed and are NOT reset to 0
    const quotaAfterRenewal = await billingStore.getUsageQuota(userId, period);
    expect(quotaAfterRenewal.transcriptionSecondsUsed).toBe(10800);
    expect(quotaAfterRenewal.voiceTypingUsed).toBe(250);

    const entitlements = await entitlementService.getUserEntitlements(userId);
    expect(entitlements.breakdown!.transcriptionMinutes.used).toBe(180);
    expect(entitlements.breakdown!.transcriptionMinutes.remaining).toBe(120); // 300 - 180 = 120 remaining
  });

  // 9. Add-on credits preserve existing usage and enforce strict payment idempotency
  it("Scenario 9: Add-on purchase preserves existing usage and duplicate webhooks do not double grant", async () => {
    const userId = "usr_addon_idemp_009";
    const paymentId = "pay_dodo_addon_test_unique_999";

    // User consumed 70 requests
    await entitlementService.consumeQuota(userId, "voice_typing", 70);

    // Purchase 100 add-on requests
    const firstGrant = await billingStore.addAddonCredits({
      userId,
      quotaType: "voice_typing",
      amount: 100,
      paymentId
    });
    expect(firstGrant.alreadyProcessed).toBe(false);

    // Duplicate webhook with same paymentId
    const secondGrant = await billingStore.addAddonCredits({
      userId,
      quotaType: "voice_typing",
      amount: 100,
      paymentId
    });
    expect(secondGrant.alreadyProcessed).toBe(true);

    // Check available credits: exactly 100, NOT 200
    const available = billingStore.getAvailableAddonCredits(userId, "voice_typing");
    expect(available.total).toBe(100);
    expect(available.remaining).toBe(100);

    // Entitlements should show 30 monthly remaining + 100 addon remaining = 130 total remaining
    const entitlements = await entitlementService.getUserEntitlements(userId);
    expect(entitlements.breakdown!.voiceTyping.used).toBe(70);
    expect(entitlements.breakdown!.voiceTyping.totalRemaining).toBe(130);
  });

  // 10. Database persistence verification on real Supabase instance
  it("Scenario 10: Verified database persistence and reload against public.usage_quotas", async () => {
    if (!supabaseClient) {
      console.warn("Supabase not configured, skipping live database assertion.");
      return;
    }

    const testUserId = "a0000000-0000-0000-0000-000000000001";
    const period = entitlementService.getCurrentPeriodKey();

    // 1. Initial write through billingStore
    await billingStore.setUsageQuota(testUserId, period, 2, 1, 120, 15);

    // 2. Read directly from the Supabase database using raw client
    const { data: dbRow, error } = await supabaseClient
      .from("usage_quotas")
      .select("*")
      .eq("user_id", testUserId)
      .eq("period_year_month", period)
      .single();

    expect(error).toBeNull();
    expect(dbRow).toBeDefined();
    expect(dbRow.user_id).toBe(testUserId);
    expect(dbRow.voice_typing_used).toBe(15);
    expect(dbRow.transcription_seconds_used).toBe(120);
    expect(dbRow.meetings_used).toBe(1);

    // 3. Clear in-memory cache to simulate full application restart
    billingStore.resetForTesting();

    // 4. Fresh read through billingStore must recover the authoritative state from Supabase
    const reloaded = await billingStore.getUsageQuota(testUserId, period);
    expect(reloaded.voiceTypingUsed).toBe(15);
    expect(reloaded.transcriptionSecondsUsed).toBe(120);
    expect(reloaded.meetingsUsed).toBe(1);
  });

  // 11. User isolation: User A cannot read or modify User B's quota
  it("Scenario 11: Cross-user quota isolation", async () => {
    const userA = "usr_isolation_a_011";
    const userB = "usr_isolation_b_011";

    await entitlementService.consumeQuota(userA, "voice_typing", 40);
    await entitlementService.consumeQuota(userB, "voice_typing", 10);

    const quotaA = await billingStore.getUsageQuota(userA);
    const quotaB = await billingStore.getUsageQuota(userB);

    expect(quotaA.voiceTypingUsed).toBe(40);
    expect(quotaB.voiceTypingUsed).toBe(10);
  });

  // 12. Free vs Pro server limits strictly enforced
  it("Scenario 12: Server strictly enforces 100 request Free limit and allows 1,000 for Pro", async () => {
    const freeUser = "usr_limit_free_012";
    const proUser = "usr_limit_pro_012";

    // Free user consumes up to 100
    await billingStore.setUsageQuota(freeUser, entitlementService.getCurrentPeriodKey(), 0, 0, 0, 100);
    const freeCheck = await entitlementService.consumeQuota(freeUser, "voice_typing", 1);
    expect(freeCheck.allowed).toBe(false);
    expect(freeCheck.code).toBe("USAGE_LIMIT_REACHED");

    // Pro user consumes 101 requests (well within 1,000 allowance)
    const proSub: UserSubscription = {
      id: "sub_pro_limit_test",
      userId: proUser,
      provider: "dodo",
      customerId: "cust_pro_limit",
      subscriptionId: "dodo_sub_pro_123",
      planId: "premium_monthly",
      status: "active",
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await billingStore.saveSubscription(proSub);
    await billingStore.setUsageQuota(proUser, entitlementService.getCurrentPeriodKey(), 0, 0, 0, 100);

    const proCheck = await entitlementService.consumeQuota(proUser, "voice_typing", 1);
    expect(proCheck.allowed).toBe(true);
    expect(proCheck.currentUsage).toBe(101);
  });
});
