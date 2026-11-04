import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  UserSubscription,
  BillingInvoice,
  UserUsageQuota,
  SubscriptionStatus,
  PlanId,
  AddonCreditRecord
} from "@voxflow/shared";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../../data");
const BILLING_DATA_FILE = path.join(DATA_DIR, "billing.json");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ProcessedWebhookRecord {
  id: string;
  provider: string;
  eventId: string;
  eventType: string;
  status: "processing" | "processed" | "failed" | "ignored";
  processedAt: string;
}

export class BillingStoreService {
  private subscriptions: Map<string, UserSubscription> = new Map(); // key: userId
  private invoices: Map<string, BillingInvoice[]> = new Map();       // key: userId -> list of invoices
  private webhookEvents: Map<string, ProcessedWebhookRecord> = new Map(); // key: `${provider}:${eventId}`
  private usageQuotas: Map<string, UserUsageQuota> = new Map();      // key: `${userId}:${periodYearMonth}`
  private addonCredits: Map<string, AddonCreditRecord[]> = new Map(); // key: userId -> list of credit records
  private activeLocks: Set<string> = new Set();                      // checkout concurrency locks
  private activeCheckoutSessions: Map<string, { sessionId: string; checkoutUrl: string; createdAt: number; action: string; planId: string; packId?: string }> = new Map();
  private supabase: SupabaseClient | null = null;
  private isLoaded = false;

  constructor() {
    this.initSupabase();
    this.loadFromDisk();
  }

  private initSupabase() {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || SUPABASE_KEY;
    if (
      url &&
      key &&
      url.startsWith("https://") &&
      !url.includes("placeholder")
    ) {
      try {
        this.supabase = createClient(url, key, {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        });
      } catch (e) {
        console.warn("Failed to initialize Supabase client in BillingStoreService:", e);
      }
    }
  }

  isSupabaseConnected(): boolean {
    return Boolean(this.getSupabase());
  }

  getSupabase(): SupabaseClient | null {
    if (!this.supabase) {
      this.initSupabase();
    }
    return this.supabase;
  }

  setSupabaseClientForTesting(client: SupabaseClient | null) {
    this.supabase = client;
  }

