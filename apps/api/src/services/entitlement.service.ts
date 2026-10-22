import { billingStore } from "./billing/billing-store.service.js";
import { PLAN_CONFIGS, type PlanId, type UserEntitlements, type SubscriptionStatus } from "@voxflow/shared";

export type FeatureKey =
  | "voice_dictation"
  | "meeting_creation"
  | "meeting_recording_process"
  | "meeting_notes"
  | "advanced_meeting_intelligence"
  | "priority_processing"
  | "markdown_export";

export interface EntitlementCheckResult {
  allowed: boolean;
  code?: "SUBSCRIPTION_REQUIRED" | "USAGE_LIMIT_REACHED" | "SUBSCRIPTION_EXPIRED";
  reason?: string;
  currentUsage?: number;
  limit?: number;
  resetDate?: string;
}

export class EntitlementService {
  /**
   * Helper to get standard monthly key: YYYY-MM in UTC
   */
  getCurrentPeriodKey(): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  /**
   * Calculate end of current month in UTC (when quotas reset)
   */
  getNextQuotaResetDate(): string {
    const now = new Date();
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
    return nextMonth.toISOString();
  }

  /**
   * Resolve authoritative entitlement for a user based on active database records and UTC clock.
   * Client-supplied flags or clocks are NEVER trusted.
   */
  async getUserEntitlements(userId: string): Promise<UserEntitlements> {
    const storedSub = await billingStore.getSubscriptionByUserId(userId);
    const periodKey = this.getCurrentPeriodKey();
    const quota = await billingStore.getUsageQuota(userId, periodKey);

    const now = new Date();
    let isPremium = false;
    let planId: PlanId = "free";
    let status: SubscriptionStatus = "free";
    let expiresAt: string | null = null;
    let cancelAtPeriodEnd = false;

    if (storedSub) {
      const periodEnd = new Date(storedSub.currentPeriodEnd);
      cancelAtPeriodEnd = storedSub.cancelAtPeriodEnd;
      expiresAt = storedSub.currentPeriodEnd;

      // Check if subscription has expired chronologically
      if (storedSub.status === "active" || storedSub.status === "cancel_at_period_end") {
        if (now <= periodEnd) {
          isPremium = true;
          planId = storedSub.planId;
          status = storedSub.status;
        } else {
          // Automatic Expiry: paid period ended
          status = "expired";
          isPremium = false;
          planId = "free";
          storedSub.status = "expired";
          storedSub.updatedAt = now.toISOString();
          void billingStore.saveSubscription(storedSub);
        }
      } else {
        // e.g. past_due, canceled, incomplete
        status = storedSub.status;
        isPremium = false;
        planId = "free";
      }
    }

    const planConfig = PLAN_CONFIGS[planId];

    const voiceLimit = planConfig.limits.transcriptionMinutes ?? planConfig.limits.monthlyVoiceTranscriptions ?? 30;
    const meetingsLimit = planConfig.limits.monthlyMeetings ?? 3;
    const voiceTypingLimit = planConfig.limits.voiceTypingRequests ?? 100;
    const textCorrectionLimit = planConfig.limits.textCorrectionRequests ?? 50;
    const summaryLimit = planConfig.limits.meetingSummaries ?? 3;

    // Transcription seconds and minutes
    const limitSeconds = voiceLimit * 60;
    const usedSeconds = quota.transcriptionSecondsUsed ?? ((quota.voiceTranscriptionsUsed || 0) * 60);
    const usedMinutes = Number((usedSeconds / 60).toFixed(1));

    const voicePurchasedMins = quota.purchasedVoiceCredits || 0;
    const voiceUsedMins = quota.usedVoiceCredits || 0;
    const voiceRemainingPurchasedMins = Math.max(0, voicePurchasedMins - voiceUsedMins);
    const voiceMonthlyRemainingMins = Math.max(0, Number((voiceLimit - (usedSeconds / 60)).toFixed(1)));
    const voiceTotalRemainingMins = Number((voiceMonthlyRemainingMins + voiceRemainingPurchasedMins).toFixed(1));

    const meetingsPurchased = quota.purchasedMeetingCredits || 0;
    const meetingsUsedCredits = quota.usedMeetingCredits || 0;
    const meetingsRemainingCredits = Math.max(0, meetingsPurchased - meetingsUsedCredits);
    const meetingsMonthlyRemaining = Math.max(0, meetingsLimit - quota.meetingsUsed);
    const meetingsTotalRemaining = meetingsMonthlyRemaining + meetingsRemainingCredits;

    const voiceTypingUsed = quota.voiceTypingUsed ?? 0;
    const voiceTypingRemaining = Math.max(0, voiceTypingLimit - voiceTypingUsed);

    const textCorrectionsUsed = quota.textCorrectionsUsed ?? 0;
    const textCorrectionsRemaining = Math.max(0, textCorrectionLimit - textCorrectionsUsed);

    const summariesUsed = quota.meetingSummariesUsed ?? 0;
    const summariesRemaining = Math.max(0, summaryLimit - summariesUsed);

    const resetDate = this.getNextQuotaResetDate();

    // 1. Transcription Minutes Breakdown
    const transcriptionMinutesBreakdown: FeatureUsageBreakdown = {
      used: usedMinutes,
      limit: voiceLimit,
      remaining: voiceMonthlyRemainingMins,
      isExhausted: voiceTotalRemainingMins <= 0,
      unit: "mins",
      purchasedCredits: voicePurchasedMins,
      usedCredits: voiceUsedMins,
      remainingCredits: voiceRemainingPurchasedMins,
      totalRemaining: voiceTotalRemainingMins
    };

    // 2. Voice Typing Requests Breakdown
    const voiceTypingBreakdown: FeatureUsageBreakdown = {
      used: voiceTypingUsed,
      limit: voiceTypingLimit,
      remaining: voiceTypingRemaining,
      isExhausted: voiceTypingRemaining <= 0,
      unit: "requests",
      purchasedCredits: 0,
      usedCredits: 0,
      remainingCredits: 0,
      totalRemaining: voiceTypingRemaining
    };

    // 3. AI Text Correction Breakdown
    const textCorrectionBreakdown: FeatureUsageBreakdown = {
      used: textCorrectionsUsed,
      limit: textCorrectionLimit,
      remaining: textCorrectionsRemaining,
      isExhausted: textCorrectionsRemaining <= 0,
      unit: "requests",
      purchasedCredits: 0,
      usedCredits: 0,
      remainingCredits: 0,
      totalRemaining: textCorrectionsRemaining
    };

    // 4. Meetings Breakdown
    const meetingsBreakdown: FeatureUsageBreakdown = {
      used: quota.meetingsUsed,
      limit: meetingsLimit,
      remaining: meetingsMonthlyRemaining,
      isExhausted: meetingsTotalRemaining <= 0,
      unit: "meetings",
      purchasedCredits: meetingsPurchased,
      usedCredits: meetingsUsedCredits,
      remainingCredits: meetingsRemainingCredits,
      totalRemaining: meetingsTotalRemaining
    };

    // 5. AI Meeting Summaries Breakdown
    const summariesBreakdown: FeatureUsageBreakdown = {
      used: summariesUsed,
      limit: summaryLimit,
      remaining: summariesRemaining,
      isExhausted: summariesRemaining <= 0,
      unit: "summaries",
      purchasedCredits: 0,
      usedCredits: 0,
      remainingCredits: 0,
      totalRemaining: summariesRemaining
    };

    const detailedBreakdown = {
      transcriptionMinutes: transcriptionMinutesBreakdown,
      voiceTyping: voiceTypingBreakdown,
      textCorrection: textCorrectionBreakdown,
      meetings: meetingsBreakdown,
      summaries: summariesBreakdown
    };

    return {
      userId,
      planId,
      planName: planConfig.name,
      status,
      isPremium,
      expiresAt,
      cancelAtPeriodEnd,
      limits: planConfig.limits,
      resetDate,
      voice: transcriptionMinutesBreakdown,
      meetings: meetingsBreakdown,
      breakdown: detailedBreakdown,
      usage: {
        periodYearMonth: periodKey,
        transcriptionSecondsUsed: usedSeconds,
        transcriptionMinutesUsed: usedMinutes,
        transcriptionMinutesLimit: voiceLimit,
        voiceTypingUsed,
        voiceTypingLimit,
        textCorrectionsUsed,
        textCorrectionsLimit: textCorrectionLimit,
        meetingsUsed: quota.meetingsUsed,
        meetingsLimit,
        meetingSummariesUsed: summariesUsed,
        meetingSummariesLimit: summaryLimit,
        voiceTranscriptionsUsed: quota.voiceTranscriptionsUsed,
        voiceTranscriptionsLimit: voiceLimit,
        voice: transcriptionMinutesBreakdown,
        meetings: meetingsBreakdown,
        breakdown: detailedBreakdown
      }
    };
  }

