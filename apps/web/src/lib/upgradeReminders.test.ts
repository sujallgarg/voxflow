import { describe, it, expect, beforeEach } from "vitest";
import {
  canShowAutomaticPopup,
  isCooldownActive,
  wasShownInSession,
  recordPopupShown,
  recordPopupDismissed,
  checkUsageThresholdReminder,
  recordMeaningfulAction,
  getOccasionalReminderConfig,
  getMeetingCompletionReminderConfig,
  isBannerDismissed,
  dismissDashboardBanner
} from "./upgradeReminders";
import type { UserEntitlements } from "@voxflow/shared";

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage?.clear) {
  (globalThis as any).localStorage = new MemoryStorage();
}
if (typeof globalThis.sessionStorage === "undefined" || !globalThis.sessionStorage?.clear) {
  (globalThis as any).sessionStorage = new MemoryStorage();
}

describe("VoxFlow Smart Premium Upgrade Reminders Suite", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe("canShowAutomaticPopup gating", () => {
    it("never shows popup to active Pro subscribers", () => {
      const allowed = canShowAutomaticPopup(true, false);
      expect(allowed).toBe(false);
    });

    it("never shows popup while audio recording or processing is in progress", () => {
      const allowed = canShowAutomaticPopup(false, true);
      expect(allowed).toBe(false);
    });

    it("allows showing to a free user who is not busy and not in cooldown", () => {
      const allowed = canShowAutomaticPopup(false, false);
      expect(allowed).toBe(true);
    });

    it("suppresses popup if already shown once in the current session", () => {
      recordPopupShown("occasional");
      expect(wasShownInSession()).toBe(true);

      const allowed = canShowAutomaticPopup(false, false);
      expect(allowed).toBe(false);
    });

    it("suppresses popup when 7-day cooldown is active after dismissal", () => {
      recordPopupDismissed("occasional");
      expect(isCooldownActive()).toBe(true);

      // Even if session storage is cleared (e.g. new tab or browser session):
      sessionStorage.clear();
      expect(wasShownInSession()).toBe(false);

      const allowed = canShowAutomaticPopup(false, false);
      expect(allowed).toBe(false);
    });

    it("allows popup again after 7 days cooldown expires", () => {
      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
      localStorage.setItem(
        "voxflow_upgrade_reminders_v1",
        JSON.stringify({ lastDismissedAt: eightDaysAgo, actionsCount: 5, lastShownAt: eightDaysAgo })
      );

      expect(isCooldownActive()).toBe(false);
      expect(canShowAutomaticPopup(false, false)).toBe(true);
    });
  });

  describe("checkUsageThresholdReminder", () => {
    const baseEntitlements: UserEntitlements = {
      userId: "test_user_free",
      planId: "free",
      planName: "Free",
      status: "free",
      isPremium: false,
      expiresAt: null,
      cancelAtPeriodEnd: false,
      limits: {
        transcriptionMinutes: 30,
        voiceTypingRequests: 100,
        textCorrectionRequests: 50,
        monthlyMeetings: 3,
        meetingSummaries: 3,
        historyRetentionDays: 7,
        maxAudioDurationSeconds: 120,
        advancedMeetingNotes: false,
        priorityProcessing: false,
        exportFormats: ["text"]
      },
      usage: {
        periodYearMonth: "2026-10",
        transcriptionSecondsUsed: 0,
        transcriptionMinutesUsed: 5,
        transcriptionMinutesLimit: 30,
        voiceTypingUsed: 20,
        voiceTypingLimit: 100,
        textCorrectionsUsed: 10,
        textCorrectionsLimit: 50,
        meetingsUsed: 1,
        meetingsLimit: 3,
        meetingSummariesUsed: 1,
        meetingSummariesLimit: 3,
        voiceTranscriptionsUsed: 5,
        voiceTranscriptionsLimit: 30
      }
    };

    it("returns null if usage is below 70%", () => {
      const reminder = checkUsageThresholdReminder(baseEntitlements);
      expect(reminder).toBeNull();
    });

    it("returns null for Pro users even with high usage", () => {
      const proEntitlements: UserEntitlements = {
        ...baseEntitlements,
        isPremium: true,
        planId: "premium_monthly",
        usage: {
          ...baseEntitlements.usage,
          voiceTypingUsed: 900,
          voiceTypingLimit: 1000
        }
      };
      const reminder = checkUsageThresholdReminder(proEntitlements);
      expect(reminder).toBeNull();
    });

    it("detects when voice typing reaches 75% threshold", () => {
      const highUsage: UserEntitlements = {
        ...baseEntitlements,
        usage: {
          ...baseEntitlements.usage,
          voiceTypingUsed: 75,
          voiceTypingLimit: 100
        }
      };

      const reminder = checkUsageThresholdReminder(highUsage);
      expect(reminder).not.toBeNull();
      expect(reminder?.type).toBe("usage_threshold");
      expect(reminder?.percentage).toBe(75);
      expect(reminder?.metricLabel).toBe("Voice Typing Requests");
      expect(reminder?.highlight).toContain("1,000 voice typing requests");
    });

    it("detects when transcription minutes reach 80% threshold", () => {
      const highMinutes: UserEntitlements = {
        ...baseEntitlements,
        usage: {
          ...baseEntitlements.usage,
          transcriptionMinutesUsed: 24, // 24 of 30 = 80%
          transcriptionMinutesLimit: 30
        }
      };

      const reminder = checkUsageThresholdReminder(highMinutes);
      expect(reminder).not.toBeNull();
      expect(reminder?.percentage).toBe(80);
      expect(reminder?.metricLabel).toBe("Voice Transcription Minutes");
      expect(reminder?.highlight).toContain("300 minutes");
    });
  });

  describe("Meaningful Action tracking", () => {
    it("increments action count and triggers after 2 actions", () => {
      const action1 = recordMeaningfulAction();
      expect(action1).toBe(false);

      const action2 = recordMeaningfulAction();
      expect(action2).toBe(true);
    });
  });

  describe("Contextual Reminder copy accuracy", () => {
    it("occasional reminder cites authentic Pro plan benefits", () => {
      const config = getOccasionalReminderConfig();
      expect(config.title).toBe("Get more done with VoxFlow Pro");
      expect(config.highlight).toContain("1,000 voice typing requests");
      expect(config.highlight).toContain("300 transcription minutes");
      expect(config.highlight).toContain("25 intelligent meeting records");
    });

    it("meeting completion reminder cites authentic limits", () => {
      const config = getMeetingCompletionReminderConfig();
      expect(config.description).toContain("Free accounts include 3 meetings per month");
      expect(config.highlight).toContain("25 monthly meetings");
      expect(config.highlight).toContain("up to 2-hour audio recordings");
    });
  });

  describe("Dashboard banner dismissal", () => {
    it("is not dismissed initially", () => {
      expect(isBannerDismissed()).toBe(false);
    });

    it("is marked dismissed after calling dismissDashboardBanner()", () => {
      dismissDashboardBanner();
      expect(isBannerDismissed()).toBe(true);
    });
  });
});
