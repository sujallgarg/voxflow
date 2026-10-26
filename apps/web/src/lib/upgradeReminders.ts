import type { UserEntitlements } from "@voxflow/shared";
import { PLAN_CONFIGS } from "@voxflow/shared";
import { hasConsent } from "./consent";

export type UpgradeReminderType = "occasional" | "usage_threshold" | "meeting_completion";

export interface ReminderConfig {
  type: UpgradeReminderType;
  title: string;
  description: string;
  highlight?: string;
  metricLabel?: string;
  usedAmount?: number;
  limitAmount?: number;
  percentage?: number;
}

const STORAGE_KEY = "voxflow_upgrade_reminders_v1";
const SESSION_SHOWN_KEY = "voxflow_upgrade_popup_session_shown";
const BANNER_DISMISSED_KEY = "voxflow_dashboard_banner_dismissed";
const DEFAULT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface ReminderStoreData {
  lastDismissedAt: number | null;
  actionsCount: number;
  lastShownAt: number | null;
}

function getStoredData(): ReminderStoreData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        lastDismissedAt: typeof parsed.lastDismissedAt === "number" ? parsed.lastDismissedAt : null,
        actionsCount: typeof parsed.actionsCount === "number" ? parsed.actionsCount : 0,
        lastShownAt: typeof parsed.lastShownAt === "number" ? parsed.lastShownAt : null
      };
    }
  } catch (err) {
    console.warn("Could not read upgrade reminder state:", err);
  }
  return {
    lastDismissedAt: null,
    actionsCount: 0,
    lastShownAt: null
  };
}

function saveStoredData(data: ReminderStoreData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("Could not save upgrade reminder state:", err);
  }
}

/**
 * Check if the 7-day cooldown period is currently active.
 */
export function isCooldownActive(customCooldownMs: number = DEFAULT_COOLDOWN_MS): boolean {
  const data = getStoredData();
  if (!data.lastDismissedAt) return false;
  const elapsed = Date.now() - data.lastDismissedAt;
  return elapsed < customCooldownMs;
}

/**
 * Check if an automatic popup was already presented during this browser session.
 */
export function wasShownInSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_SHOWN_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Check if user has dismissed the dashboard banner in the last 7 days.
 */
