import { supabase } from "./supabase";

const configuredApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
export const API_BASE_URL = configuredApiUrl
  ? configuredApiUrl.replace(/\/+$/, "")
  : (import.meta.env.PROD ? "" : "http://localhost:3001");

export interface LanguageResult {
  primaryLanguage: string;
  languageCode: string;
  languages: string[];
  mixedLanguage: boolean;
  confidence: number;
}

export interface UnderstandingResult {
  meaning: string;
  intent: string;
  languages: string[];
  mixedLanguage: boolean;
  importantDetails: string[];
}

export interface ContextResult {
  audience: string;
  communicationType: string;
  tone: string;
  formality: string;
  likelyChannel: string;
  purpose: string;
  confidence: number;
}

export interface TransformationResult {
  finalText: string;
  targetLanguage: string;
  transformation: string;
}

export interface ProcessPipelineResult {
  transcript: string;
  language: LanguageResult;
  understanding: UnderstandingResult;
  context: ContextResult;
  transformation: TransformationResult;
}

export interface ActionItemResult {
  task: string;
  assignee: string;
  dueDate: string;
  completed: boolean;
}

export interface DecisionResult {
  decision: string;
  context: string;
}

export interface TopicResult {
  title: string;
  summary: string;
}

export interface MeetingNotesResult {
  title: string;
  summary: string;
  keyPoints: string[];
  decisions: DecisionResult[];
  actionItems: ActionItemResult[];
  followUps: string[];
  topics: TopicResult[];
  primaryLanguages: string[];
}

class VoxFlowApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async transcribeAudio(audioBlob: Blob, filename = "voxflow-recording.webm", userId?: string): Promise<{ text: string }> {
    const authHeaders = await this.getAuthHeaders(userId);
    const formData = new FormData();
    formData.append("audio", audioBlob, filename);

    const res = await fetch(`${this.baseUrl}/transcribe`, {
      method: "POST",
      headers: {
        ...authHeaders
      },
      body: formData
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Transcription failed with HTTP ${res.status}`);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("voxflow_subscription_updated"));
    }
    return res.json();
  }

  async demoProcessAudio(
    audioBlob: Blob,
    targetLanguage?: string,
    filename = "voxflow-demo.webm"
  ): Promise<{
    success: boolean;
    isGuestDemo: boolean;
    text: string;
    pipeline: ProcessPipelineResult;
    remainingDemoRequests?: number;
  }> {
    const formData = new FormData();
    formData.append("audio", audioBlob, filename);
    if (targetLanguage && targetLanguage !== "Auto") {
      formData.append("targetLanguage", targetLanguage);
    }

    const res = await fetch(`${this.baseUrl}/demo/process-audio`, {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const error: any = new Error(errData.error || `Demo processing failed with HTTP ${res.status}`);
      error.code = errData.code;
      error.remainingDemoRequests = errData.remainingDemoRequests;
      throw error;
    }

    return res.json();
  }

  async detectLanguage(transcript: string, userId?: string): Promise<LanguageResult> {
    const authHeaders = await this.getAuthHeaders(userId);
    const res = await fetch(`${this.baseUrl}/detect-language`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders
      },
      body: JSON.stringify({ transcript })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Language detection failed with HTTP ${res.status}`);
    }

