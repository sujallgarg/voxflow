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

// 80,000 characters (~13,000 words / ~90 mins of speech) fits well within the 131,072 token context window
const MAX_DIRECT_TRANSCRIPT_CHARS = 80000;
const FALLBACK_CHAT_MODEL = "openai/gpt-oss-20b";

function buildSystemPrompt(meetingTitle?: string, isPartial = false): string {
  return `You are VoxFlow's Meeting Intelligence Engine.
Analyze the complete spoken transcript ${isPartial ? "section" : ""} from a meeting session.
The meeting may be in English, Hindi, Spanish, German, French, or mix multiple languages naturally.
Extract a thorough, comprehensive executive overview covering the entire meeting from start to finish.

You must extract:
1. title: A concise, professional title for the meeting (use provided title if appropriate: "${meetingTitle || ''}").
2. summary: A thorough, multi-paragraph executive summary synthesizing the entire meeting from beginning to end. It must thoroughly detail the purpose of the meeting, the problems analyzed, key debate points, solutions evaluated, agreed outcomes, and future direction. Do not truncate or over-condense to a couple sentences; provide a rich, complete narrative.
3. keyPoints: Array of 5-10 core discussion points covering all parts of the meeting.
4. decisions: Array of objects with "decision" and "context" for every decision agreed upon during the meeting.
5. actionItems: Array of actionable tasks. For each task extract:
   - "task": specific action required
   - "assignee": name/role of responsible person when identifiable (or "Unassigned")
   - "dueDate": deadline if mentioned (or "To be determined")
   - "completed": false
6. followUps: Array of follow-up items, future milestones, or upcoming syncs.
7. topics: Array of objects with "title" and "summary" for every major topic discussed, detailing what was discussed.
8. primaryLanguages: Array of languages spoken during the meeting (e.g. ["English"]).

Rules:
- Never hallucinate decisions or commitments that were not discussed.
- Preserve all names, dates, numbers, and technical terms accurately.
- Return ONLY valid JSON in this exact structure:

{
  "title": "Meeting Title",
  "summary": "Multi-paragraph executive summary covering the entire meeting...",
  "keyPoints": ["Point 1", "Point 2", "Point 3"],
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
}

async function callChatWithFallback(messages: any[], model = DEFAULT_CHAT_MODEL): Promise<any> {
  try {
    return await groq.chat.completions.create({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages
    });
  } catch (err: any) {
    if (model !== FALLBACK_CHAT_MODEL) {
      console.warn(`[MeetingNotes] Model ${model} call failed, retrying with fallback ${FALLBACK_CHAT_MODEL}:`, err?.message);
      return await groq.chat.completions.create({
        model: FALLBACK_CHAT_MODEL,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages
      });
    }
    throw err;
  }
}

async function extractNotesFromText(
  transcript: string,
  meetingTitle?: string,
  isPartial = false
): Promise<MeetingNotesResult> {
  const prompt = buildSystemPrompt(meetingTitle, isPartial);

  const response = await callChatWithFallback([
    {
      role: "system",
      content: prompt
    },
    {
      role: "user",
      content: transcript
    }
  ]);

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Groq returned an empty meeting notes response.");
  }

  const result = JSON.parse(content);

  return {
    title: result.title || meetingTitle || "VoxFlow Meeting Summary",
    summary: result.summary || "Summary not available.",
    keyPoints: Array.isArray(result.keyPoints) && result.keyPoints.length > 0 ? result.keyPoints : ["Session completed."],
    decisions: Array.isArray(result.decisions) ? result.decisions : [],
    actionItems: Array.isArray(result.actionItems) ? result.actionItems : [],
    followUps: Array.isArray(result.followUps) ? result.followUps : [],
    topics: Array.isArray(result.topics) && result.topics.length > 0 ? result.topics : [],
    primaryLanguages: Array.isArray(result.primaryLanguages) && result.primaryLanguages.length ? result.primaryLanguages : ["English"]
  };
}

/**
 * Splits massive transcripts (> 80k characters / 2+ hours) into logical segments
 */
function splitMassiveTranscript(text: string, maxChunkLength = MAX_DIRECT_TRANSCRIPT_CHARS): string[] {
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

    let splitIndex = remaining.lastIndexOf("\n\n", maxChunkLength);
    if (splitIndex === -1 || splitIndex < maxChunkLength * 0.5) {
      splitIndex = remaining.lastIndexOf("\n", maxChunkLength);
    }
    if (splitIndex === -1 || splitIndex < maxChunkLength * 0.5) {
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

/**
 * Fallback notes generator from text when all API calls fail
 */
function createFallbackMeetingNotes(transcript: string, meetingTitle?: string): MeetingNotesResult {
  const paragraphs = transcript.split(/\n+/).map((p) => p.trim()).filter((p) => p.length > 20);
  const sentences = transcript.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter((s) => s.length > 15);

  const title = meetingTitle || (sentences[0] ? sentences[0].slice(0, 60) : "VoxFlow Meeting Summary");
  const summary = paragraphs.slice(0, 4).join("\n\n") || transcript.slice(0, 600);
  const keyPoints = sentences.slice(0, 6);

  return {
    title,
    summary,
    keyPoints: keyPoints.length > 0 ? keyPoints : [transcript.slice(0, 150)],
    decisions: [],
    actionItems: [],
    followUps: [],
    topics: [{ title: "General Discussion", summary: transcript.slice(0, 300) }],
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

  try {
    // 1. If transcript fits in direct context (up to 80,000 characters / ~90 mins of speech),
    // analyze the entire meeting holistically in one single pass for maximum quality and coherence.
    if (cleanTranscript.length <= MAX_DIRECT_TRANSCRIPT_CHARS) {
      return await extractNotesFromText(cleanTranscript, meetingTitle, false);
    }

    // 2. Only for massive meetings (> 80k chars / > 2 hours), chunk and aggregate
    const chunks = splitMassiveTranscript(cleanTranscript, MAX_DIRECT_TRANSCRIPT_CHARS);
    const chunkResults: MeetingNotesResult[] = [];

    for (let i = 0; i < chunks.length; i++) {
      try {
        const res = await extractNotesFromText(chunks[i], meetingTitle, true);
        chunkResults.push(res);
      } catch (err) {
        console.warn(`Meeting notes chunk ${i + 1}/${chunks.length} partial warning:`, err);
        chunkResults.push(createFallbackMeetingNotes(chunks[i], meetingTitle));
      }
    }

    // Deduplicate and aggregate decisions, action items, topics, languages
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

    const allKeyPoints: string[] = [];
    for (const r of chunkResults) {
      for (const p of r.keyPoints) {
        if (!allKeyPoints.includes(p)) {
          allKeyPoints.push(p);
        }
      }
    }

    const combinedSummaries = chunkResults.map((r, i) => `### Section ${i + 1}\n${r.summary}`).join("\n\n");
    let finalSummary = "";
    try {
      const summaryResponse = await callChatWithFallback([
        {
          role: "system",
          content: "You are VoxFlow's Meeting Intelligence Engine. Synthesize the section summaries of a long meeting into a cohesive, multi-paragraph executive overview covering all major themes, decisions, and outcomes. Return a JSON object with a 'summary' string field."
        },
        {
          role: "user",
          content: combinedSummaries
        }
      ]);
      const parsed = JSON.parse(summaryResponse.choices[0]?.message?.content || "{}");
      finalSummary = parsed.summary || "";
    } catch {
      finalSummary = combinedSummaries;
    }

    return {
      title: chunkResults[0]?.title || meetingTitle || "VoxFlow Meeting Summary",
      summary: finalSummary || combinedSummaries,
      keyPoints: allKeyPoints.length > 0 ? allKeyPoints : ["Comprehensive meeting session held."],
      decisions: allDecisions,
      actionItems: allActionItems,
      followUps: allFollowUps,
      topics: allTopics.length > 0 ? allTopics : [{ title: "Session Topics", summary: "Multiple detailed discussions covered during the meeting." }],
      primaryLanguages: ["English"]
    };
  } catch (error: any) {
    console.error("Meeting notes generation error:", error);
    return createFallbackMeetingNotes(cleanTranscript, meetingTitle);
  }
}