  /**
   * Check if user is entitled to a feature without consuming quota
   */
  async checkFeature(userId: string, feature: FeatureKey): Promise<EntitlementCheckResult> {
    const entitlements = await this.getUserEntitlements(userId);
    const voiceLimit = entitlements.limits.transcriptionMinutes ?? entitlements.limits.monthlyVoiceTranscriptions ?? 30;
    const meetingsLimit = entitlements.limits.monthlyMeetings ?? 3;

    // Premium-only gates
    if (
      feature === "advanced_meeting_intelligence" ||
      feature === "priority_processing" ||
      feature === "markdown_export"
    ) {
      if (!entitlements.isPremium) {
        return {
          allowed: false,
          code: "SUBSCRIPTION_REQUIRED",
          reason: `Feature '${feature}' requires an active VoxFlow Pro subscription.`
        };
      }
      return { allowed: true };
    }

    // Voice dictation / transcription quota check
    if (feature === "voice_dictation") {
      const voiceInfo = entitlements.voice;
      if (voiceInfo && voiceInfo.isExhausted) {
        return {
          allowed: false,
          code: "USAGE_LIMIT_REACHED",
          reason: `Monthly voice transcription limit of ${voiceLimit} minutes reached.`,
          currentUsage: voiceInfo.used,
          limit: voiceLimit,
          remaining: voiceInfo.totalRemaining,
          unit: "mins",
          resetDate: this.getNextQuotaResetDate()
        };
      }
      return { allowed: true };
    }

    // Meeting capture quota check
    if (
      feature === "meeting_creation" ||
      feature === "meeting_recording_process" ||
      feature === "meeting_notes"
    ) {
      const meetingInfo = entitlements.meetings;
      if (meetingInfo && meetingInfo.isExhausted) {
        return {
          allowed: false,
          code: "USAGE_LIMIT_REACHED",
          reason: `Monthly meeting limit of ${meetingsLimit} reached.`,
          currentUsage: entitlements.usage.meetingsUsed,
          limit: meetingsLimit,
          remaining: meetingInfo.totalRemaining,
          unit: "meetings",
          resetDate: this.getNextQuotaResetDate()
        };
      }
      return { allowed: true };
    }

    return { allowed: true };
  }

