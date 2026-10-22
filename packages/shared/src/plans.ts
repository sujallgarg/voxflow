export type SubscriptionStatus =
  | "free"
  | "incomplete"
  | "active"
  | "past_due"
  | "cancel_at_period_end"
  | "canceled"
  | "expired";

export type PlanId = "free" | "premium_monthly" | "business_monthly";

export interface PlanLimits {
  /** Maximum voice transcription minutes per month */
  transcriptionMinutes: number;
  /** Maximum voice typing requests per month */
  voiceTypingRequests: number;
  /** Maximum AI text correction requests per month */
  textCorrectionRequests: number;
  /** Maximum meeting records created or processed per month */
  monthlyMeetings: number;
  /** Maximum AI meeting summaries per month */
  meetingSummaries: number;
  /** Meeting history retention in days, or null for no fixed limit (fair use) */
  historyRetentionDays: number | null;
  /** Maximum duration in seconds for a single audio recording */
  maxAudioDurationSeconds: number;
  /** Whether advanced meeting intelligence (topics, decisions, action items) is enabled */
  advancedMeetingNotes: boolean;
  /** Priority processing flag on backend queues */
  priorityProcessing: boolean;
  /** Supported export formats */
  exportFormats: string[];
  /** Legacy alias for backward compatibility */
  monthlyVoiceTranscriptions?: number;
}

export interface PlanConfig {
  id: PlanId;
  name: string;
  tagline: string;
  priceUsd: number;
  currency: string;
  interval: "month";
  status?: "active" | "coming_soon";
  isAvailable?: boolean;
  limits: PlanLimits;
  features: string[];
}

export const PLAN_CONFIGS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "Essential voice input and lightweight meeting capture.",
    priceUsd: 0,
    currency: "USD",
    interval: "month",
    status: "active",
    isAvailable: true,
    limits: {
      transcriptionMinutes: 30,
      voiceTypingRequests: 100,
      textCorrectionRequests: 50,
      monthlyMeetings: 3,
      meetingSummaries: 3,
      historyRetentionDays: 7,
      maxAudioDurationSeconds: 120, // 2 mins per audio clip
      advancedMeetingNotes: false,
      priorityProcessing: false,
      exportFormats: ["text"],
      monthlyVoiceTranscriptions: 30
    },
    features: [
      "30 minutes voice transcription / month",
      "100 voice typing requests / month",
      "50 AI text correction requests / month",
      "Up to 3 meeting notes & summaries / month",
      "7-day meeting history retention",
      "Standard processing queue"
    ]
  },
  premium_monthly: {
    id: "premium_monthly",
    name: "Pro",
    tagline: "Expanded voice intelligence, deep meeting analytics, and priority processing.",
    priceUsd: 9,
    currency: "USD",
    interval: "month",
    status: "active",
    isAvailable: true,
    limits: {
      transcriptionMinutes: 300,
      voiceTypingRequests: 1000,
      textCorrectionRequests: 500,
      monthlyMeetings: 25,
      meetingSummaries: 25,
      historyRetentionDays: null, // No fixed time limit, fair-use policy
      maxAudioDurationSeconds: 7200, // 2 hours per meeting recording
      advancedMeetingNotes: true,
      priorityProcessing: true,
      exportFormats: ["text", "markdown", "json"],
      monthlyVoiceTranscriptions: 300
    },
    features: [
      "300 minutes voice transcription / month",
      "1,000 voice typing requests / month",
      "500 AI text correction requests / month",
      "Up to 25 meeting notes & summaries / month",
      "Full meeting history retention (fair-use)",
      "Advanced meeting intelligence (decisions & action items)",
      "Priority processing queue",
      "Active Premium badge & full billing portal"
    ]
  },
  business_monthly: {
    id: "business_monthly",
    name: "Business",
    tagline: "High-volume transcription, shared workspaces, and team intelligence.",
    priceUsd: 29,
    currency: "USD",
    interval: "month",
    status: "coming_soon",
    isAvailable: false,
    limits: {
      transcriptionMinutes: 1000,
      voiceTypingRequests: 3000,
      textCorrectionRequests: 1500,
      monthlyMeetings: 100,
      meetingSummaries: 100,
      historyRetentionDays: null,
      maxAudioDurationSeconds: 14400,
      advancedMeetingNotes: true,
      priorityProcessing: true,
      exportFormats: ["text", "markdown", "json", "pdf"],
      monthlyVoiceTranscriptions: 1000
    },
    features: [
      "1,000 minutes voice transcription / month (Planned)",
      "3,000 voice typing requests / month (Planned)",
      "1,500 AI text correction requests / month (Planned)",
      "Up to 100 meeting notes & summaries / month (Planned)",
      "5 team seats included (Planned)",
      "Shared meeting workspace (Planned)"
    ]
  }
};

