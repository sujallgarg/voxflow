import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../data");
const MEETINGS_FILE = path.join(DATA_DIR, "meetings.json");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface Participant {
  id: string;
  name: string;
  role: string;
  avatar: string;
  isCurrentUser?: boolean;
}

export interface TranscriptUtterance {
  id: string;
  speakerId: string;
  speakerName: string;
  speakerRole: string;
  isCurrentUser: boolean;
  timestamp: string;
  originalLanguage: string;
  originalText: string;
  translations?: Record<string, string>;
}

export interface ActionItem {
  id: string;
  task: string;
  assignee: string;
  dueDate: string;
  completed: boolean;
}

export interface DecisionItem {
  id: string;
  decision: string;
  context: string;
}

export interface TopicItem {
  id: string;
  title: string;
  timeRange: string;
  summary: string;
}

export interface MeetingRecord {
  id: string;
  userId: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  status: "completed" | "upcoming" | "processing";
  primaryLanguages: string[];
  summaryPreview: string;
  fullSummary: string;
  participants: Participant[];
  topics: TopicItem[];
  decisions: DecisionItem[];
  actionItems: ActionItem[];
  transcript: TranscriptUtterance[];
  initialNotes: string;
  createdAt?: string;
  updatedAt?: string;
}

class MeetingStoreService {
  private meetings: Map<string, MeetingRecord> = new Map();
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
        console.warn("MeetingStoreService: Failed to initialize Supabase client:", err);
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