  /**
   * Check if a specific quota is available without consuming it
   */
  async checkQuota(
    userId: string,
    feature: "meeting" | "voice" | "voice_typing" | "text_correction" | "summary" | "transcription_seconds",
    amount = 1
  ): Promise<EntitlementCheckResult> {
    const entitlements = await this.getUserEntitlements(userId);
    const periodKey = this.getCurrentPeriodKey();
    const quota = await billingStore.getUsageQuota(userId, periodKey);

    if (feature === "meeting") {
      const limit = entitlements.limits.monthlyMeetings ?? 3;
      const used = quota.meetingsUsed;
      const remainingCredits = Math.max(0, (quota.purchasedMeetingCredits || 0) - (quota.usedMeetingCredits || 0));
      const totalRemaining = Math.max(0, limit - used) + remainingCredits;
      if (totalRemaining < amount) {
        return {
          allowed: false,
          code: "USAGE_LIMIT_REACHED",
          quotaType: "monthly_meetings",
          reason: entitlements.isPremium
            ? `Monthly meeting limit (${limit}) reached. Upgrade or wait for monthly reset.`
            : `Monthly meeting limit (${limit}) reached. Upgrade to Pro for 25 meetings.`,
          currentUsage: used,
          limit,
          remaining: totalRemaining,
          unit: "meetings",
          resetDate: this.getNextQuotaResetDate(),
          upgradeUrl: "#/pricing"
        };
      }
      return { allowed: true, currentUsage: used, limit, remaining: totalRemaining, unit: "meetings" };
    }

    if (feature === "transcription_seconds") {
      const limitMinutes = entitlements.limits.transcriptionMinutes ?? 30;
      const limitSeconds = limitMinutes * 60;
      const usedSeconds = quota.transcriptionSecondsUsed ?? ((quota.voiceTranscriptionsUsed || 0) * 60);
      const remainingCreditsSeconds = Math.max(0, ((quota.purchasedVoiceCredits || 0) - (quota.usedVoiceCredits || 0)) * 60);
      const totalRemainingSeconds = Math.max(0, limitSeconds - usedSeconds) + remainingCreditsSeconds;

      if (totalRemainingSeconds < amount) {
        return {
          allowed: false,
          code: "USAGE_LIMIT_REACHED",
          quotaType: "transcription_minutes",
          reason: entitlements.isPremium
            ? `Monthly transcription limit (${limitMinutes} mins) reached. You have ${(usedSeconds / 60).toFixed(1)} mins used.`
            : `Monthly transcription limit (${limitMinutes} mins) reached. Upgrade to Pro for 300 minutes.`,
          currentUsage: Number((usedSeconds / 60).toFixed(1)),
          limit: limitMinutes,
          remaining: Number((totalRemainingSeconds / 60).toFixed(1)),
          unit: "minutes",
          resetDate: this.getNextQuotaResetDate(),
          upgradeUrl: "#/pricing"
        };
      }
      return { allowed: true, currentUsage: Number((usedSeconds / 60).toFixed(1)), limit: limitMinutes, remaining: Number((totalRemainingSeconds / 60).toFixed(1)), unit: "minutes" };
    }

    if (feature === "voice_typing") {
      const limit = entitlements.limits.voiceTypingRequests ?? 100;
      const used = quota.voiceTypingUsed ?? 0;
      const remaining = Math.max(0, limit - used);
      if (remaining < amount) {
        return {
          allowed: false,
          code: "USAGE_LIMIT_REACHED",
          quotaType: "voice_typing",
          reason: entitlements.isPremium
            ? `Monthly voice typing limit (${limit} requests) reached.`
            : `Monthly voice typing limit (${limit} requests) reached. Upgrade to Pro for 1,000 requests.`,
          currentUsage: used,
          limit,
          remaining,
          unit: "requests",
          resetDate: this.getNextQuotaResetDate(),
          upgradeUrl: "#/pricing"
        };
      }
      return { allowed: true, currentUsage: used, limit, remaining, unit: "requests" };
    }

    if (feature === "text_correction") {
      const limit = entitlements.limits.textCorrectionRequests ?? 50;
      const used = quota.textCorrectionsUsed ?? 0;
      const remaining = Math.max(0, limit - used);
      if (remaining < amount) {
        return {
          allowed: false,
          code: "USAGE_LIMIT_REACHED",
          quotaType: "text_correction",
          reason: entitlements.isPremium
            ? `Monthly text correction limit (${limit} requests) reached.`
            : `Monthly text correction limit (${limit} requests) reached. Upgrade to Pro for 500 requests.`,
          currentUsage: used,
          limit,
          remaining,
          unit: "requests",
          resetDate: this.getNextQuotaResetDate(),
          upgradeUrl: "#/pricing"
        };
      }
      return { allowed: true, currentUsage: used, limit, remaining, unit: "requests" };
    }

    if (feature === "summary") {
      const limit = entitlements.limits.meetingSummaries ?? 3;
      const used = quota.meetingSummariesUsed ?? 0;
      const remaining = Math.max(0, limit - used);
      if (remaining < amount) {
        return {
          allowed: false,
          code: "USAGE_LIMIT_REACHED",
          quotaType: "meeting_summaries",
          reason: entitlements.isPremium
            ? `Monthly meeting summaries limit (${limit}) reached.`
            : `Monthly meeting summaries limit (${limit}) reached. Upgrade to Pro for 25 summaries.`,
          currentUsage: used,
          limit,
          remaining,
          unit: "summaries",
          resetDate: this.getNextQuotaResetDate(),
          upgradeUrl: "#/pricing"
        };
      }
      return { allowed: true, currentUsage: used, limit, remaining, unit: "summaries" };
    }

    return { allowed: true };
  }

