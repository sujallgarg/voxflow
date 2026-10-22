import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../data");
const TRANSCRIPTIONS_FILE = path.join(DATA_DIR, "transcriptions.json");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface VoiceTranscriptionRecord {
  id: string;
  userId: string;
  title: string;
  transcript: string;
  transformedText: string;
  language: string;
  status: "completed" | "processing" | "failed";
  createdAt: string;
  updatedAt?: string;
}

class TranscriptionStoreService {
  private records: Map<string, VoiceTranscriptionRecord> = new Map();
  private isLoaded = false;
  private supabase: SupabaseClient | null = null;

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
      } catch (err) {
        console.warn("TranscriptionStoreService: Failed to init Supabase client:", err);
      }
    }
  }

  public setSupabaseClientForTesting(client: SupabaseClient | null) {
    this.supabase = client;
  }

  private loadFromDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(TRANSCRIPTIONS_FILE)) {
        const raw = fs.readFileSync(TRANSCRIPTIONS_FILE, "utf-8");
        const list: VoiceTranscriptionRecord[] = JSON.parse(raw);
        this.records.clear();
        for (const item of list) {
          this.records.set(item.id, item);
        }
      }
      this.isLoaded = true;
    } catch (err) {
      console.warn("TranscriptionStoreService: Error loading from disk:", err);
      this.records.clear();
      this.isLoaded = true;
    }
  }

  private saveToDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const list = Array.from(this.records.values());
      const tempFile = `${TRANSCRIPTIONS_FILE}.${Date.now()}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(list, null, 2), "utf-8");
      fs.renameSync(tempFile, TRANSCRIPTIONS_FILE);
    } catch (err) {
      console.error("TranscriptionStoreService: Error saving to disk:", err);
    }
  }

  public async getTranscriptions(userId: string): Promise<VoiceTranscriptionRecord[]> {
    if (!this.isLoaded) this.loadFromDisk();

    if (this.supabase && UUID_REGEX.test(userId)) {
      try {
        const { data, error } = await this.supabase
          .from("transcriptions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (!error && Array.isArray(data)) {
          const mapped: VoiceTranscriptionRecord[] = data.map((r: any) => ({
            id: String(r.id),
            userId: String(r.user_id),
            title: String(r.title || "Voice Dictation"),
            transcript: String(r.transcript || ""),
            transformedText: String(r.transformed_text || r.final_text || ""),
            language: String(r.language || "Auto"),
            status: (r.status as VoiceTranscriptionRecord["status"]) || "completed",
            createdAt: String(r.created_at || new Date().toISOString()),
            updatedAt: r.updated_at ? String(r.updated_at) : undefined
          }));
          for (const rec of mapped) {
            this.records.set(rec.id, rec);
          }
          this.saveToDisk();
          return mapped;
        }
      } catch (err) {
        console.warn("TranscriptionStoreService: Supabase query fallback:", err);
      }
    }

    return Array.from(this.records.values())
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public async getTranscriptionById(
    userId: string,
    id: string
  ): Promise<VoiceTranscriptionRecord | null> {
    if (!this.isLoaded) this.loadFromDisk();

    if (this.supabase && UUID_REGEX.test(userId)) {
      try {
        const { data, error } = await this.supabase
          .from("transcriptions")
          .select("*")
          .eq("id", id)
          .eq("user_id", userId)
          .maybeSingle();

        if (!error && data) {
          const mapped: VoiceTranscriptionRecord = {
            id: String(data.id),
            userId: String(data.user_id),
            title: String(data.title || "Voice Dictation"),
            transcript: String(data.transcript || ""),
            transformedText: String(data.transformed_text || data.final_text || ""),
            language: String(data.language || "Auto"),
            status: (data.status as VoiceTranscriptionRecord["status"]) || "completed",
            createdAt: String(data.created_at || new Date().toISOString()),
            updatedAt: data.updated_at ? String(data.updated_at) : undefined
          };
          this.records.set(mapped.id, mapped);
          return mapped;
        }
      } catch (err) {
        console.warn("TranscriptionStoreService: Supabase single query fallback:", err);
      }
    }

    const rec = this.records.get(id);
    if (!rec || rec.userId !== userId) {
      return null;
    }
    return rec;
  }

  public async getTranscriptionByIdRaw(id: string): Promise<VoiceTranscriptionRecord | null> {
    if (!this.isLoaded) this.loadFromDisk();

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from("transcriptions")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (!error && data) {
          const mapped: VoiceTranscriptionRecord = {
            id: String(data.id),
            userId: String(data.user_id),
            title: String(data.title || "Voice Dictation"),
            transcript: String(data.transcript || ""),
            transformedText: String(data.transformed_text || data.final_text || ""),
            language: String(data.language || "Auto"),
            status: (data.status as VoiceTranscriptionRecord["status"]) || "completed",
            createdAt: String(data.created_at || new Date().toISOString()),
            updatedAt: data.updated_at ? String(data.updated_at) : undefined
          };
          this.records.set(mapped.id, mapped);
          return mapped;
        }
      } catch (err) {
        console.warn("TranscriptionStoreService: Raw query fallback:", err);
      }
    }

    return this.records.get(id) || null;
  }

  public async saveTranscription(
    userId: string,
    record: VoiceTranscriptionRecord
  ): Promise<VoiceTranscriptionRecord> {
    if (!this.isLoaded) this.loadFromDisk();

    const now = new Date().toISOString();
    const existing = this.records.get(record.id);

    const saved: VoiceTranscriptionRecord = {
      ...record,
      userId,
      createdAt: existing?.createdAt || record.createdAt || now,
      updatedAt: now
    };

    this.records.set(saved.id, saved);
    this.saveToDisk();

    if (this.supabase && UUID_REGEX.test(userId)) {
      try {
        await this.supabase.from("transcriptions").upsert({
          id: saved.id,
          user_id: saved.userId,
          title: saved.title,
          transcript: saved.transcript,
          transformed_text: saved.transformedText,
          language: saved.language,
          status: saved.status,
          created_at: saved.createdAt,
          updated_at: saved.updatedAt
        });
      } catch (err) {
        console.warn("TranscriptionStoreService: Supabase upsert error:", err);
      }
    }

    return saved;
  }

  public async deleteTranscription(userId: string, id: string): Promise<boolean> {
    if (!this.isLoaded) this.loadFromDisk();

    const existing = this.records.get(id);
    if (!existing || existing.userId !== userId) {
      return false;
    }

    this.records.delete(id);
    this.saveToDisk();

    if (this.supabase && UUID_REGEX.test(userId)) {
      try {
        await this.supabase.from("transcriptions").delete().eq("id", id).eq("user_id", userId);
      } catch (err) {
        console.warn("TranscriptionStoreService: Supabase delete error:", err);
      }
    }

    return true;
  }

  public async clearAllForTesting(): Promise<void> {
    this.records.clear();
    this.saveToDisk();
  }
}

export const transcriptionStore = new TranscriptionStoreService();