      if (fs.existsSync(MEETINGS_FILE)) {
        const raw = fs.readFileSync(MEETINGS_FILE, "utf-8");
        const list: MeetingRecord[] = JSON.parse(raw);
        this.meetings.clear();
        for (const item of list) {
          this.meetings.set(item.id, item);
        }
      }
      this.isLoaded = true;
    } catch (err) {
      console.warn("MeetingStoreService: Error loading meetings from disk:", err);
      this.meetings.clear();
      this.isLoaded = true;
    }
  }

  private saveToDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const list = Array.from(this.meetings.values());
      const tempFile = `${MEETINGS_FILE}.${Date.now()}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(list, null, 2), "utf-8");
      fs.renameSync(tempFile, MEETINGS_FILE);
    } catch (err) {
      console.error("MeetingStoreService: Error saving meetings to disk:", err);
    }
  }

  private mapRowToRecord(row: Record<string, unknown>): MeetingRecord {
    return {
      id: String(row.id || ""),
      userId: String(row.user_id || ""),
      title: String(row.title || ""),
      date: String(row.date || ""),
      time: String(row.time || ""),
      duration: String(row.duration || "15 mins"),
      status: (row.status as MeetingRecord["status"]) || "completed",
      primaryLanguages: Array.isArray(row.primary_languages) ? (row.primary_languages as string[]) : ["English"],
      summaryPreview: String(row.summary_preview || ""),
      fullSummary: String(row.full_summary || ""),
      initialNotes: String(row.initial_notes || ""),
      participants: Array.isArray(row.participants) ? (row.participants as Participant[]) : [],
      topics: Array.isArray(row.topics) ? (row.topics as TopicItem[]) : [],
      decisions: Array.isArray(row.decisions) ? (row.decisions as DecisionItem[]) : [],
      actionItems: Array.isArray(row.action_items) ? (row.action_items as ActionItem[]) : [],
      transcript: Array.isArray(row.transcript) ? (row.transcript as TranscriptUtterance[]) : [],
      createdAt: String(row.created_at || ""),
      updatedAt: String(row.updated_at || "")
    };
  }

  public async getMeetings(userId: string): Promise<MeetingRecord[]> {
    if (!this.isLoaded) this.loadFromDisk();

    // Query Supabase PostgreSQL if initialized and user is a valid UUID
    if (this.supabase && UUID_REGEX.test(userId)) {
      try {
        const { data, error } = await this.supabase
          .from("meetings")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (!error && Array.isArray(data)) {
          const records = data.map((row) => this.mapRowToRecord(row));
          // Synchronize in-memory cache
          for (const rec of records) {
            this.meetings.set(rec.id, rec);
          }
          this.saveToDisk();
          return records;
        } else if (error) {
          console.warn("MeetingStoreService: Supabase query returned error, using local fallback:", error.message);
        }
      } catch (err) {
        console.warn("MeetingStoreService: Failed to query Supabase, using local fallback:", err);
      }
    }

    return Array.from(this.meetings.values())
      .filter((m) => m.userId === userId)
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }

  public async getMeetingById(userId: string, meetingId: string): Promise<MeetingRecord | null> {
    if (!this.isLoaded) this.loadFromDisk();

    if (this.supabase && UUID_REGEX.test(userId)) {
      try {
        const { data, error } = await this.supabase
          .from("meetings")
          .select("*")
          .eq("id", meetingId)
          .eq("user_id", userId)
          .maybeSingle();

        if (!error && data) {
          const rec = this.mapRowToRecord(data);
          this.meetings.set(rec.id, rec);
          return rec;
        } else if (error && error.code !== "PGRST116") {
          console.warn("MeetingStoreService: Supabase single fetch error:", error.message);
        }
      } catch (err) {
        console.warn("MeetingStoreService: Failed to query Supabase for single meeting:", err);
      }
    }

    const meeting = this.meetings.get(meetingId);
    if (!meeting || meeting.userId !== userId) {
      return null;
    }
    return meeting;
  }

  public async getMeetingByIdRaw(meetingId: string): Promise<MeetingRecord | null> {
    if (!this.isLoaded) this.loadFromDisk();

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from("meetings")
          .select("*")
          .eq("id", meetingId)
          .maybeSingle();

        if (!error && data) {
          const rec = this.mapRowToRecord(data);
          this.meetings.set(rec.id, rec);
          return rec;
        }
      } catch {
        // Fall back to memory
      }
    }

    return this.meetings.get(meetingId) || null;
  }

  public async saveMeeting(
    userId: string,
    meetingData: Partial<MeetingRecord> & { id: string; title: string }
  ): Promise<MeetingRecord> {
    if (!this.isLoaded) this.loadFromDisk();

    const existing = await this.getMeetingByIdRaw(meetingData.id);
    if (existing && existing.userId !== userId) {
      throw new Error("Access denied: Meeting record belongs to another user.");
    }

    const now = new Date().toISOString();

    const record: MeetingRecord = {
      id: meetingData.id,
      userId,
      title: meetingData.title,
      date: meetingData.date || existing?.date || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      time: meetingData.time || existing?.time || new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      duration: meetingData.duration || existing?.duration || "15 mins",
      status: meetingData.status || existing?.status || "completed",
      primaryLanguages: meetingData.primaryLanguages || existing?.primaryLanguages || ["English"],
      summaryPreview: meetingData.summaryPreview || existing?.summaryPreview || (meetingData.fullSummary ? meetingData.fullSummary.slice(0, 160) : ""),
      fullSummary: meetingData.fullSummary || existing?.fullSummary || "",
      participants: meetingData.participants || existing?.participants || [
        { id: userId, name: "Host", role: "Meeting Host", avatar: "MH", isCurrentUser: true }
      ],
      topics: meetingData.topics || existing?.topics || [],
      decisions: meetingData.decisions || existing?.decisions || [],
      actionItems: meetingData.actionItems || existing?.actionItems || [],
      transcript: meetingData.transcript || existing?.transcript || [],
      initialNotes: meetingData.initialNotes || existing?.initialNotes || "",
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    this.meetings.set(record.id, record);
    this.saveToDisk();

    // Persist to Supabase PostgreSQL when credentials exist and user is a UUID
    if (this.supabase && UUID_REGEX.test(userId)) {
      try {
        const { error } = await this.supabase
          .from("meetings")
          .upsert({
            id: record.id,
            user_id: record.userId,
            title: record.title,
            date: record.date,
            time: record.time,
            duration: record.duration,
            status: record.status,
            primary_languages: record.primaryLanguages,
            summary_preview: record.summaryPreview,
            full_summary: record.fullSummary,
            initial_notes: record.initialNotes,
            participants: record.participants,
            topics: record.topics,
            decisions: record.decisions,
            action_items: record.actionItems,
            transcript: record.transcript,
            created_at: record.createdAt,
            updated_at: record.updatedAt
          });

        if (error) {
          console.warn("MeetingStoreService: Supabase postgres sync skipped/failed:", error.message);
        }
      } catch (err) {
        console.warn("MeetingStoreService: Supabase postgres sync error:", err);
      }
    }

    return record;
  }

  public async deleteMeeting(userId: string, meetingId: string): Promise<boolean> {
    if (!this.isLoaded) this.loadFromDisk();
    const existing = await this.getMeetingById(userId, meetingId);
    if (!existing || existing.userId !== userId) {
      return false;
    }
    this.meetings.delete(meetingId);
    this.saveToDisk();

    // Persist deletion to Supabase PostgreSQL when credentials exist and user is a UUID
    if (this.supabase && UUID_REGEX.test(userId)) {
      try {
        const { error } = await this.supabase
          .from("meetings")
          .delete()
          .eq("id", meetingId)
          .eq("user_id", userId);

        if (error) {
          console.warn("MeetingStoreService: Supabase postgres delete skipped/failed:", error.message);
        }
      } catch (err) {
        console.warn("MeetingStoreService: Supabase postgres delete error:", err);
      }
    }

    return true;
  }
}

export const meetingStore = new MeetingStoreService();
