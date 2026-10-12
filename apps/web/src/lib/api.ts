export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001";

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

  async transcribeAudio(audioBlob: Blob, filename = "voxflow-recording.webm"): Promise<{ text: string }> {
    const formData = new FormData();
    formData.append("audio", audioBlob, filename);

    const res = await fetch(`${this.baseUrl}/transcribe`, {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Transcription failed with HTTP ${res.status}`);
    }

    return res.json();
  }

  async detectLanguage(transcript: string): Promise<LanguageResult> {
    const res = await fetch(`${this.baseUrl}/detect-language`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Language detection failed with HTTP ${res.status}`);
    }

    return res.json();
  }

  async understand(transcript: string): Promise<UnderstandingResult> {
    const res = await fetch(`${this.baseUrl}/understand`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Understanding failed with HTTP ${res.status}`);
    }

    return res.json();
  }

  async detectContext(transcript: string): Promise<ContextResult> {
    const res = await fetch(`${this.baseUrl}/detect-context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  }): Promise<TransformationResult> {
    const res = await fetch(`${this.baseUrl}/transform`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Transformation failed with HTTP ${res.status}`);
    }

    return res.json();
  }

  async processVoice(transcript: string, targetLanguage?: string): Promise<ProcessPipelineResult> {
    const res = await fetch(`${this.baseUrl}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, targetLanguage })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Pipeline failed with HTTP ${res.status}`);
    }

    return res.json();
  }

  async generateMeetingNotes(transcript: string, title?: string): Promise<MeetingNotesResult> {
    const res = await fetch(`${this.baseUrl}/meeting-notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, title })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Meeting notes failed with HTTP ${res.status}`);
    }

    return res.json();
  }

  async getMeetings(userId = "user_me"): Promise<{ meetings: any[] }> {
    const res = await fetch(`${this.baseUrl}/meetings`, {
      headers: { "x-user-id": userId }
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to fetch meetings (${res.status})`);
    }
    return res.json();
  }

  async getMeeting(id: string, userId = "user_me"): Promise<{ meeting: any }> {
    const res = await fetch(`${this.baseUrl}/meetings/${encodeURIComponent(id)}`, {
      headers: { "x-user-id": userId }
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to fetch meeting (${res.status})`);
    }
    return res.json();
  }

  async saveMeeting(meeting: any, userId = "user_me"): Promise<{ success: boolean; meeting: any }> {
    const res = await fetch(`${this.baseUrl}/meetings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId
      },
      body: JSON.stringify(meeting)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to save meeting (${res.status})`);
    }
    return res.json();
  }

  async updateMeeting(id: string, updates: any, userId = "user_me"): Promise<{ success: boolean; meeting: any }> {
    const res = await fetch(`${this.baseUrl}/meetings/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId
      },
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to update meeting (${res.status})`);
    }
    return res.json();
  }

  async deleteMeeting(id: string, userId = "user_me"): Promise<{ success: boolean }> {
    const res = await fetch(`${this.baseUrl}/meetings/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "x-user-id": userId }
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to delete meeting (${res.status})`);
    }
    return res.json();
  }

  async processMeetingRecording(
    audioBlob: Blob,
    title = "",
    targetLanguage = "Auto",
    userId = "user_me"
  ): Promise<{ success: boolean; meetingId: string; meeting: any }> {
    const formData = new FormData();
    formData.append("file", audioBlob, "meeting-audio.webm");
    if (title) formData.append("title", title);
    if (targetLanguage) formData.append("targetLanguage", targetLanguage);

    const res = await fetch(`${this.baseUrl}/meetings/process-recording`, {
      method: "POST",
      headers: { "x-user-id": userId },
      body: formData
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Meeting recording processing failed (${res.status})`);
    }

    return res.json();
  }
}

export const api = new VoxFlowApiClient(API_BASE_URL);