export interface AddOnPack {
  id: string;
  minutes: number;
  priceUsd: number;
  priceCents: number;
  proposed: boolean;
  label: string;
  description: string;
}

export const ADDON_PACKS: AddOnPack[] = [
  {
    id: "addon_transcription_60",
    minutes: 60,
    priceUsd: 2,
    priceCents: 200,
    proposed: true,
    label: "60 Additional Minutes",
    description: "60 additional voice transcription minutes (Proposed: $2 USD one-time)"
  },
  {
    id: "addon_transcription_150",
    minutes: 150,
    priceUsd: 4,
    priceCents: 400,
    proposed: true,
    label: "150 Additional Minutes",
    description: "150 additional voice transcription minutes (Proposed: $4 USD one-time)"
  },
  {
    id: "addon_transcription_300",
    minutes: 300,
    priceUsd: 7,
    priceCents: 700,
    proposed: true,
    label: "300 Additional Minutes",
    description: "300 additional voice transcription minutes (Proposed: $7 USD one-time)"
  }
];

export interface UserSubscription {
  id: string;
  userId: string;
  provider: "dodo" | "mock";
  customerId: string;
  subscriptionId: string;
  planId: PlanId;
  status: SubscriptionStatus;
  currentPeriodStart: string; // ISO UTC
  currentPeriodEnd: string;   // ISO UTC
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;  // ISO UTC
  createdAt: string;          // ISO UTC
  updatedAt: string;          // ISO UTC
}

export interface FeatureUsageBreakdown {
  used: number;
  limit: number;
  remaining: number;
  isExhausted: boolean;
  unit?: string;
  purchasedCredits: number;
  usedCredits: number;
  remainingCredits: number;
  totalRemaining: number;
}

export interface DetailedUsageBreakdown {
  transcriptionMinutes: FeatureUsageBreakdown;
  voiceTyping: FeatureUsageBreakdown;
  textCorrection: FeatureUsageBreakdown;
  meetings: FeatureUsageBreakdown;
  summaries: FeatureUsageBreakdown;
}

export interface UserUsageQuota {
  userId: string;
  periodYearMonth: string; // Format: YYYY-MM
  voiceTranscriptionsUsed: number; // legacy alias (in minutes)
  meetingsUsed: number;
  transcriptionSecondsUsed?: number;
  voiceTypingUsed?: number;
  textCorrectionsUsed?: number;
  meetingSummariesUsed?: number;
  purchasedVoiceCredits?: number;
  purchasedMeetingCredits?: number;
  usedVoiceCredits?: number;
  usedMeetingCredits?: number;
  updatedAt: string;
}

export interface TopUpConfig {
  id: string;
  name: string;
  priceUsd: number;
  priceCents: number;
  voiceCredits: number;
  meetingCredits: number;
  terms: string;
}

export const TOPUP_CONFIG: TopUpConfig = {
  id: "topup_pack",
  name: "Pro Usage Top-Up Pack",
  priceUsd: 5,
  priceCents: 500,
  voiceCredits: 1000,
  meetingCredits: 50,
  terms: "One-time purchase for Pro plan members. Top-up credits are consumed only after the recurring monthly allowance is exhausted. Valid until the end of the current billing cycle."
};

export interface UserEntitlements {
  userId: string;
  planId: PlanId;
  planName: string;
  status: SubscriptionStatus;
  isPremium: boolean;
  expiresAt: string | null;
  cancelAtPeriodEnd: boolean;
  limits: PlanLimits;
  resetDate?: string;
  voice?: FeatureUsageBreakdown;
  meetings?: FeatureUsageBreakdown;
  breakdown?: DetailedUsageBreakdown;
  usage: {
    periodYearMonth: string;
    transcriptionSecondsUsed: number;
    transcriptionMinutesUsed: number;
    transcriptionMinutesLimit: number;
    voiceTypingUsed: number;
    voiceTypingLimit: number;
    textCorrectionsUsed: number;
    textCorrectionsLimit: number;
    meetingsUsed: number;
    meetingsLimit: number;
    meetingSummariesUsed: number;
    meetingSummariesLimit: number;
    voiceTranscriptionsUsed: number;
    voiceTranscriptionsLimit: number;
    voice?: FeatureUsageBreakdown;
    meetings?: FeatureUsageBreakdown;
    breakdown?: DetailedUsageBreakdown;
  };
}

export interface BillingInvoice {
  id: string;
  userId: string;
  providerInvoiceId: string;
  amountPaidCents: number;
  currency: string;
  status: "paid" | "open" | "void" | "uncollectible";
  invoicePdfUrl?: string;
  hostedInvoiceUrl?: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}
