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
  translations: Record<string, string>;
  isQuestionToUser?: boolean;
  isAnswerFromUser?: boolean;
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
}

export const ASSISTANT_PROMPTS = [
  { id: "p1", label: "Summarize this meeting" },
  { id: "p2", label: "What action items were assigned?" },
  { id: "p3", label: "Extract key decisions" },
  { id: "p4", label: "Identify questions asked" },
  { id: "p5", label: "Draft a follow-up email" }
];
