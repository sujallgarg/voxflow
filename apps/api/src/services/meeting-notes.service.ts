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

const MAX_CHUNK_CHARS = 8000;

/**
 * Splits long transcripts into manageable chunks at sentence/paragraph boundaries
 * to prevent exceeding Groq context and token-per-minute (TPM) limits on 30+ min meetings.
 */
function splitTranscriptIntoChunks(text: string, maxChunkLength = MAX_CHUNK_CHARS): string[] {
  if (text.length <= maxChunkLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > 0) {
    if (remaining.length <= maxChunkLength) {
      chunks.push(remaining);
      break;
    }

    // Try splitting at paragraph boundary first
    let splitIndex = remaining.lastIndexOf("\n\n", maxChunkLength);
    if (splitIndex === -1 || splitIndex < maxChunkLength * 0.5) {
      // Try splitting at newline
      splitIndex = remaining.lastIndexOf("\n", maxChunkLength);
    }
    if (splitIndex === -1 || splitIndex < maxChunkLength * 0.5) {
      // Try splitting at sentence boundary (. or ? or !)
      const match = remaining.slice(0, maxChunkLength).match(/([.?!])\s+(?=[A-Z0-9])/g);
      if (match && match.length > 0) {
        const lastPunct = match[match.length - 1];
        const idx = remaining.slice(0, maxChunkLength).lastIndexOf(lastPunct);
        if (idx !== -1) {
          splitIndex = idx + lastPunct.length;
        }
      }
    }
    if (splitIndex === -1 || splitIndex < maxChunkLength * 0.3) {
      // Split at space
      splitIndex = remaining.lastIndexOf(" ", maxChunkLength);
    }
    if (splitIndex === -1) {
      splitIndex = maxChunkLength;
    }

    const chunk = remaining.slice(0, splitIndex).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    remaining = remaining.slice(splitIndex).trim();
  }

  return chunks;
}