    return res.json();
  }

  async understand(transcript: string, userId?: string): Promise<UnderstandingResult> {
    const authHeaders = await this.getAuthHeaders(userId);
    const res = await fetch(`${this.baseUrl}/understand`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders
      },
      body: JSON.stringify({ transcript })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Understanding failed with HTTP ${res.status}`);
    }

    return res.json();
  }

  async detectContext(transcript: string, userId?: string): Promise<ContextResult> {
    const authHeaders = await this.getAuthHeaders(userId);
    const res = await fetch(`${this.baseUrl}/detect-context`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders
      },
      body: JSON.stringify({ transcript })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Context detection failed with HTTP ${res.status}`);
    }

    return res.json();
  }

  async transform(input: {
    transcript: string;
    meaning?: string;
    intent?: string;
    audience?: string;
    communicationType?: string;
    tone?: string;
    formality?: string;
    likelyChannel?: string;
    purpose?: string;
    targetLanguage?: string;
  }, userId?: string): Promise<TransformationResult> {
    const authHeaders = await this.getAuthHeaders(userId);
    const res = await fetch(`${this.baseUrl}/transform`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders
      },
      body: JSON.stringify(input)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Transformation failed with HTTP ${res.status}`);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("voxflow_subscription_updated"));
    }
    return res.json();
  }

  async processVoice(transcript: string, targetLanguage?: string, userId?: string): Promise<ProcessPipelineResult> {
    const authHeaders = await this.getAuthHeaders(userId);
    const res = await fetch(`${this.baseUrl}/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders
      },
      body: JSON.stringify({ transcript, targetLanguage })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Pipeline failed with HTTP ${res.status}`);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("voxflow_subscription_updated"));
    }
    return res.json();
  }

  async generateMeetingNotes(transcript: string, title?: string, userId?: string): Promise<MeetingNotesResult> {
    const authHeaders = await this.getAuthHeaders(userId);
    const res = await fetch(`${this.baseUrl}/meeting-notes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders
      },
      body: JSON.stringify({ transcript, title })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Meeting notes failed with HTTP ${res.status}`);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("voxflow_subscription_updated"));
    }
    return res.json();
  }

  private async getAuthHeaders(userId?: string): Promise<Record<string, string>> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        return {
          Authorization: `Bearer ${session.access_token}`
        };
      }
    } catch {
      // Ignored: fallback to unauthenticated or dev identifier
    }
    return {
      "x-user-id": userId || "user_me"
    };
  }

  async getMeetings(userId?: string): Promise<{ meetings: any[] }> {
    const authHeaders = await this.getAuthHeaders(userId);
    const res = await fetch(`${this.baseUrl}/meetings`, {
      headers: { ...authHeaders }
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to fetch meetings (${res.status})`);
    }
    return res.json();
  }

  async getMeeting(id: string, userId?: string): Promise<{ meeting: any }> {
    const authHeaders = await this.getAuthHeaders(userId);
    const res = await fetch(`${this.baseUrl}/meetings/${encodeURIComponent(id)}`, {
      headers: { ...authHeaders }
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to fetch meeting (${res.status})`);
    }
    return res.json();
  }

  async saveMeeting(meeting: any, userId?: string): Promise<{ success: boolean; meeting: any }> {
    const authHeaders = await this.getAuthHeaders(userId);
    const res = await fetch(`${this.baseUrl}/meetings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders
      },
      body: JSON.stringify(meeting)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to save meeting (${res.status})`);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("voxflow_subscription_updated"));
    }
    return res.json();
  }

  async updateMeeting(id: string, updates: any, userId?: string): Promise<{ success: boolean; meeting: any }> {
    const authHeaders = await this.getAuthHeaders(userId);
    const res = await fetch(`${this.baseUrl}/meetings/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders
      },
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to update meeting (${res.status})`);
    }
    return res.json();
  }

  async deleteMeeting(id: string, userId?: string): Promise<{ success: boolean }> {
    const authHeaders = await this.getAuthHeaders(userId);
    const res = await fetch(`${this.baseUrl}/meetings/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { ...authHeaders }
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to delete meeting (${res.status})`);
    }
    return res.json();
  }

  async getTranscriptions(userId?: string): Promise<{ transcriptions: any[] }> {
    const authHeaders = await this.getAuthHeaders(userId);
    const res = await fetch(`${this.baseUrl}/transcriptions`, {
      headers: { ...authHeaders }
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to fetch transcriptions (${res.status})`);
    }
    return res.json();
  }

  async getTranscription(id: string, userId?: string): Promise<{ transcription: any }> {
    const authHeaders = await this.getAuthHeaders(userId);
    const res = await fetch(`${this.baseUrl}/transcriptions/${encodeURIComponent(id)}`, {
      headers: { ...authHeaders }
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to fetch transcription (${res.status})`);
    }
    return res.json();
  }

  async saveTranscription(item: any, userId?: string): Promise<{ success: boolean; transcription: any }> {
    const authHeaders = await this.getAuthHeaders(userId);
    const res = await fetch(`${this.baseUrl}/transcriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders
      },
      body: JSON.stringify(item)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to save transcription (${res.status})`);
    }
    return res.json();
  }

  async deleteTranscription(id: string, userId?: string): Promise<{ success: boolean }> {
    const authHeaders = await this.getAuthHeaders(userId);
    const res = await fetch(`${this.baseUrl}/transcriptions/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { ...authHeaders }
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to delete transcription (${res.status})`);
    }
    return res.json();
  }

  async processMeetingRecording(
    audioBlob: Blob,
    title = "",
    targetLanguage = "Auto",
    userId?: string
  ): Promise<{ success: boolean; meetingId: string; meeting: any }> {
    const authHeaders = await this.getAuthHeaders(userId);
    const formData = new FormData();
    formData.append("file", audioBlob, "meeting-audio.webm");
    if (title) formData.append("title", title);
    if (targetLanguage) formData.append("targetLanguage", targetLanguage);

    const res = await fetch(`${this.baseUrl}/meetings/process-recording`, {
      method: "POST",
      headers: { ...authHeaders },
      body: formData
    });

    if (!res.ok) {
      if (res.status === 429) {
        throw new Error("Rate limit exceeded. Please wait a moment before trying again.");
      }
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Meeting recording processing failed (${res.status})`);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("voxflow_subscription_updated"));
    }
    return res.json();
  }

  async joinWaitlist(
    email: string,
    source = "website_modal",
    marketingConsent = false
  ): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${this.baseUrl}/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source, marketingConsent })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Waitlist registration failed (${res.status})`);
    }

    return res.json();
  }

  // --- Billing API Methods ---
  async getSubscription(
    userId?: string,
    sessionId?: string
  ): Promise<{
    entitlements: any;
    subscription: any;
  }> {
    const authHeaders = await this.getAuthHeaders(userId);
    const query = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
    const res = await fetch(`${this.baseUrl}/billing/subscription${query}`, {
      headers: { ...authHeaders }
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to fetch subscription (${res.status})`);
    }
    return res.json();
  }

  async getAddons(): Promise<{ packs: any[]; notice: string }> {
    const res = await fetch(`${this.baseUrl}/billing/addons`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to fetch add-on packs (${res.status})`);
    }
    return res.json();
  }

  async getAddonQuote(packId?: string, index?: number, userId?: string): Promise<{
    pack: any;
    priceUsd: number;
    priceCents: number;
    minutes: number;
    isPro: boolean;
    currentPlan: string;
    renewalDate: string | null;
    oneTimePurchase: boolean;
    proposed: boolean;
  }> {
    const authHeaders = await this.getAuthHeaders(userId);
    const params = new URLSearchParams();
    if (packId) params.append("packId", packId);
    if (index !== undefined) params.append("index", String(index));
    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${this.baseUrl}/billing/addon-quote${query}`, {
      headers: { ...authHeaders }
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to fetch quote (${res.status})`);
    }
    return res.json();
  }

  async createCheckoutSession(
    planId = "premium_monthly",
    userId?: string,
    action: "new" | "early_renewal" | "topup" = "new",
    packId?: string
  ): Promise<{ sessionId: string; checkoutUrl: string }> {
    const authHeaders = await this.getAuthHeaders(userId);
    const host = window.location.origin;
    const res = await fetch(`${this.baseUrl}/billing/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders
      },
      body: JSON.stringify({
        planId,
        action,
        packId,
        successUrl: `${host}/#/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${host}/#/billing/cancel`
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const err: any = new Error(errData.error || `Checkout failed (${res.status})`);
      err.code = errData.code;
      throw err;
    }

    return res.json();
  }

  async createPortalSession(userId?: string): Promise<{ portalUrl: string }> {
    const authHeaders = await this.getAuthHeaders(userId);
    const res = await fetch(`${this.baseUrl}/billing/portal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders
      }
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Portal failed (${res.status})`);
    }

    return res.json();
  }

  async getInvoices(userId?: string): Promise<{ invoices: any[] }> {
    const authHeaders = await this.getAuthHeaders(userId);
    const res = await fetch(`${this.baseUrl}/billing/invoices`, {
      headers: { ...authHeaders }
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to fetch invoices (${res.status})`);
    }

    return res.json();
  }

  async cancelSubscription(userId?: string): Promise<{ success: boolean; message: string; subscription: any }> {
    const authHeaders = await this.getAuthHeaders(userId);
    const res = await fetch(`${this.baseUrl}/billing/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders
      }
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Cancel subscription failed (${res.status})`);
    }

    return res.json();
  }
}

export const api = new VoxFlowApiClient(API_BASE_URL);

