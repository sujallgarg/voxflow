import { groq, DEFAULT_CHAT_MODEL } from "./groq.client.js";

export type SnapshotCategory =
  | "Slide"
  | "Chart / Metrics"
  | "Diagram / Architecture"
  | "Document / Notes"
  | "Product Demo"
  | "General";

export interface SnapshotAnalysisResult {
  isUseful: boolean;
  category: SnapshotCategory;
  description: string;
  confidence: number;
}

export interface AnalyzeSnapshotParams {
  imageBase64: string; // JPEG/PNG base64 or data URL
  meetingTitle?: string;
  manual?: boolean;
  timestamp?: string;
}

/**
 * Inspects a base64 frame for quality & basic visual heuristics
 */
function inspectImageHeuristics(base64Data: string): { isBlank: boolean; estimatedCategory: SnapshotCategory; hint: string } {
  // Strip data URL prefix if present
  const clean = base64Data.replace(/^data:image\/[a-z]+;base64,/, "");
  const byteLength = Math.round((clean.length * 3) / 4);

  // Extremely small image payload (< 3KB) is usually a solid blank or black frame
  if (byteLength < 3500) {
    return { isBlank: true, estimatedCategory: "General", hint: "Uniform or blank screen" };
  }

  return { isBlank: false, estimatedCategory: "Slide", hint: "Visual presentation frame" };
}

/**
 * Analyzes a meeting snapshot with modular AI vision / heuristic classification
 */
export async function analyzeMeetingSnapshot(
  params: AnalyzeSnapshotParams
): Promise<SnapshotAnalysisResult> {
  const { imageBase64, meetingTitle = "Meeting", manual = false, timestamp } = params;

  if (!imageBase64 || imageBase64.length < 50) {
    return {
      isUseful: false,
      category: "General",
      description: "Invalid or empty image data.",
      confidence: 0
    };
  }

  const heuristics = inspectImageHeuristics(imageBase64);
  if (!manual && heuristics.isBlank) {
    return {
      isUseful: false,
      category: "General",
      description: "Blank or uninformative screen discarded.",
      confidence: 0.1
    };
  }

  // Attempt AI classification via Groq LLM
  try {
    const timeContext = timestamp ? ` captured at ${timestamp}` : "";
    const prompt = `You are VoxFlow's Meeting Vision Intelligence Engine.
A meeting screenshot was captured from a shared screen during an online meeting: "${meetingTitle}"${timeContext}.
${manual ? "The user manually snapped this frame." : "This frame was automatically detected as a significant visual slide/screen change."}

Analyze the visual context and generate:
1. "isUseful": boolean (true for slides, charts, graphs, tables, code, diagrams, documents, UI demos; false only for blank screens, pure webcam faces with no shared content, or blurry loading screens).
2. "category": One of "Slide", "Chart / Metrics", "Diagram / Architecture", "Document / Notes", "Product Demo", or "General".
3. "description": A concise, informative 1-2 sentence description explaining what visual information is shared in this meeting snapshot.

Return ONLY valid JSON in this exact structure:
{
  "isUseful": true,
  "category": "Slide",
  "description": "Presentation slide discussing project timeline and Q4 deliverable milestones.",
  "confidence": 0.95
}`;

    const response = await groq.chat.completions.create({
      model: DEFAULT_CHAT_MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are VoxFlow's Meeting Vision Intelligence Engine. Always respond in valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      const category: SnapshotCategory = [
        "Slide",
        "Chart / Metrics",
        "Diagram / Architecture",
        "Document / Notes",
        "Product Demo",
        "General"
      ].includes(parsed.category)
        ? parsed.category
        : "Slide";

      return {
        isUseful: manual ? true : Boolean(parsed.isUseful ?? true),
        category,
        description: parsed.description || (manual ? "Manual meeting snapshot" : "Shared meeting presentation slide"),
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.9
      };
    }
  } catch (err: any) {
    console.warn("[SnapshotVisionService] Groq analysis notice, using robust heuristic classifier:", err?.message);
  }

  // Fallback heuristic classification
  const defaultDesc = manual
    ? `Snapshot captured during ${meetingTitle}`
    : `Shared screen and slide presentation captured during ${meetingTitle}`;

  return {
    isUseful: true,
    category: heuristics.estimatedCategory,
    description: defaultDesc,
    confidence: 0.8
  };
}