  /**
   * Atomically check and consume quota for meeting recording:
   * Consumes meeting count, actual audio duration in seconds, and summary count.
   */
  async consumeMeetingRecordingQuota(
    userId: string,
    durationSeconds: number
  ): Promise<EntitlementCheckResult> {
    return billingStore.runWithQuotaLock(userId, async () => {
      // 1. Check meeting count quota
      const meetingCheck = await this.checkQuota(userId, "meeting", 1);
      if (!meetingCheck.allowed) return meetingCheck;

      // 2. Check transcription duration quota
      const durationCheck = await this.checkQuota(userId, "transcription_seconds", durationSeconds);
      if (!durationCheck.allowed) return durationCheck;

      // 3. Commit consumption
      const periodKey = this.getCurrentPeriodKey();
      await billingStore.incrementUsageQuota(userId, periodKey, "meeting", 1);
      await billingStore.incrementUsageQuota(userId, periodKey, "transcription_seconds", durationSeconds);
      await billingStore.incrementUsageQuota(userId, periodKey, "summary", 1);

      return {
        allowed: true,
        currentUsage: durationCheck.currentUsage,
        limit: durationCheck.limit,
        remaining: durationCheck.remaining,
        unit: "minutes"
      };
    });
  }

  /**
   * Atomically check and consume quota for a feature with strict per-user mutex serialization.
   * Consumes normal monthly allowance first, then purchased top-up credits.
   * Prevents race conditions and parallel quota bypass.
   */
  async consumeQuota(
    userId: string,
    feature: "voice" | "meeting" | "voice_typing" | "text_correction" | "summary" | "transcription_seconds",
    amount = 1
  ): Promise<EntitlementCheckResult> {
    return billingStore.runWithQuotaLock(userId, async () => {
      const entitlements = await this.getUserEntitlements(userId);
      const periodKey = this.getCurrentPeriodKey();
      const quota = await billingStore.getUsageQuota(userId, periodKey);

      if (feature === "voice" || feature === "transcription_seconds") {
        const monthlyLimitMins = entitlements.limits.transcriptionMinutes ?? entitlements.limits.monthlyVoiceTranscriptions ?? 30;
        const monthlyLimitSeconds = monthlyLimitMins * 60;
        const secondsToConsume = feature === "transcription_seconds" ? amount : amount * 60;
        const monthlyUsedSeconds = quota.transcriptionSecondsUsed ?? ((quota.voiceTranscriptionsUsed || 0) * 60);

        const purchasedMins = quota.purchasedVoiceCredits || 0;
        const usedCreditsMins = quota.usedVoiceCredits || 0;
        const remainingCreditsSeconds = Math.max(0, (purchasedMins - usedCreditsMins) * 60);

        // 1. Consume normal monthly allowance first
        if (monthlyUsedSeconds + secondsToConsume <= monthlyLimitSeconds) {
          await billingStore.incrementUsageQuota(userId, periodKey, "transcription_seconds", secondsToConsume);
          const updatedMins = Number(((monthlyUsedSeconds + secondsToConsume) / 60).toFixed(1));
          return { allowed: true, currentUsage: updatedMins, limit: monthlyLimitMins, unit: "mins" };
        }

        // 2. Consume purchased credits if available
        if (remainingCreditsSeconds >= secondsToConsume) {
          await billingStore.incrementUsedCredits(userId, periodKey, "transcription_seconds", secondsToConsume);
          return {
            allowed: true,
            currentUsage: Number((monthlyUsedSeconds / 60).toFixed(1)),
            limit: monthlyLimitMins,
            unit: "mins",
            resetDate: this.getNextQuotaResetDate()
          };
        }

        // 3. Quota exhausted
        return {
          allowed: false,
          code: "USAGE_LIMIT_REACHED",
          quotaType: "transcription_minutes",
          reason: entitlements.isPremium
            ? `Monthly voice transcription limit (${monthlyLimitMins} minutes) reached. You can buy add-on minutes or wait for monthly reset.`
            : `Monthly voice transcription limit (${monthlyLimitMins} minutes) reached. Upgrade to Pro for 300 minutes.`,
          currentUsage: Number((monthlyUsedSeconds / 60).toFixed(1)),
          limit: monthlyLimitMins,
          remaining: 0,
          unit: "mins",
          resetDate: this.getNextQuotaResetDate(),
          upgradeUrl: "#/pricing"
        };
      }

      if (feature === "voice_typing") {
        const limit = entitlements.limits.voiceTypingRequests ?? 100;
        const used = quota.voiceTypingUsed ?? 0;
        if (used + amount <= limit) {
          await billingStore.incrementUsageQuota(userId, periodKey, "voice_typing", amount);
          return { allowed: true, currentUsage: used + amount, limit, remaining: limit - (used + amount), unit: "requests" };
        }
        return {
          allowed: false,
          code: "USAGE_LIMIT_REACHED",
          quotaType: "voice_typing",
          reason: entitlements.isPremium
            ? `Monthly voice typing limit of ${limit} requests reached.`
            : `Monthly voice typing limit of ${limit} requests reached. Upgrade to Pro for 1,000 requests.`,
          currentUsage: used,
          limit,
          remaining: 0,
          unit: "requests",
          resetDate: this.getNextQuotaResetDate(),
          upgradeUrl: "#/pricing"
        };
      }

      if (feature === "text_correction") {
        const limit = entitlements.limits.textCorrectionRequests ?? 50;
        const used = quota.textCorrectionsUsed ?? 0;
        if (used + amount <= limit) {
          await billingStore.incrementUsageQuota(userId, periodKey, "text_correction", amount);
          return { allowed: true, currentUsage: used + amount, limit, remaining: limit - (used + amount), unit: "requests" };
        }
        return {
          allowed: false,
          code: "USAGE_LIMIT_REACHED",
          quotaType: "text_correction",
          reason: entitlements.isPremium
            ? `Monthly text correction limit of ${limit} requests reached.`
            : `Monthly text correction limit of ${limit} requests reached. Upgrade to Pro for 500 requests.`,
          currentUsage: used,
          limit,
          remaining: 0,
          unit: "requests",
          resetDate: this.getNextQuotaResetDate(),
          upgradeUrl: "#/pricing"
        };
      }

      if (feature === "summary") {
        const limit = entitlements.limits.meetingSummaries ?? 3;
        const used = quota.meetingSummariesUsed ?? 0;
        if (used + amount <= limit) {
          await billingStore.incrementUsageQuota(userId, periodKey, "summary", amount);
          return { allowed: true, currentUsage: used + amount, limit, remaining: limit - (used + amount), unit: "summaries" };
        }
        return {
          allowed: false,
          code: "USAGE_LIMIT_REACHED",
          quotaType: "meeting_summaries",
          reason: entitlements.isPremium
            ? `Monthly meeting summaries limit of ${limit} reached.`
            : `Monthly meeting summaries limit of ${limit} reached. Upgrade to Pro for 25 summaries.`,
          currentUsage: used,
          limit,
          remaining: 0,
          unit: "summaries",
          resetDate: this.getNextQuotaResetDate(),
          upgradeUrl: "#/pricing"
        };
      }

      if (feature === "meeting") {
        const monthlyLimit = entitlements.limits.monthlyMeetings ?? 3;
        const monthlyUsed = quota.meetingsUsed;
        const purchased = quota.purchasedMeetingCredits || 0;
        const usedCredits = quota.usedMeetingCredits || 0;
        const remainingCredits = Math.max(0, purchased - usedCredits);

        // 1. Consume normal monthly allowance first
        if (monthlyUsed + amount <= monthlyLimit) {
          await billingStore.incrementUsageQuota(userId, periodKey, "meeting", amount);
          return { allowed: true, currentUsage: monthlyUsed + amount, limit: monthlyLimit, unit: "meetings" };
        }

        // 2. Consume purchased credits if available
        if (remainingCredits >= amount) {
          await billingStore.incrementUsedCredits(userId, periodKey, "meeting", amount);
          return {
            allowed: true,
            currentUsage: monthlyUsed,
            limit: monthlyLimit,
            unit: "meetings",
            resetDate: this.getNextQuotaResetDate()
          };
        }

        // 3. Quota exhausted
        return {
          allowed: false,
          code: "USAGE_LIMIT_REACHED",
          quotaType: "monthly_meetings",
          reason: entitlements.isPremium
            ? `Monthly meeting limit (${monthlyLimit}) reached. You can buy another month or wait for reset.`
            : `Monthly meeting limit (${monthlyLimit}) reached. Upgrade to Pro for 25 meetings.`,
          currentUsage: monthlyUsed,
          limit: monthlyLimit,
          remaining: 0,
          unit: "meetings",
          resetDate: this.getNextQuotaResetDate(),
          upgradeUrl: "#/pricing"
        };
      }

      return { allowed: true };
    });
  }
}

export const entitlementService = new EntitlementService();
