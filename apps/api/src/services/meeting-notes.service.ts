import { groq, DEFAULT_CHAT_MODEL } from "./groq.client.js";

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

export async function generateMeetingNotes(
  transcript: string,
  meetingTitle?: string
): Promise<MeetingNotesResult> {
  if (!transcript || !transcript.trim()) {
    throw new Error("Transcript is required to generate meeting notes.");
  }

  try {
    const response = await groq.chat.completions.create({
      model: DEFAULT_CHAT_MODEL,
      temperature: 0.1,
      response_format: {
        type: "json_object"
      },
      messages: [
        {
          role: "system",
          content: `You are VoxFlow's Meeting Intelligence Engine.

Analyze the spoken transcript from a meeting.
The meeting may be in English, Hindi, Spanish, German, French, or mix multiple languages naturally.
Extract a structured executive meeting overview.

You must extract:
1. title: A concise, professional title for the meeting (use provided title if appropriate: "${meetingTitle || ''}").
2. summary: A 2-4 sentence executive overview synthesizing the main outcomes and discussion.
3. keyPoints: Array of 3-7 core discussion points.
4. decisions: Array of objects with "decision" and "context" (decisions agreed upon during the meeting).
5. actionItems: Array of actionable tasks. For each task extract:
   - "task": specific action required
   - "assignee": name/role of responsible person when identifiable (or "Unassigned")
   - "dueDate": deadline if mentioned (or "To be determined")
   - "completed": false
6. followUps: Array of things that need to happen later or future agenda items.
7. topics: Array of objects with "title" and "summary" for the major discussion topics.
8. primaryLanguages: Array of languages spoken during the meeting (e.g. ["English", "Hindi"]).

Rules:
- Never hallucinate decisions or commitments that were not discussed.
- Preserve all names, dates, numbers, and technical terms accurately.
- Return ONLY valid JSON in this exact structure:

{
  "title": "Meeting Title",
  "summary": "Executive summary...",
  "keyPoints": ["Point 1", "Point 2"],
  "decisions": [
    { "decision": "Agreed on...", "context": "Because..." }
  ],
  "actionItems": [
    { "task": "Send deck...", "assignee": "Alex", "dueDate": "Friday", "completed": false }
  ],
  "followUps": ["Follow up on..."],
  "topics": [
    { "title": "Topic 1", "summary": "Discussion of..." }
  ],
  "primaryLanguages": ["English"]
}`
        },
        {
          role: "user",
          content: transcript
        }
      ]
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("Groq returned an empty meeting notes response.");
    }

    const result = JSON.parse(content);

    return {
      title: result.title || meetingTitle || "VoxFlow Meeting Summary",
      summary: result.summary || "Summary not available.",
      keyPoints: Array.isArray(result.keyPoints) ? result.keyPoints : [],
      decisions: Array.isArray(result.decisions) ? result.decisions : [],
      actionItems: Array.isArray(result.actionItems) ? result.actionItems : [],
      followUps: Array.isArray(result.followUps) ? result.followUps : [],
      topics: Array.isArray(result.topics) ? result.topics : [],
      primaryLanguages: Array.isArray(result.primaryLanguages) && result.primaryLanguages.length ? result.primaryLanguages : ["English"]
    };
  } catch (error: any) {
    console.error("Meeting notes generation error:", error);
    const msg = error?.message || "Failed to generate meeting notes.";
    throw new Error(`Meeting notes failed: ${msg}`);
  }
}
