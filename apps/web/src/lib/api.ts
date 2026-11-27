import { supabase } from "./supabase";

const LIVE_API_URL = "https://voxflow-u7h3.onrender.com";

function resolveApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  const isBrowser = typeof window !== "undefined";
  const isHttps = isBrowser && window.location.protocol === "https:";
  const isRemoteHost = isBrowser && !["localhost", "127.0.0.1"].includes(window.location.hostname);

  // If page is loaded over HTTPS or hosted on a remote domain (e.g. Vercel, devs.surf, Render),
  // NEVER use an insecure http://localhost URL which browsers block with mixed-content / Failed to fetch.
  if (isHttps || isRemoteHost || import.meta.env.PROD) {
    if (configured && configured.startsWith("https://")) {
      return configured.replace(/\/+$/, "");
    }
    return LIVE_API_URL;
  }

  // Local development
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  return "http://localhost:3001";
}

export const API_BASE_URL = resolveApiBaseUrl();

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
  private fallbackBaseUrl = LIVE_API_URL;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private async requestFetch(url: string, init?: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (err: any) {
      const isNetworkError =
        err instanceof TypeError ||
        err?.message?.includes("Failed to fetch") ||
        err?.name === "TypeError" ||
        err?.name === "NetworkError";

      const isLocal =
        this.baseUrl.includes("localhost") ||
        this.baseUrl.includes("127.0.0.1") ||
        this.baseUrl.startsWith("http://");

      if (isNetworkError && isLocal && this.fallbackBaseUrl && this.baseUrl !== this.fallbackBaseUrl) {
        console.warn(`[VoxFlow API] ${this.baseUrl} unreachable. Switching to live backend: ${this.fallbackBaseUrl}`);
        this.baseUrl = this.fallbackBaseUrl;
        const fallbackUrl = url.replace(/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, this.fallbackBaseUrl);
        return await fetch(fallbackUrl, init);
      }
      throw err;
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await this.requestFetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async transcribeAudio(audioBlob: Blob, filename = "voxflow-recording.webm", userId?: string): Promise<{ text: string }> {
    let authHeaders = await this.getAuthHeaders(userId);
    const createFormData = () => {
      const formData = new FormData();
      formData.append("audio", audioBlob, filename);
      return formData;
    };

    let res = await this.requestFetch(`${this.baseUrl}/transcribe`, {
      method: "POST",
      headers: {
        ...authHeaders
      },
      body: createFormData()
    });

    // If 401 Unauthorized (invalid or expired token), attempt token refresh and retry once
    if (res.status === 401 && authHeaders.Authorization) {
      const freshHeaders = await this.getAuthHeaders(userId, true);
      if (freshHeaders.Authorization && freshHeaders.Authorization !== authHeaders.Authorization) {
        res = await this.requestFetch(`${this.baseUrl}/transcribe`, {
          method: "POST",
          headers: {
            ...freshHeaders
          },
          body: createFormData()
        });
      }
    }

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

    const res = await this.requestFetch(`${this.baseUrl}/demo/process-audio`, {
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
    const res = await this.requestFetch(`${this.baseUrl}/detect-language`, {
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
    const res = await this.requestFetch(`${this.baseUrl}/understand`, {
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
    const res = await this.requestFetch(`${this.baseUrl}/detect-context`, {
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
    const res = await this.requestFetch(`${this.baseUrl}/transform`, {
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
    let authHeaders = await this.getAuthHeaders(userId);
    let res = await this.requestFetch(`${this.baseUrl}/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders
      },
      body: JSON.stringify({ transcript, targetLanguage })
    });

    if (res.status === 401 && authHeaders.Authorization) {
      const freshHeaders = await this.getAuthHeaders(userId, true);
      if (freshHeaders.Authorization && freshHeaders.Authorization !== authHeaders.Authorization) {
        res = await this.requestFetch(`${this.baseUrl}/process`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...freshHeaders
          },
          body: JSON.stringify({ transcript, targetLanguage })
        });
      }
    }

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
    const res = await this.requestFetch(`${this.baseUrl}/meeting-notes`, {
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

  private refreshPromise: Promise<any> | null = null;

  private async safeRefreshSession(): Promise<any> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) {
          // Token is invalid or revoked, notify application cleanly
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("voxflow_session_expired"));
            window.dispatchEvent(new CustomEvent("voxflow_auth_sync"));
          }
          return null;
        }
        return data?.session ?? null;
      } catch {
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async getAuthHeaders(userId?: string, forceRefresh = false): Promise<Record<string, string>> {
    try {
      let session: any = null;

      if (forceRefresh) {
        session = await this.safeRefreshSession();
      }

      if (!session) {
        const { data } = await supabase.auth.getSession();
        session = data?.session;
      }

      // Preemptive refresh: verify if session token is expired or expiring within 60 seconds
      if (session && !forceRefresh) {
        const expiresAtMs = (session.expires_at || 0) * 1000;
        const isExpiringSoon = expiresAtMs > 0 && expiresAtMs - Date.now() < 60000;
        if (isExpiringSoon) {
          const refreshed = await this.safeRefreshSession();
          if (refreshed?.access_token) {
            session = refreshed;
          }
        }
      }

      if (session?.access_token) {
        return {
          Authorization: `Bearer ${session.access_token}`
        };
      }
    } catch {
      // Ignored: fallback to unauthenticated or dev identifier
    }
    return userId && userId !== "user_me"
      ? { "x-user-id": userId }
      : {};
  }

  async getMeetings(userId?: string): Promise<{ meetings: any[] }> {
    const authHeaders = await this.getAuthHeaders(userId);
    const res = await this.requestFetch(`${this.baseUrl}/meetings`, {
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
    const res = await this.requestFetch(`${this.baseUrl}/meetings/${encodeURIComponent(id)}`, {
      headers: { ...authHeaders }
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to fetch meeting (${res.status})`);
    }
    return res.json();
  }

  async analyzeMeetingSnapshot(
    imageBase64: string,
    params?: { meetingTitle?: string; manual?: boolean; timestamp?: string; meetingId?: string },
    userId?: string
  ): Promise<{ success: boolean; isUseful: boolean; category: string; description: string; confidence: number }> {
    const authHeaders = await this.getAuthHeaders(userId);
    const res = await this.requestFetch(`${this.baseUrl}/meetings/analyze-snapshot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders
      },
      body: JSON.stringify({
        imageBase64,
        meetingTitle: params?.meetingTitle,
        manual: params?.manual,
        timestamp: params?.timestamp,
        meetingId: params?.meetingId
      })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to analyze snapshot (${res.status})`);
    }
    return res.json();
  }

  async saveMeeting(meeting: any, userId?: string): Promise<{ success: boolean; meeting: any }> {
    const authHeaders = await this.getAuthHeaders(userId);
    const res = await this.requestFetch(`${this.baseUrl}/meetings`, {
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
    const res = await this.requestFetch(`${this.baseUrl}/meetings/${encodeURIComponent(id)}`, {
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
    const res = await this.requestFetch(`${this.baseUrl}/meetings/${encodeURIComponent(id)}`, {
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
    const res = await this.requestFetch(`${this.baseUrl}/transcriptions`, {
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
    const res = await this.requestFetch(`${this.baseUrl}/transcriptions/${encodeURIComponent(id)}`, {
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
    const res = await this.requestFetch(`${this.baseUrl}/transcriptions`, {
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
    const res = await this.requestFetch(`${this.baseUrl}/transcriptions/${encodeURIComponent(id)}`, {
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

    const res = await this.requestFetch(`${this.baseUrl}/meetings/process-recording`, {
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
    const res = await this.requestFetch(`${this.baseUrl}/waitlist`, {
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
    let authHeaders = await this.getAuthHeaders(userId);
    // Never make protected subscription requests for unauthenticated visitors or placeholder IDs
    if (!authHeaders.Authorization && (!userId || userId === "user_me")) {
      return {
        entitlements: null,
        subscription: null
      };
    }
    const query = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
    let res = await this.requestFetch(`${this.baseUrl}/billing/subscription${query}`, {
      headers: { ...authHeaders }
    });

    // If 401 Unauthorized (invalid or expired token), attempt token refresh and retry once
    if (res.status === 401 && authHeaders.Authorization) {
      const freshHeaders = await this.getAuthHeaders(userId, true);
      if (freshHeaders.Authorization && freshHeaders.Authorization !== authHeaders.Authorization) {
        res = await this.requestFetch(`${this.baseUrl}/billing/subscription${query}`, {
          headers: { ...freshHeaders }
        });
      }
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to fetch subscription (${res.status})`);
    }
    return res.json();
  }

  async getAddons(): Promise<{ packs: any[]; notice: string }> {
    const res = await this.requestFetch(`${this.baseUrl}/billing/addons`);
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
    const res = await this.requestFetch(`${this.baseUrl}/billing/addon-quote${query}`, {
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
    const res = await this.requestFetch(`${this.baseUrl}/billing/checkout`, {
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
    const res = await this.requestFetch(`${this.baseUrl}/billing/portal`, {
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
    const res = await this.requestFetch(`${this.baseUrl}/billing/invoices`, {
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
    const res = await this.requestFetch(`${this.baseUrl}/billing/cancel`, {
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