async function extractNotesFromChunk(
  chunk: string,
  meetingTitle?: string,
  isPartial = false
): Promise<MeetingNotesResult> {
  const prompt = `You are VoxFlow's Meeting Intelligence Engine.

Analyze the spoken transcript ${isPartial ? "section" : ""} from a meeting.
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
}`;

  const response = await groq.chat.completions.create({
    model: DEFAULT_CHAT_MODEL,
    temperature: 0.1,
    response_format: {
      type: "json_object"
    },
    messages: [
      {
        role: "system",
        content: prompt
      },
      {
        role: "user",
        content: chunk
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
}

/**
 * Creates structured fallback notes if API rate limits or network issues arise
 */
function createFallbackMeetingNotes(transcript: string, meetingTitle?: string): MeetingNotesResult {
  const sentences = transcript
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);

  const title = meetingTitle || (sentences[0] ? sentences[0].slice(0, 60) : "VoxFlow Meeting Summary");
  const summary = sentences.slice(0, 3).join(" ") || (transcript.length > 300 ? `${transcript.slice(0, 300)}...` : transcript);
  const keyPoints = sentences.slice(1, 6);

  return {
    title,
    summary,
    keyPoints: keyPoints.length > 0 ? keyPoints : [transcript.slice(0, 150)],
    decisions: [],
    actionItems: [],
    followUps: [],
    topics: [{ title: "Session Discussion", summary: transcript.slice(0, 200) }],
    primaryLanguages: ["English"]
  };
}

export async function generateMeetingNotes(
  transcript: string,
  meetingTitle?: string
): Promise<MeetingNotesResult> {
  if (!transcript || !transcript.trim()) {
    throw new Error("Transcript is required to generate meeting notes.");
  }

  const cleanTranscript = transcript.trim();
  const chunks = splitTranscriptIntoChunks(cleanTranscript, MAX_CHUNK_CHARS);

  try {
    // Single chunk: process directly
    if (chunks.length === 1) {
      return await extractNotesFromChunk(chunks[0], meetingTitle, false);
    }

    // Multiple chunks (30+ min meeting): process each chunk and aggregate
    const chunkResults: MeetingNotesResult[] = [];
    for (let i = 0; i < chunks.length; i++) {
      try {
        const res = await extractNotesFromChunk(chunks[i], meetingTitle, true);
        chunkResults.push(res);
      } catch (err) {
        console.warn(`Meeting notes chunk ${i + 1}/${chunks.length} partial warning:`, err);
        chunkResults.push(createFallbackMeetingNotes(chunks[i], meetingTitle));
      }
    }

    // Aggregate decisions, action items, topics, languages, key points
    const seenDecisions = new Set<string>();
    const allDecisions: DecisionResult[] = [];
    for (const r of chunkResults) {
      for (const d of r.decisions) {
        const key = d.decision.trim().toLowerCase();
        if (!seenDecisions.has(key)) {
          seenDecisions.add(key);
          allDecisions.push(d);
        }
      }
    }

    const seenActions = new Set<string>();
    const allActionItems: ActionItemResult[] = [];
    for (const r of chunkResults) {
      for (const a of r.actionItems) {
        const key = a.task.trim().toLowerCase();
        if (!seenActions.has(key)) {
          seenActions.add(key);
          allActionItems.push(a);
        }
      }
    }

    const seenFollowUps = new Set<string>();
    const allFollowUps: string[] = [];
    for (const r of chunkResults) {
      for (const f of r.followUps) {
        const key = f.trim().toLowerCase();
        if (!seenFollowUps.has(key)) {
          seenFollowUps.add(key);
          allFollowUps.push(f);
        }
      }
    }

    const seenTopics = new Set<string>();
    const allTopics: TopicResult[] = [];
    for (const r of chunkResults) {
      for (const t of r.topics) {
        const key = t.title.trim().toLowerCase();
        if (!seenTopics.has(key)) {
          seenTopics.add(key);
          allTopics.push(t);
        }
      }
    }

    const seenLanguages = new Set<string>();
    const allLanguages: string[] = [];
    for (const r of chunkResults) {
      for (const lang of r.primaryLanguages) {
        if (!seenLanguages.has(lang)) {
          seenLanguages.add(lang);
          allLanguages.push(lang);
        }
      }
    }

    const allKeyPoints: string[] = [];
    for (const r of chunkResults) {
      for (const p of r.keyPoints) {
        if (!allKeyPoints.includes(p) && allKeyPoints.length < 8) {
          allKeyPoints.push(p);
        }
      }
    }

    // Synthesize final executive summary across chunk summaries
    const combinedSummaries = chunkResults.map((r, i) => `Section ${i + 1}: ${r.summary}`).join("\n\n");
    let finalSummary = "";
    try {
      const summaryResponse = await groq.chat.completions.create({
        model: DEFAULT_CHAT_MODEL,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: "You are VoxFlow's Meeting Intelligence Engine. Synthesize the section summaries of a long meeting into a single 2-4 sentence executive overview highlighting main outcomes and decisions. Return plain text only."
          },
          {
            role: "user",
            content: combinedSummaries
          }
        ]
      });
      finalSummary = summaryResponse.choices[0]?.message?.content?.trim() || "";
    } catch {
      finalSummary = chunkResults.map((r) => r.summary).join(" ");
    }

    return {
      title: chunkResults[0]?.title || meetingTitle || "VoxFlow Meeting Summary",
      summary: finalSummary || chunkResults.map((r) => r.summary).join(" "),
      keyPoints: allKeyPoints.length > 0 ? allKeyPoints : ["Comprehensive meeting session held."],
      decisions: allDecisions,
      actionItems: allActionItems,
      followUps: allFollowUps,
      topics: allTopics.length > 0 ? allTopics : [{ title: "Meeting Discussion", summary: "Detailed session topics discussed." }],
      primaryLanguages: allLanguages.length > 0 ? allLanguages : ["English"]
    };
  } catch (error: any) {
    console.error("Meeting notes generation error:", error);
    // If entire generation fails, return a robust structured fallback from the transcript
    return createFallbackMeetingNotes(cleanTranscript, meetingTitle);
  }
}
