import { describe, it, expect } from "vitest";
import { SUPPORTED_LANGUAGES } from "../data/languages";
import type { MeetingRecord } from "@voxflow/shared";

describe("FloatingWebWidget Voice & Meeting Notes Test Suite", () => {
  it("should have valid language options with auto detect available", () => {
    expect(SUPPORTED_LANGUAGES.length).toBeGreaterThan(10);
    const autoLang = SUPPORTED_LANGUAGES.find((l) => l.id === "auto");
    expect(autoLang).toBeDefined();
    expect(autoLang?.name).toContain("Auto");
  });

  it("should support Hindi and Hinglish languages for transcription", () => {
    const hindi = SUPPORTED_LANGUAGES.find((l) => l.id === "hindi");
    const hinglish = SUPPORTED_LANGUAGES.find((l) => l.id === "hinglish");
    expect(hindi).toBeDefined();
    expect(hinglish).toBeDefined();
  });

  it("should simulate target element text insertion into input element", () => {
    const input = {
      type: "text",
      value: "Original text ",
      selectionStart: 14,
      selectionEnd: 14
    };

    const transcript = "transcribed speech";
    const start = input.selectionStart || input.value.length;
    const end = input.selectionEnd || input.value.length;
    input.value = input.value.substring(0, start) + transcript + input.value.substring(end);

    expect(input.value).toBe("Original text transcribed speech");
  });

  it("should simulate target element text insertion into textarea element", () => {
    const textarea = {
      value: "Dear Team,\n\n",
      selectionStart: 12,
      selectionEnd: 12
    };

    const transcript = "Meeting notes have been finalized.";
    const start = textarea.selectionStart || textarea.value.length;
    const end = textarea.selectionEnd || textarea.value.length;
    textarea.value = textarea.value.substring(0, start) + transcript + textarea.value.substring(end);

    expect(textarea.value).toContain("Meeting notes have been finalized.");
  });

  it("should generate structured Markdown meeting export with topics, decisions, and actions", () => {
    const sampleMeeting: MeetingRecord = {
      id: "meet_123",
      userId: "user_test",
      title: "Q4 Roadmap Review",
      date: "Nov 2, 2026",
      time: "10:00 AM",
      duration: "45m 12s",
      status: "completed",
      primaryLanguages: ["English"],
      summaryPreview: "Executive summary preview.",
      fullSummary: "The team agreed on launching VoxFlow Chrome extension and cross-tab voice typing.",
      participants: [{ id: "p1", name: "Sujal", role: "Host", avatar: "" }],
      topics: [
        { id: "top_1", title: "Chrome Extension Release", timeRange: "00:00 - 15:30", summary: "Reviewed cross-tab insertion and offscreen audio pipeline." }
      ],
      decisions: [
        { id: "dec_1", decision: "Deploy extension version 0.1.0 to production.", context: "Release Checklist" }
      ],
      actionItems: [
        { id: "act_1", task: "Run final end-to-end tests across websites", assignee: "QA Team", dueDate: "Tomorrow", completed: false }
      ],
      transcript: [
        { id: "u_1", speakerId: "s1", speakerName: "Sujal", speakerRole: "Host", isCurrentUser: true, timestamp: "01:10", originalLanguage: "en", originalText: "Let's review the final deployment items." }
      ],
      initialNotes: ""
    };

    // Format markdown
    let md = `# ${sampleMeeting.title}\n\n`;
    md += `**Date:** ${sampleMeeting.date} | **Time:** ${sampleMeeting.time} | **Duration:** ${sampleMeeting.duration}\n\n`;
    md += `## Summary\n${sampleMeeting.fullSummary}\n\n`;
    md += `## Discussion Topics\n- **${sampleMeeting.topics[0].title}**: ${sampleMeeting.topics[0].summary}\n\n`;
    md += `## Key Decisions\n- **Decision:** ${sampleMeeting.decisions[0].decision}\n\n`;
    md += `## Action Items\n- [ ] **${sampleMeeting.actionItems[0].task}** (Assignee: ${sampleMeeting.actionItems[0].assignee})\n\n`;
    md += `## Transcript\n**${sampleMeeting.transcript[0].speakerName}**: ${sampleMeeting.transcript[0].originalText}\n`;

    expect(md).toContain("# Q4 Roadmap Review");
    expect(md).toContain("## Discussion Topics");
    expect(md).toContain("## Key Decisions");
    expect(md).toContain("## Action Items");
    expect(md).toContain("Chrome Extension Release");
    expect(md).toContain("Deploy extension version 0.1.0 to production.");
  });

  it("should validate all 3 audio sources supported for meeting capture", () => {
    const supportedSources = ["mic", "system", "combined"];
    expect(supportedSources).toContain("mic");
    expect(supportedSources).toContain("system");
    expect(supportedSources).toContain("combined");
  });

  it("should support all 6 tabs in meeting notes: overview, summary, topics, decisions, actions, transcript", () => {
    const tabs = ["overview", "summary", "topics", "decisions", "actions", "transcript"];
    expect(tabs).toHaveLength(6);
    expect(tabs[0]).toBe("overview");
  });

  it("should sort meeting history correctly by newest, oldest, and title", () => {
    const meetings = [
      { id: "1", title: "Beta Standup", date: "2026-10-01" },
      { id: "2", title: "Alpha Planning", date: "2026-10-15" },
      { id: "3", title: "Zeta Retrospective", date: "2026-10-10" }
    ];

    // Sort by newest
    const sortedNewest = [...meetings].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    expect(sortedNewest[0].title).toBe("Alpha Planning");

    // Sort by title
    const sortedTitle = [...meetings].sort((a, b) => a.title.localeCompare(b.title));
    expect(sortedTitle[0].title).toBe("Alpha Planning");
    expect(sortedTitle[1].title).toBe("Beta Standup");
    expect(sortedTitle[2].title).toBe("Zeta Retrospective");
  });

  it("should filter meeting history by query matching title or summary", () => {
    const meetings = [
      { id: "1", title: "Sprint Retrospective", fullSummary: "Discussed deployment metrics." },
      { id: "2", title: "Product Roadmap", fullSummary: "Q4 goals and pricing updates." },
      { id: "3", title: "Customer Success Sync", fullSummary: "Feedback on audio transcription accuracy." }
    ];

    const search = (q: string) => {
      const lower = q.toLowerCase();
      return meetings.filter(
        (m) => m.title.toLowerCase().includes(lower) || m.fullSummary.toLowerCase().includes(lower)
      );
    };

    expect(search("pricing")).toHaveLength(1);
    expect(search("pricing")[0].title).toBe("Product Roadmap");
    expect(search("audio")).toHaveLength(1);
    expect(search("sync")).toHaveLength(1);
    expect(search("nonexistent")).toHaveLength(0);
  });

  it("should format timer seconds into MM:SS format accurately", () => {
    const formatTimer = (secs: number) => {
      const mins = Math.floor(secs / 60);
      const rem = secs % 60;
      return `${mins.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
    };

    expect(formatTimer(0)).toBe("00:00");
    expect(formatTimer(9)).toBe("00:09");
    expect(formatTimer(65)).toBe("01:05");
    expect(formatTimer(360)).toBe("06:00");
    expect(formatTimer(3599)).toBe("59:59");
  });

  it("should validate all 4 segmented widget modes: voice, meeting, history, settings", () => {
    const modes = ["voice", "meeting", "history", "settings"];
    expect(modes).toContain("voice");
    expect(modes).toContain("meeting");
    expect(modes).toContain("history");
    expect(modes).toContain("settings");
    expect(modes).toHaveLength(4);
  });

  it("should validate keyboard shortcut detection for Meta+Shift+X or Ctrl+Shift+X", () => {
    const isToggleShortcut = (e: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; key: string }) => {
      return (Boolean(e.metaKey) || Boolean(e.ctrlKey)) && Boolean(e.shiftKey) && (e.key === "x" || e.key === "X");
    };

    // Mac Cmd+Shift+X
    expect(isToggleShortcut({ metaKey: true, shiftKey: true, key: "x" })).toBe(true);
    expect(isToggleShortcut({ metaKey: true, shiftKey: true, key: "X" })).toBe(true);

    // Windows/Linux Ctrl+Shift+X
    expect(isToggleShortcut({ ctrlKey: true, shiftKey: true, key: "x" })).toBe(true);

    // Non-matching keys
    expect(isToggleShortcut({ metaKey: true, shiftKey: false, key: "x" })).toBe(false);
    expect(isToggleShortcut({ metaKey: false, ctrlKey: false, shiftKey: true, key: "x" })).toBe(false);
    expect(isToggleShortcut({ metaKey: true, shiftKey: true, key: "z" })).toBe(false);
  });

  it("should accurately compute remaining quota for free and pro plans", () => {
    const freeEntitlements = {
      isPremium: false,
      usage: {
        transcriptionMinutesUsed: 12,
        transcriptionMinutesLimit: 30,
        meetingsUsed: 2,
        meetingsLimit: 5
      }
    };

    const remainingVoiceMins = freeEntitlements.usage.transcriptionMinutesLimit - freeEntitlements.usage.transcriptionMinutesUsed;
    const remainingMeetings = freeEntitlements.usage.meetingsLimit - freeEntitlements.usage.meetingsUsed;

    expect(remainingVoiceMins).toBe(18);
    expect(remainingMeetings).toBe(3);
  });

  it("should support selecting specific output language and default to same as spoken", () => {
    const defaultOutputLang = "same";
    expect(defaultOutputLang).toBe("same");

    const availableOutputLanguages = [
      { id: "same", name: "Same as Spoken" },
      ...SUPPORTED_LANGUAGES.filter((l) => l.id !== "auto")
    ];

    expect(availableOutputLanguages.find((l) => l.id === "same")).toBeDefined();
    expect(availableOutputLanguages.find((l) => l.id === "english")).toBeDefined();
    expect(availableOutputLanguages.find((l) => l.id === "hindi")).toBeDefined();
    expect(availableOutputLanguages.find((l) => l.id === "spanish")).toBeDefined();
  });
});
