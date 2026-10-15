import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../data");
const MEETINGS_FILE = path.join(DATA_DIR, "meetings.json");

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
  status: "completed" | "upcoming";
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

  constructor() {
    this.loadFromDisk();
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

  public getMeetings(userId: string): MeetingRecord[] {
    if (!this.isLoaded) this.loadFromDisk();
    return Array.from(this.meetings.values())
      .filter((m) => m.userId === userId)
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }

  public getMeetingById(userId: string, meetingId: string): MeetingRecord | null {
    if (!this.isLoaded) this.loadFromDisk();
    const meeting = this.meetings.get(meetingId);
    if (!meeting || meeting.userId !== userId) {
      return null;
    }
    return meeting;
  }

  public saveMeeting(userId: string, meetingData: Partial<MeetingRecord> & { id: string; title: string }): MeetingRecord {
    if (!this.isLoaded) this.loadFromDisk();

    const existing = this.meetings.get(meetingData.id);
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
    return record;
  }

  public deleteMeeting(userId: string, meetingId: string): boolean {
    if (!this.isLoaded) this.loadFromDisk();
    const existing = this.meetings.get(meetingId);
    if (!existing || existing.userId !== userId) {
      return false;
    }
    this.meetings.delete(meetingId);
    this.saveToDisk();
    return true;
  }
}

export const meetingStore = new MeetingStoreService();