  private loadFromDisk() {
    if (this.isLoaded) return;
    try {
      if (fs.existsSync(BILLING_DATA_FILE)) {
        const raw = fs.readFileSync(BILLING_DATA_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.subscriptions)) {
          for (const s of parsed.subscriptions) {
            this.subscriptions.set(s.userId, s);
          }
        }
        if (parsed.invoices && typeof parsed.invoices === "object") {
          for (const [uid, invList] of Object.entries(parsed.invoices)) {
            this.invoices.set(uid, invList as BillingInvoice[]);
          }
        }
        if (Array.isArray(parsed.webhookEvents)) {
          for (const w of parsed.webhookEvents) {
            this.webhookEvents.set(`${w.provider}:${w.eventId}`, w);
          }
        }
        if (Array.isArray(parsed.usageQuotas)) {
          for (const q of parsed.usageQuotas) {
            this.usageQuotas.set(`${q.userId}:${q.periodYearMonth}`, q);
          }
        }
        if (Array.isArray(parsed.addonCredits)) {
          for (const c of parsed.addonCredits) {
            const list = this.addonCredits.get(c.userId) || [];
            list.push(c);
            this.addonCredits.set(c.userId, list);
          }
        }
      }
    } catch (e) {
      console.warn("Notice: could not load billing data from disk:", e);
    }
    this.isLoaded = true;
  }

  private saveToDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const data = {
        subscriptions: Array.from(this.subscriptions.values()),
        invoices: Object.fromEntries(this.invoices.entries()),
        webhookEvents: Array.from(this.webhookEvents.values()),
        usageQuotas: Array.from(this.usageQuotas.values()),
        addonCredits: Array.from(this.addonCredits.values()).flat()
      };
      fs.writeFileSync(BILLING_DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.warn("Notice: could not persist billing data to disk:", e);
    }
  }

  // --- Concurrency / Double-Charge Checkout Lock ---
  acquireCheckoutLock(userId: string): boolean {
    if (this.activeLocks.has(userId)) {
      return false; // Already processing checkout
    }
    this.activeLocks.add(userId);
    // Auto-release after 15 seconds to prevent deadlock on uncaught crashes
    setTimeout(() => {
      this.activeLocks.delete(userId);
    }, 15000);
    return true;
  }

  releaseCheckoutLock(userId: string) {
    this.activeLocks.delete(userId);
  }

  // --- Reusable Active Checkout Sessions ---
  saveActiveCheckoutSession(
    userId: string,
    data: { sessionId: string; checkoutUrl: string; action: string; planId: string; packId?: string }
  ) {
    const key = `${userId}:${data.action}:${data.planId}:${data.packId || ""}`;
    this.activeCheckoutSessions.set(key, {
      ...data,
      createdAt: Date.now()
    });
  }

  getActiveCheckoutSession(
    userId: string,
    action: string,
    planId: string,
    packId?: string
  ): { sessionId: string; checkoutUrl: string } | null {
    const key = `${userId}:${action}:${planId}:${packId || ""}`;
    const session = this.activeCheckoutSessions.get(key);
    if (!session) return null;
    // Sessions remain valid for 15 minutes
    if (Date.now() - session.createdAt > 15 * 60 * 1000) {
      this.activeCheckoutSessions.delete(key);
      return null;
    }
    return { sessionId: session.sessionId, checkoutUrl: session.checkoutUrl };
  }

  clearActiveCheckoutSession(userId: string) {
    for (const [key] of this.activeCheckoutSessions) {
      if (key.startsWith(`${userId}:`)) {
        this.activeCheckoutSessions.delete(key);
      }
    }
  }

  // --- Subscriptions ---
  async getSubscriptionByUserId(userId: string): Promise<UserSubscription | null> {
    if (this.supabase && UUID_REGEX.test(userId)) {
      try {
        const { data, error } = await this.supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          const sub = this.mapDbSubscription(data);
          this.subscriptions.set(userId, sub);
          return sub;
        } else if (error && error.code !== "PGRST205" && error.code !== "PGRST116") {
          console.warn("[BillingStore] Supabase subscription fetch notice:", error.message);
        }
      } catch {
        // Fall back to memory
      }
    }
    return this.subscriptions.get(userId) || null;
  }

  async saveSubscription(sub: UserSubscription): Promise<UserSubscription> {
    const existing = await this.getSubscriptionByUserId(sub.userId);
    if (existing && existing.subscriptionId === sub.subscriptionId) {
      const existingUpdate = new Date(existing.updatedAt).getTime();
      const newUpdate = new Date(sub.updatedAt).getTime();
      // Protect against out-of-order older events downgrading a newer active status
      if (newUpdate < existingUpdate && existing.status === "active" && sub.status !== "active") {
        console.warn(`[BillingStore] Ignoring out-of-order older event for subscription ${sub.subscriptionId}`);
        return existing;
      }

      // Protect against out-of-order older events shrinking an extended currentPeriodEnd
      if (
        existing.status === "active" &&
        sub.status === "active" &&
        new Date(existing.currentPeriodEnd).getTime() > new Date(sub.currentPeriodEnd).getTime()
      ) {
        console.warn(`[BillingStore] Retaining extended periodEnd ${existing.currentPeriodEnd} over older incoming ${sub.currentPeriodEnd}`);
        sub.currentPeriodEnd = existing.currentPeriodEnd;
      }
    }

    this.subscriptions.set(sub.userId, sub);
    this.saveToDisk();

    if (this.supabase && UUID_REGEX.test(sub.userId)) {
      try {
        const { error } = await this.supabase.from("subscriptions").upsert({
          id: sub.id,
          user_id: sub.userId,
          provider: sub.provider,
          customer_id: sub.customerId,
          subscription_id: sub.subscriptionId,
          plan_id: sub.planId,
          status: sub.status,
          current_period_start: sub.currentPeriodStart,
          current_period_end: sub.currentPeriodEnd,
          cancel_at_period_end: sub.cancelAtPeriodEnd,
          canceled_at: sub.canceledAt,
          updated_at: new Date().toISOString()
        }, { onConflict: "subscription_id" });
        if (error && error.code !== "PGRST205") {
          console.warn("[BillingStore] Supabase subscription save notice:", error.message);
        }
      } catch (e) {
        console.warn("Supabase subscription save notice:", e);
      }
    }

    return sub;
  }

  // --- Invoices ---
  async getInvoicesByUserId(userId: string): Promise<BillingInvoice[]> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from("billing_invoices")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (!error && data) {
          return data.map(this.mapDbInvoice);
        }
      } catch {
        // Fall back to memory
      }
    }
    return this.invoices.get(userId) || [];
  }

  async hasInvoiceWithProviderId(userId: string, providerInvoiceId: string): Promise<boolean> {
    const list = await this.getInvoicesByUserId(userId);
    return list.some((i) => i.providerInvoiceId === providerInvoiceId);
  }

  async saveInvoice(invoice: BillingInvoice): Promise<BillingInvoice> {
    const list = this.invoices.get(invoice.userId) || [];
    const existingIdx = list.findIndex((i) => i.id === invoice.id || i.providerInvoiceId === invoice.providerInvoiceId);
    if (existingIdx >= 0) {
      list[existingIdx] = invoice;
    } else {
      list.unshift(invoice);
    }
    this.invoices.set(invoice.userId, list);
    this.saveToDisk();

    if (this.supabase) {
      try {
        await this.supabase.from("billing_invoices").upsert({
          id: invoice.id,
          user_id: invoice.userId,
          provider_invoice_id: invoice.providerInvoiceId,
          amount_paid_cents: invoice.amountPaidCents,
          currency: invoice.currency,
          status: invoice.status,
          invoice_pdf_url: invoice.invoicePdfUrl,
          hosted_invoice_url: invoice.hostedInvoiceUrl,
          period_start: invoice.periodStart,
          period_end: invoice.periodEnd,
          created_at: invoice.createdAt
        }, { onConflict: "provider_invoice_id" });
      } catch (e) {
        console.warn("Supabase invoice save notice:", e);
      }
    }

    return invoice;
  }

  // --- Webhook Deduplication Ledger ---
  async isWebhookEventProcessed(provider: string, eventId: string): Promise<boolean> {
    const key = `${provider}:${eventId}`;
    if (this.webhookEvents.has(key)) {
      return true;
    }

    if (this.supabase) {
      try {
        const { data } = await this.supabase
          .from("billing_webhook_events")
          .select("id")
          .eq("provider", provider)
          .eq("event_id", eventId)
          .maybeSingle();

        if (data) {
          return true;
        }
      } catch {
        // fallback
      }
    }

    return false;
  }

  async recordWebhookEvent(
    provider: string,
    eventId: string,
    eventType: string,
    status: "processing" | "processed" | "failed" | "ignored" = "processed"
  ): Promise<void> {
    const key = `${provider}:${eventId}`;
    const record: ProcessedWebhookRecord = {
      id: `wbev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      provider,
      eventId,
      eventType,
      status,
      processedAt: new Date().toISOString()
    };

    this.webhookEvents.set(key, record);
    this.saveToDisk();

    if (this.supabase) {
      try {
        await this.supabase.from("billing_webhook_events").upsert({
          provider,
          event_id: eventId,
          event_type: eventType,
          status,
          processed_at: record.processedAt
        }, { onConflict: "provider,event_id" });
      } catch (e) {
        console.warn("Supabase webhook event log notice:", e);
      }
    }
  }

  private quotaLocks: Map<string, Promise<any>> = new Map();
  private processedTopUps: Set<string> = new Set();

  /**
   * Concurrency lock per user to serialize quota consumption and prevent race conditions.
   */
  async runWithQuotaLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    const currentLock = this.quotaLocks.get(userId) || Promise.resolve();
    let release: () => void;
    const nextLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.quotaLocks.set(userId, currentLock.then(() => nextLock));

    try {
      await currentLock;
      return await fn();
    } finally {
      release!();
      if (this.quotaLocks.get(userId) === nextLock) {
        this.quotaLocks.delete(userId);
      }
    }
  }

  getCurrentPeriodYearMonth(): string {
    return new Date().toISOString().slice(0, 7);
  }

  // --- Quota Tracking ---
  async saveUsageQuota(quota: UserUsageQuota): Promise<void> {
    const key = `${quota.userId}:${quota.periodYearMonth}`;
    this.usageQuotas.set(key, quota);
    this.saveToDisk();

    const supabase = this.getSupabase();
    if (supabase && UUID_REGEX.test(quota.userId)) {
      try {
        const topUpRemaining = quota.purchasedVoiceCredits
          ? Math.max(0, quota.purchasedVoiceCredits - (quota.usedVoiceCredits || 0))
          : 0;

        let userName = quota.userName;
        if (!userName && supabase) {
          try {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("id", quota.userId)
              .maybeSingle();
            if (profile) {
              userName = profile.full_name || profile.email?.split("@")[0] || null;
            }
          } catch {}
        }

        const payload: Record<string, any> = {
          user_id: quota.userId,
          user_name: userName || null,
          period_year_month: quota.periodYearMonth,
          voice_transcriptions_used: quota.voiceTranscriptionsUsed || 0,
          meetings_used: quota.meetingsUsed || 0,
          transcription_seconds_used: quota.transcriptionSecondsUsed ?? ((quota.voiceTranscriptionsUsed || 0) * 60),
          voice_typing_used: quota.voiceTypingUsed ?? 0,
          text_corrections_used: quota.textCorrectionsUsed ?? 0,
          meeting_summaries_used: quota.meetingSummariesUsed ?? 0,
          top_up_credits_remaining: topUpRemaining,
          updated_at: quota.updatedAt || new Date().toISOString()
        };

        const { error } = await supabase
          .from("usage_quotas")
          .upsert(payload, { onConflict: "user_id,period_year_month" });

        if (error) {
          // If the user_name column is not yet applied in production Supabase, gracefully retry without it
          if (error.message?.includes("user_name") || error.code === "42703" || (error.message && error.message.includes("column"))) {
            delete payload.user_name;
            const retryRes = await supabase
              .from("usage_quotas")
              .upsert(payload, { onConflict: "user_id,period_year_month" });
            if (retryRes.error) {
              console.error(`[BillingStore] Supabase usage_quotas retry failed for user ${quota.userId}:`, retryRes.error.message);
            }
          } else {
            console.error(`[BillingStore] Supabase usage_quotas upsert failed for user ${quota.userId}:`, error.message, error.code);
          }
        } else {
          console.log(JSON.stringify({
            event: "usage_quota_persisted",
            userId: quota.userId.length > 8 ? `${quota.userId.slice(0, 4)}...${quota.userId.slice(-4)}` : quota.userId,
            userName: userName || null,
            period: quota.periodYearMonth,
            typing: quota.voiceTypingUsed,
            seconds: quota.transcriptionSecondsUsed,
            meetings: quota.meetingsUsed,
            summaries: quota.meetingSummariesUsed,
            dbSuccess: true
          }));
        }
      } catch (e: any) {
        console.error(`[BillingStore] Supabase usage_quotas exception:`, e?.message || e);
      }
    }
  }

  async getUsageQuota(userId: string, periodYearMonth: string = this.getCurrentPeriodYearMonth()): Promise<UserUsageQuota> {
    const key = `${userId}:${periodYearMonth}`;

    // If Supabase is available and user is a valid UUID, read authoritative state from database first
    const supabase = this.getSupabase();
    if (supabase && UUID_REGEX.test(userId)) {
      try {
        const { data, error } = await supabase
          .from("usage_quotas")
          .select("*")
          .eq("user_id", userId)
          .eq("period_year_month", periodYearMonth)
          .maybeSingle();

        if (data && !error) {
          const mapped: UserUsageQuota = {
            userId: data.user_id,
            userName: data.user_name || undefined,
            periodYearMonth: data.period_year_month,
            voiceTranscriptionsUsed: data.voice_transcriptions_used || 0,
            meetingsUsed: data.meetings_used || 0,
            transcriptionSecondsUsed: data.transcription_seconds_used ?? (data.voice_transcriptions_used ? data.voice_transcriptions_used * 60 : 0),
            voiceTypingUsed: data.voice_typing_used ?? 0,
            textCorrectionsUsed: data.text_corrections_used ?? 0,
            meetingSummariesUsed: data.meeting_summaries_used ?? 0,
            purchasedVoiceCredits: data.top_up_credits_remaining ?? 0,
            usedVoiceCredits: 0,
            purchasedMeetingCredits: 0,
            usedMeetingCredits: 0,
            updatedAt: data.updated_at || new Date().toISOString()
          };

          // Overlay active in-memory add-on credits if present
          const voiceCredits = this.getAvailableAddonCredits(userId, "transcription_minutes");
          const meetingCredits = this.getAvailableAddonCredits(userId, "meeting");
          const voiceTypingCredits = this.getAvailableAddonCredits(userId, "voice_typing");
          if (voiceCredits.total > 0) {
            mapped.purchasedVoiceCredits = voiceCredits.remaining + (mapped.usedVoiceCredits || 0);
          }
          if (meetingCredits.total > 0) {
            mapped.purchasedMeetingCredits = meetingCredits.remaining + (mapped.usedMeetingCredits || 0);
          }
          if (voiceTypingCredits.total > 0) {
            mapped.purchasedVoiceTypingCredits = voiceTypingCredits.remaining + (mapped.usedVoiceTypingCredits || 0);
          }

          this.usageQuotas.set(key, mapped);
          return mapped;
        } else if (error && error.code !== "PGRST116") {
          console.warn(`[BillingStore] Supabase usage_quotas fetch warning:`, error.message);
        }
      } catch (err) {
        console.warn(`[BillingStore] Supabase usage_quotas fetch exception:`, err);
      }
    }

    const existing = this.usageQuotas.get(key);
    if (existing) {
      // Ensure all fields are present
      if (existing.transcriptionSecondsUsed === undefined) {
        existing.transcriptionSecondsUsed = (existing.voiceTranscriptionsUsed || 0) * 60;
      }
      if (existing.voiceTypingUsed === undefined) existing.voiceTypingUsed = 0;
      if (existing.textCorrectionsUsed === undefined) existing.textCorrectionsUsed = 0;
      if (existing.meetingSummariesUsed === undefined) existing.meetingSummariesUsed = 0;

      // Ensure active add-on credits are reflected accurately on current period
      if (periodYearMonth === this.getCurrentPeriodYearMonth()) {
        const voiceCredits = this.getAvailableAddonCredits(userId, "transcription_minutes");
        const meetingCredits = this.getAvailableAddonCredits(userId, "meeting");
        const voiceTypingCredits = this.getAvailableAddonCredits(userId, "voice_typing");
        existing.purchasedVoiceCredits = voiceCredits.remaining + (existing.usedVoiceCredits || 0);
        existing.purchasedMeetingCredits = meetingCredits.remaining + (existing.usedMeetingCredits || 0);
        existing.purchasedVoiceTypingCredits = voiceTypingCredits.remaining + (existing.usedVoiceTypingCredits || 0);
      }
      return existing;
    }

    // Compute unconsumed add-on credits from persistent ledger
    const initialVoiceCredits = this.getAvailableAddonCredits(userId, "transcription_minutes").remaining;
    const initialMeetingCredits = this.getAvailableAddonCredits(userId, "meeting").remaining;
    const initialVoiceTypingCredits = this.getAvailableAddonCredits(userId, "voice_typing").remaining;

    const newQuota: UserUsageQuota = {
      userId,
      periodYearMonth,
      voiceTranscriptionsUsed: 0,
      meetingsUsed: 0,
      transcriptionSecondsUsed: 0,
      voiceTypingUsed: 0,
      textCorrectionsUsed: 0,
      meetingSummariesUsed: 0,
      purchasedVoiceCredits: initialVoiceCredits,
      usedVoiceCredits: 0,
      purchasedMeetingCredits: initialMeetingCredits,
      usedMeetingCredits: 0,
      purchasedVoiceTypingCredits: initialVoiceTypingCredits,
      usedVoiceTypingCredits: 0,
      updatedAt: new Date().toISOString()
    };
    await this.saveUsageQuota(newQuota);
    return newQuota;
  }

  /**
   * Atomically increment usage quota
   */
  async incrementUsageQuota(
    userId: string,
    periodYearMonth: string = this.getCurrentPeriodYearMonth(),
    feature: "voice" | "meeting" | "transcription_seconds" | "voice_typing" | "text_correction" | "summary",
    amount = 1
  ): Promise<UserUsageQuota> {
    const quota = await this.getUsageQuota(userId, periodYearMonth);
    if (feature === "transcription_seconds") {
      quota.transcriptionSecondsUsed = (quota.transcriptionSecondsUsed || 0) + amount;
      quota.voiceTranscriptionsUsed = Math.ceil(quota.transcriptionSecondsUsed / 60);
    } else if (feature === "voice_typing") {
      quota.voiceTypingUsed = (quota.voiceTypingUsed || 0) + amount;
    } else if (feature === "text_correction") {
      quota.textCorrectionsUsed = (quota.textCorrectionsUsed || 0) + amount;
    } else if (feature === "summary") {
      quota.meetingSummariesUsed = (quota.meetingSummariesUsed || 0) + amount;
    } else if (feature === "meeting") {
      quota.meetingsUsed = (quota.meetingsUsed || 0) + amount;
    } else if (feature === "voice") {
      quota.voiceTranscriptionsUsed += amount;
      quota.voiceTypingUsed = (quota.voiceTypingUsed || 0) + amount;
    }
    quota.updatedAt = new Date().toISOString();
    await this.saveUsageQuota(quota);
    return quota;
  }

  async setUsageQuota(
    userId: string,
    periodYearMonth: string = this.getCurrentPeriodYearMonth(),
    voiceTranscriptionsUsed: number,
    meetingsUsed: number,
    transcriptionSecondsUsed?: number,
    voiceTypingUsed?: number
  ): Promise<UserUsageQuota> {
    const quota = await this.getUsageQuota(userId, periodYearMonth);
    quota.voiceTranscriptionsUsed = voiceTranscriptionsUsed;
    quota.meetingsUsed = meetingsUsed;
    if (transcriptionSecondsUsed !== undefined) {
      quota.transcriptionSecondsUsed = transcriptionSecondsUsed;
    } else {
      quota.transcriptionSecondsUsed = voiceTranscriptionsUsed * 60;
    }
    if (voiceTypingUsed !== undefined) {
      quota.voiceTypingUsed = voiceTypingUsed;
    }
    quota.updatedAt = new Date().toISOString();
    await this.saveUsageQuota(quota);
    return quota;
  }

  /**
   * Reset recurring period quota counters for genuine period boundaries.
   * NOTE: Must NEVER be called during early renewals, extensions, or add-on purchases.
   */
  async resetMonthlyQuota(userId: string, periodYearMonth: string = this.getCurrentPeriodYearMonth()): Promise<UserUsageQuota> {
    const quota = await this.getUsageQuota(userId, periodYearMonth);
    quota.voiceTranscriptionsUsed = 0;
    quota.meetingsUsed = 0;
    quota.transcriptionSecondsUsed = 0;
    quota.voiceTypingUsed = 0;
    quota.textCorrectionsUsed = 0;
    quota.meetingSummariesUsed = 0;
    quota.updatedAt = new Date().toISOString();
    await this.saveUsageQuota(quota);
    return quota;
  }

  /**
   * Check if a top-up payment ID has already been credited to prevent duplicate grants
   */
  hasTopUpPaymentProcessed(paymentId: string): boolean {
    return this.processedTopUps.has(paymentId);
  }

  /**
   * Get all active and unexpired add-on credits for a user and quota type
   */
  getAvailableAddonCredits(
    userId: string,
    quotaType: "transcription_minutes" | "voice_typing" | "meeting" | "text_correction" | "summary"
  ): { total: number; used: number; remaining: number; records: AddonCreditRecord[] } {
    const list = this.addonCredits.get(userId) || [];
    const now = new Date();

    let total = 0;
    let used = 0;
    let remaining = 0;
    const activeRecords: AddonCreditRecord[] = [];

    for (const record of list) {
      if (record.quotaType === quotaType) {
        const isExpired = record.expiresAt ? new Date(record.expiresAt) <= now : false;
        if (!isExpired) {
          total += record.amount;
          used += record.usedAmount;
          remaining += Math.max(0, record.amount - record.usedAmount);
          activeRecords.push(record);
        }
      }
    }

    // Support legacy credits stored in the current period quota record if not in ledger
    const periodKey = this.getCurrentPeriodYearMonth();
    const quota = this.usageQuotas.get(`${userId}:${periodKey}`);
    if (quota && activeRecords.length === 0) {
      if (quotaType === "transcription_minutes" && (quota.purchasedVoiceCredits || 0) > 0) {
        total += quota.purchasedVoiceCredits || 0;
        used += quota.usedVoiceCredits || 0;
        remaining += Math.max(0, (quota.purchasedVoiceCredits || 0) - (quota.usedVoiceCredits || 0));
      } else if (quotaType === "meeting" && (quota.purchasedMeetingCredits || 0) > 0) {
        total += quota.purchasedMeetingCredits || 0;
        used += quota.usedMeetingCredits || 0;
        remaining += Math.max(0, (quota.purchasedMeetingCredits || 0) - (quota.usedMeetingCredits || 0));
      } else if (quotaType === "voice_typing" && (quota.purchasedVoiceTypingCredits || 0) > 0) {
        total += quota.purchasedVoiceTypingCredits || 0;
        used += quota.usedVoiceTypingCredits || 0;
        remaining += Math.max(0, (quota.purchasedVoiceTypingCredits || 0) - (quota.usedVoiceTypingCredits || 0));
      }
    }

    return { total, used, remaining, records: activeRecords };
  }

  /**
   * Consume add-on credits:
   * Consumes earliest-expiring credits first, then FIFO by creation date.
   */
  async consumeAddonCredits(
    userId: string,
    quotaType: "transcription_minutes" | "voice_typing" | "meeting" | "text_correction" | "summary",
    amount: number
  ): Promise<boolean> {
    const list = this.addonCredits.get(userId) || [];
    const now = new Date();

    const candidateRecords = list
      .filter((r) => r.quotaType === quotaType && (!r.expiresAt || new Date(r.expiresAt) > now) && r.usedAmount < r.amount)
      .sort((a, b) => {
        // 1. Expiring records first (earliest expiry first)
        if (a.expiresAt && b.expiresAt) return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
        if (a.expiresAt) return -1;
        if (b.expiresAt) return 1;
        // 2. FIFO by createdAt
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    let needed = amount;
    const touchedRecords: AddonCreditRecord[] = [];
    for (const record of candidateRecords) {
      const avail = record.amount - record.usedAmount;
      const toTake = Math.min(avail, needed);
      record.usedAmount += toTake;
      needed -= toTake;
      touchedRecords.push(record);
      if (needed <= 0) break;
    }

    this.saveToDisk();

    // Persist updated credit consumption to Supabase if available
    if (this.supabase && UUID_REGEX.test(userId)) {
      for (const record of touchedRecords) {
        try {
          const { error } = await this.supabase
            .from("addon_credits")
            .update({
              used_amount: record.usedAmount,
              updated_at: new Date().toISOString()
            })
            .eq("id", record.id);
          if (error && error.code !== "PGRST205") {
            console.warn(`[BillingStore] Supabase addon_credits consumption update notice:`, error.message);
          }
        } catch {
          // Fallback safely if remote table not yet created
        }
      }
    }

    return needed <= 0;
  }

  /**
   * Add purchased add-on credits record with strict idempotency protection
   */
  async addAddonCredits(params: {
    userId: string;
    quotaType: "transcription_minutes" | "voice_typing" | "meeting" | "text_correction" | "summary";
    amount: number;
    paymentId: string;
    expiresAt?: string | null;
  }): Promise<{ record: AddonCreditRecord; alreadyProcessed: boolean }> {
    const { userId, quotaType, amount, paymentId, expiresAt } = params;
    const dedupKey = `${userId}:${paymentId}:${quotaType}`;

    if (this.processedTopUps.has(dedupKey) || this.processedTopUps.has(paymentId)) {
      const existingList = this.addonCredits.get(userId) || [];
      const match = existingList.find((r) => r.paymentId === paymentId && r.quotaType === quotaType);
      if (match) {
        return { record: match, alreadyProcessed: true };
      }
    }

    this.processedTopUps.add(dedupKey);
    this.processedTopUps.add(paymentId);

    const record: AddonCreditRecord = {
      id: `addon_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId,
      quotaType,
      amount,
      usedAmount: 0,
      paymentId,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt || null
    };

    const userCredits = this.addonCredits.get(userId) || [];
    userCredits.push(record);
    this.addonCredits.set(userId, userCredits);

    // Update backward-compatible quota counters on the current period
    const periodKey = this.getCurrentPeriodYearMonth();
    const quota = await this.getUsageQuota(userId, periodKey);
    const voiceCredits = this.getAvailableAddonCredits(userId, "transcription_minutes");
    const meetingCredits = this.getAvailableAddonCredits(userId, "meeting");
    const voiceTypingCredits = this.getAvailableAddonCredits(userId, "voice_typing");
    quota.purchasedVoiceCredits = voiceCredits.remaining + (quota.usedVoiceCredits || 0);
    quota.purchasedMeetingCredits = meetingCredits.remaining + (quota.usedMeetingCredits || 0);
    quota.purchasedVoiceTypingCredits = voiceTypingCredits.remaining + (quota.usedVoiceTypingCredits || 0);
    quota.updatedAt = new Date().toISOString();
    await this.saveUsageQuota(quota);

    this.saveToDisk();

    // Persist to Supabase if available
    if (this.supabase && UUID_REGEX.test(userId)) {
      try {
        const { error } = await this.supabase.from("addon_credits").upsert({
          id: record.id,
          user_id: record.userId,
          quota_type: record.quotaType,
          amount: record.amount,
          used_amount: record.usedAmount,
          payment_id: record.paymentId,
          created_at: record.createdAt,
          expires_at: record.expiresAt
        }, { onConflict: "user_id,payment_id,quota_type" });
        if (error && error.code !== "PGRST205") {
          console.warn("[BillingStore] Supabase addon_credits save notice:", error.message);
        }
      } catch (e) {
        // Fallback safely if table not yet created remotely
      }
    }

    return { record, alreadyProcessed: false };
  }

  /**
   * Atomically add purchased top-up credits with idempotency protection
   */
  async addPurchasedCredits(
    userId: string,
    periodYearMonth: string,
    voiceCredits: number,
    meetingCredits: number,
    paymentId?: string,
    expiresAt?: string | null
  ): Promise<{ quota: UserUsageQuota; alreadyProcessed: boolean }> {
    const pId = paymentId || `pay_addon_${Date.now()}`;
    let already = false;

    if (paymentId && this.processedTopUps.has(paymentId)) {
      already = true;
    }

    if (voiceCredits > 0) {
      const res = await this.addAddonCredits({
        userId,
        quotaType: "transcription_minutes",
        amount: voiceCredits,
        paymentId: pId,
        expiresAt
      });
      if (res.alreadyProcessed) already = true;
    }

    if (meetingCredits > 0) {
      const res = await this.addAddonCredits({
        userId,
        quotaType: "meeting",
        amount: meetingCredits,
        paymentId: pId,
        expiresAt
      });
      if (res.alreadyProcessed) already = true;
    }

    const quota = await this.getUsageQuota(userId, periodYearMonth);
    return { quota, alreadyProcessed: already };
  }

  /**
   * Atomically consume purchased credits
   */
  async incrementUsedCredits(
    userId: string,
    periodYearMonth: string,
    feature: "voice" | "meeting" | "transcription_seconds",
    amount = 1
  ): Promise<UserUsageQuota> {
    const quota = await this.getUsageQuota(userId, periodYearMonth);
    const quotaType = feature === "voice" || feature === "transcription_seconds" ? "transcription_minutes" : "meeting";
    const minutesEquivalent = feature === "transcription_seconds" ? Math.ceil(amount / 60) : amount;
    this.consumeAddonCredits(userId, quotaType, minutesEquivalent);
    if (feature === "transcription_seconds") {
      quota.usedVoiceCredits = (quota.usedVoiceCredits || 0) + minutesEquivalent;
    } else if (feature === "voice") {
      quota.usedVoiceCredits = (quota.usedVoiceCredits || 0) + amount;
    } else {
      quota.usedMeetingCredits = (quota.usedMeetingCredits || 0) + amount;
    }
    quota.updatedAt = new Date().toISOString();
    await this.saveUsageQuota(quota);
    return quota;
  }

  // --- Clear for testing ---
  resetForTesting() {
    this.subscriptions.clear();
    this.invoices.clear();
    this.webhookEvents.clear();
    this.usageQuotas.clear();
    this.addonCredits.clear();
    this.activeLocks.clear();
    this.processedTopUps.clear();
    this.quotaLocks.clear();
  }

  private mapDbSubscription(row: any): UserSubscription {
    return {
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      customerId: row.customer_id,
      subscriptionId: row.subscription_id,
      planId: row.plan_id,
      status: row.status,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      canceledAt: row.canceled_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapDbInvoice(row: any): BillingInvoice {
    return {
      id: row.id,
      userId: row.user_id,
      providerInvoiceId: row.provider_invoice_id,
      amountPaidCents: row.amount_paid_cents,
      currency: row.currency,
      status: row.status,
      invoicePdfUrl: row.invoice_pdf_url,
      hostedInvoiceUrl: row.hosted_invoice_url,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      createdAt: row.created_at
    };
  }
}

export const billingStore = new BillingStoreService();
