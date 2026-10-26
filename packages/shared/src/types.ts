export type SupportedLanguage =
  | "en"
  | "hi"
  | "de"
  | "es"
  | "fr";

export interface VoxFlowRequest {
  transcript: string;
  context?: string;
  targetLanguage?: SupportedLanguage;
}

export interface VoxFlowResponse {
  text: string;
  detectedLanguages?: SupportedLanguage[];
}

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
  durationSeconds?: number;
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