export function isBannerDismissed(): boolean {
  try {
    const raw = localStorage.getItem(BANNER_DISMISSED_KEY);
    if (!raw) return false;
    const timestamp = Number(raw);
    return Date.now() - timestamp < DEFAULT_COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function dismissDashboardBanner(): void {
  try {
    localStorage.setItem(BANNER_DISMISSED_KEY, Date.now().toString());
    trackAnalyticsEvent("reminder_dismissed", { type: "dashboard_banner" });
  } catch (err) {
    console.warn("Could not record banner dismissal:", err);
  }
}

/**
 * Safe gate check: returns false if user is subscribed to Pro, if cooldown is active,
 * if already shown in this session, or if active recording/processing is in flight.
 */
export function canShowAutomaticPopup(isPremium: boolean, isBusy: boolean): boolean {
  if (isPremium) return false;
  if (isBusy) return false;
  if (isCooldownActive()) return false;
  if (wasShownInSession()) return false;
  return true;
}

/**
 * Record that a reminder popup was displayed to the user.
 */
export function recordPopupShown(type: UpgradeReminderType): void {
  try {
    sessionStorage.setItem(SESSION_SHOWN_KEY, "true");
  } catch {
    // sessionStorage fallback
  }

  const data = getStoredData();
  data.lastShownAt = Date.now();
  saveStoredData(data);

  trackAnalyticsEvent("reminder_displayed", { type });
}

/**
 * Record user dismissal: sets 7-day persistent cooldown and flags session as shown.
 */
export function recordPopupDismissed(type: UpgradeReminderType): void {
  const data = getStoredData();
  data.lastDismissedAt = Date.now();
  saveStoredData(data);

  try {
    sessionStorage.setItem(SESSION_SHOWN_KEY, "true");
  } catch {
    // fallback
  }

  trackAnalyticsEvent("reminder_dismissed", { type });
}

/**
 * Record user clicking "Explore Pro".
 */
export function recordUpgradeClicked(type: UpgradeReminderType | "dashboard_banner" | "pricing_cta"): void {
  trackAnalyticsEvent("upgrade_clicked", { source: type });
}

/**
 * Check usage against the 70–80% threshold based on authoritative plan limits.
 */
export function checkUsageThresholdReminder(entitlements: UserEntitlements | null): ReminderConfig | null {
  if (!entitlements || entitlements.isPremium) return null;

  const usage = entitlements.usage;
  const limits = entitlements.limits || PLAN_CONFIGS.free.limits;

  if (!usage || !limits) return null;

  // 1. Voice typing requests
  const voiceUsed = usage.voiceTypingUsed || 0;
  const voiceLimit = limits.voiceTypingRequests || 100;
  const voicePct = Math.round((voiceUsed / voiceLimit) * 100);

  // 2. Transcription minutes
  const minsUsed = usage.transcriptionMinutesUsed || Math.ceil((usage.transcriptionSecondsUsed || 0) / 60);
  const minsLimit = limits.transcriptionMinutes || 30;
  const minsPct = Math.round((minsUsed / minsLimit) * 100);

  // 3. Monthly meetings
  const meetingsUsed = usage.meetingsUsed || 0;
  const meetingsLimit = limits.monthlyMeetings || 3;
  const meetingsPct = Math.round((meetingsUsed / meetingsLimit) * 100);

  // Prioritize highest percentage that is between 70% and 100%
  const candidates: Array<{
    pct: number;
    metricLabel: string;
    used: number;
    limit: number;
    benefit: string;
  }> = [];

  if (voicePct >= 70 && voicePct < 100) {
    candidates.push({
      pct: voicePct,
      metricLabel: "Voice Typing Requests",
      used: voiceUsed,
      limit: voiceLimit,
      benefit: "VoxFlow Pro includes 1,000 voice typing requests per month (10× free tier) and priority processing."
    });
  }

  if (minsPct >= 70 && minsPct < 100) {
    candidates.push({
      pct: minsPct,
      metricLabel: "Voice Transcription Minutes",
      used: minsUsed,
      limit: minsLimit,
      benefit: "VoxFlow Pro includes 300 minutes of transcription per month (10× free tier) with expanded audio durations."
    });
  }

  if (meetingsPct >= 70 && meetingsPct < 100) {
    candidates.push({
      pct: meetingsPct,
      metricLabel: "Monthly Meeting Records",
      used: meetingsUsed,
      limit: meetingsLimit,
      benefit: "VoxFlow Pro provides up to 25 meeting notes per month with full history retention and structured action items."
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.pct - a.pct);
  const top = candidates[0];

  return {
    type: "usage_threshold",
    title: `Approaching your monthly ${top.metricLabel.toLowerCase()} limit`,
    description: `You have used ${top.pct}% (${top.used} of ${top.limit}) of your included free quota this month. Upgrade to Pro ($9/mo) to keep working without interruption.`,
    highlight: top.benefit,
    metricLabel: top.metricLabel,
    usedAmount: top.used,
    limitAmount: top.limit,
    percentage: top.pct
  };
}

/**
 * Increment user action count (e.g. speech converted, meeting saved).
 * Returns true if action threshold (>= 2 meaningful interactions) is reached.
 */
export function recordMeaningfulAction(): boolean {
  const data = getStoredData();
  data.actionsCount += 1;
  saveStoredData(data);
  return data.actionsCount >= 2;
}

/**
 * Construct the occasional reminder popup configuration.
 */
export function getOccasionalReminderConfig(): ReminderConfig {
  return {
    type: "occasional",
    title: "Get more done with VoxFlow Pro",
    description: "Spend less time typing and organizing your work. Unlock the additional usage and features included in your Pro plan ($9/mo).",
    highlight: "Includes 1,000 voice typing requests, 300 transcription minutes, and 25 intelligent meeting records."
  };
}

/**
 * Construct contextual reminder after meeting note creation.
 */
export function getMeetingCompletionReminderConfig(): ReminderConfig {
  return {
    type: "meeting_completion",
    title: "Save and analyze more meetings with Pro",
    description: "Your meeting summary has been saved. Free accounts include 3 meetings per month with 7-day history. Upgrade to Pro ($9/mo) for 25 meetings per month and permanent history retention.",
    highlight: "Pro includes 25 monthly meetings, up to 2-hour audio recordings, and automated decision tracking."
  };
}

/**
 * Lightweight privacy-preserving analytics logger for marketing events.
 * Never logs transcripts, meeting contents, or personally identifiable data.
 */
export function trackAnalyticsEvent(
  eventName: "reminder_displayed" | "reminder_dismissed" | "upgrade_clicked" | "pricing_page_visited" | "confirmed_upgrade",
  metadata?: Record<string, string | number | boolean | null>
): void {
  try {
    const hasConsentForTracking = hasConsent("analytics");

    // Only dispatch custom event and log if consent or standard in-app notification
    const eventPayload = {
      event: eventName,
      timestamp: new Date().toISOString(),
      metadata: metadata || {}
    };

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("voxflow_analytics", { detail: eventPayload })
      );
    }

    if (hasConsentForTracking) {
      // If external analytics provider is present on window
      const win = window as any;
      if (typeof win.va === "function") {
        win.va("event", { name: eventName, ...metadata });
      }
    }
  } catch (err) {
    // Analytics should never throw or break UI
    console.debug("Analytics event dispatch notice:", err);
  }
}
