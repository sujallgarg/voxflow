import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  UserSubscription,
  BillingInvoice,
  UserUsageQuota,
  SubscriptionStatus,
  PlanId
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
  private activeLocks: Set<string> = new Set();                      // checkout concurrency locks
  private activeCheckoutSessions: Map<string, { sessionId: string; checkoutUrl: string; createdAt: number; action: string; planId: string; packId?: string }> = new Map();
  private supabase: SupabaseClient | null = null;
  private isLoaded = false;

  constructor() {
    this.initSupabase();
    this.loadFromDisk();
  }

  private initSupabase() {
    if (
      SUPABASE_URL &&
      SUPABASE_KEY &&
      SUPABASE_URL.startsWith("https://") &&
      !SUPABASE_URL.includes("placeholder")
    ) {
      try {
        this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
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
        usageQuotas: Array.from(this.usageQuotas.values())
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
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          return this.mapDbSubscription(data);
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
    }

    this.subscriptions.set(sub.userId, sub);
    this.saveToDisk();

    if (this.supabase) {
      try {
        await this.supabase.from("subscriptions").upsert({
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

    if (this.supabase) {
      try {
        const payload: Record<string, any> = {
          user_id: quota.userId,
          period_year_month: quota.periodYearMonth,
          voice_transcriptions_used: quota.voiceTranscriptionsUsed,
          meetings_used: quota.meetingsUsed,
          updated_at: quota.updatedAt
        };
        if (quota.transcriptionSecondsUsed !== undefined) payload.transcription_seconds_used = quota.transcriptionSecondsUsed;
        if (quota.voiceTypingUsed !== undefined) payload.voice_typing_used = quota.voiceTypingUsed;
        if (quota.textCorrectionsUsed !== undefined) payload.text_corrections_used = quota.textCorrectionsUsed;
        if (quota.meetingSummariesUsed !== undefined) payload.meeting_summaries_used = quota.meetingSummariesUsed;
        if (quota.purchasedVoiceCredits !== undefined) payload.purchased_voice_credits = quota.purchasedVoiceCredits;
        if (quota.usedVoiceCredits !== undefined) payload.used_voice_credits = quota.usedVoiceCredits;
        if (quota.purchasedMeetingCredits !== undefined) payload.purchased_meeting_credits = quota.purchasedMeetingCredits;
        if (quota.usedMeetingCredits !== undefined) payload.used_meeting_credits = quota.usedMeetingCredits;

        await this.supabase.from("usage_quotas").upsert(payload, { onConflict: "user_id,period_year_month" });
      } catch (e) {
        // Fallback safely if remote columns not yet added
      }
    }
  }

  async getUsageQuota(userId: string, periodYearMonth: string = this.getCurrentPeriodYearMonth()): Promise<UserUsageQuota> {
    const key = `${userId}:${periodYearMonth}`;
    const existing = this.usageQuotas.get(key);
    if (existing) {
      // Ensure all fields are present
      if (existing.transcriptionSecondsUsed === undefined) {
        existing.transcriptionSecondsUsed = (existing.voiceTranscriptionsUsed || 0) * 60;
      }
      if (existing.voiceTypingUsed === undefined) existing.voiceTypingUsed = 0;
      if (existing.textCorrectionsUsed === undefined) existing.textCorrectionsUsed = 0;
      if (existing.meetingSummariesUsed === undefined) existing.meetingSummariesUsed = 0;
      return existing;
    }

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from("usage_quotas")
          .select("*")
          .eq("user_id", userId)
          .eq("period_year_month", periodYearMonth)
          .single();

        if (data && !error) {
          const mapped: UserUsageQuota = {
            userId: data.user_id,
            periodYearMonth: data.period_year_month,
            voiceTranscriptionsUsed: data.voice_transcriptions_used || 0,
            meetingsUsed: data.meetings_used || 0,
            transcriptionSecondsUsed: data.transcription_seconds_used ?? (data.voice_transcriptions_used ? data.voice_transcriptions_used * 60 : 0),
            voiceTypingUsed: data.voice_typing_used ?? 0,
            textCorrectionsUsed: data.text_corrections_used ?? 0,
            meetingSummariesUsed: data.meeting_summaries_used ?? 0,
            purchasedVoiceCredits: data.purchased_voice_credits ?? 0,
            usedVoiceCredits: data.used_voice_credits ?? 0,
            purchasedMeetingCredits: data.purchased_meeting_credits ?? 0,
            usedMeetingCredits: data.used_meeting_credits ?? 0,
            updatedAt: data.updated_at || new Date().toISOString()
          };
          this.usageQuotas.set(key, mapped);
          return mapped;
        }
      } catch {
        // Fallback to memory
      }
    }

    // Preserve purchased top-up credits across ordinary monthly subscription renewals:
    // Aggregate unused purchased top-up minutes from previous periods
    let carryOverVoiceCredits = 0;
    let carryOverMeetingCredits = 0;

    for (const [k, q] of this.usageQuotas.entries()) {
      if (k.startsWith(`${userId}:`) && k !== key) {
        const netVoice = (q.purchasedVoiceCredits || 0) - (q.usedVoiceCredits || 0);
        if (netVoice > 0) {
          carryOverVoiceCredits += netVoice;
        }
        const netMeeting = (q.purchasedMeetingCredits || 0) - (q.usedMeetingCredits || 0);
        if (netMeeting > 0) {
          carryOverMeetingCredits += netMeeting;
        }
      }
    }

    const newQuota: UserUsageQuota = {
      userId,
      periodYearMonth,
      voiceTranscriptionsUsed: 0,
      meetingsUsed: 0,
      transcriptionSecondsUsed: 0,
      voiceTypingUsed: 0,
      textCorrectionsUsed: 0,
      meetingSummariesUsed: 0,
      purchasedVoiceCredits: carryOverVoiceCredits,
      usedVoiceCredits: 0,
      purchasedMeetingCredits: carryOverMeetingCredits,
      usedMeetingCredits: 0,
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
    transcriptionSecondsUsed?: number
  ): Promise<UserUsageQuota> {
    const quota = await this.getUsageQuota(userId, periodYearMonth);
    quota.voiceTranscriptionsUsed = voiceTranscriptionsUsed;
    quota.meetingsUsed = meetingsUsed;
    if (transcriptionSecondsUsed !== undefined) {
      quota.transcriptionSecondsUsed = transcriptionSecondsUsed;
    } else {
      quota.transcriptionSecondsUsed = voiceTranscriptionsUsed * 60;
    }
    quota.updatedAt = new Date().toISOString();
    await this.saveUsageQuota(quota);
    return quota;
  }

  /**
   * Reset monthly usage quota counters upon early renewal (preserving purchased top-up credits)
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
   * Atomically add purchased top-up credits with idempotency protection
   */
  async addPurchasedCredits(
    userId: string,
    periodYearMonth: string,
    voiceCredits: number,
    meetingCredits: number,
    paymentId?: string
  ): Promise<{ quota: UserUsageQuota; alreadyProcessed: boolean }> {
    if (paymentId && this.processedTopUps.has(paymentId)) {
      const existingQuota = await this.getUsageQuota(userId, periodYearMonth);
      return { quota: existingQuota, alreadyProcessed: true };
    }

    if (paymentId) {
      this.processedTopUps.add(paymentId);
    }

    const quota = await this.getUsageQuota(userId, periodYearMonth);
    quota.purchasedVoiceCredits = (quota.purchasedVoiceCredits || 0) + voiceCredits;
    quota.purchasedMeetingCredits = (quota.purchasedMeetingCredits || 0) + meetingCredits;
    quota.updatedAt = new Date().toISOString();
    await this.saveUsageQuota(quota);
    return { quota, alreadyProcessed: false };
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
    if (feature === "transcription_seconds") {
      const minutesEquivalent = Math.ceil(amount / 60);
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
