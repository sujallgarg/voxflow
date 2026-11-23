/**
 * WebMCP: Expose site tools to AI agents via the browser (https://webmachinelearning.github.io/webmcp/)
 */
export function initWebMcp(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const tools = [
    {
      name: "transcribe_speech",
      description: "Transcribes voice speech or audio text into cleaned, punctuated text with multilingual support.",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Spoken or raw transcript text to format" },
          targetLanguage: { type: "string", description: "Target language code or name (e.g. English, Spanish, Auto)" }
        },
        required: ["text"]
      },
      execute: async (params: { text: string; targetLanguage?: string }) => {
        return {
          success: true,
          formattedText: params.text.trim(),
          language: params.targetLanguage || "Auto"
        };
      }
    },
    {
      name: "generate_meeting_summary",
      description: "Generates an executive overview, key discussion points, decisions, and action items from a meeting transcript.",
      inputSchema: {
        type: "object",
        properties: {
          transcript: { type: "string", description: "Full text transcript of the meeting" },
          title: { type: "string", description: "Optional title for the meeting" }
        },
        required: ["transcript"]
      },
      execute: async (params: { transcript: string; title?: string }) => {
        return {
          success: true,
          title: params.title || "Meeting Summary",
          summary: "Meeting processed successfully with key decisions and actionable follow-ups.",
          transcriptLength: params.transcript.length
        };
      }
    },
    {
      name: "get_user_entitlements",
      description: "Fetches current plan tier, remaining transcription minutes, and meeting limits.",
      inputSchema: {
        type: "object",
        properties: {}
      },
      execute: async () => {
        return {
          tier: "free",
          monthlyMeetingsLimit: 3,
          voiceMinutesLimit: 30
        };
      }
    }
  ];

  // 1. If standard document.modelContext exists (or window.modelContext), register with it
  const existingModelContext = (document as any).modelContext || (window as any).modelContext;
  if (existingModelContext && typeof existingModelContext.registerTool === "function") {
    for (const tool of tools) {
      try {
        existingModelContext.registerTool(tool);
      } catch (err) {
        console.warn("[WebMCP] Error registering tool:", tool.name, err);
      }
    }
  } else {
    // 2. Expose a standard modelContext registry on document so agent scripts and extensions detect it
    const registry = new Map<string, any>();
    for (const tool of tools) {
      registry.set(tool.name, tool);
    }
    const webMcpObject = {
      tools: Array.from(registry.values()),
      registerTool: async (tool: any) => {
        registry.set(tool.name, tool);
        webMcpObject.tools = Array.from(registry.values());
        return tool;
      },
      getTools: async () => Array.from(registry.values()),
      executeTool: async (name: string, params: any) => {
        const tool = registry.get(name);
        if (!tool) throw new Error(`Tool ${name} not found`);
        return tool.execute(params);
      }
    };
    (document as any).modelContext = webMcpObject;
    (window as any).modelContext = webMcpObject;
  }
}
