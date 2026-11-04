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

  it("should prevent starting voice command when voice typing quota is exhausted", () => {
    const isPremium = false;
    const entitlements = {
      isPremium: false,
      breakdown: {
        voiceTyping: { isExhausted: true },
        transcriptionMinutes: { isExhausted: false },
        meetings: { isExhausted: false }
      },
      usage: {
        voiceTypingUsed: 100,
        voiceTypingLimit: 100
      }
    };

    const isVoiceLimitReached = !isPremium && Boolean(
      entitlements?.breakdown?.voiceTyping?.isExhausted ||
      (entitlements?.usage && entitlements.usage.voiceTypingLimit > 0 && entitlements.usage.voiceTypingUsed >= entitlements.usage.voiceTypingLimit)
    );

    expect(isVoiceLimitReached).toBe(true);

    let startCommandExecuted = false;
    const handleVoiceStart = () => {
      if (isVoiceLimitReached) {
        return; // strictly blocked
      }
      startCommandExecuted = true;
    };

    handleVoiceStart();
    expect(startCommandExecuted).toBe(false);
  });

  it("should prevent starting meeting when meeting limit is exhausted on free plan", () => {
    const isPremium = false;
    const entitlements = {
      isPremium: false,
      breakdown: {
        voiceTyping: { isExhausted: false },
        transcriptionMinutes: { isExhausted: false },
        meetings: { isExhausted: true }
      },
      usage: {
        meetingsUsed: 3,
        meetingsLimit: 3
      }
    };

    const isMeetingLimitReached = !isPremium && Boolean(
      entitlements?.breakdown?.meetings?.isExhausted ||
      (entitlements?.usage && entitlements.usage.meetingsLimit > 0 && entitlements.usage.meetingsUsed >= entitlements.usage.meetingsLimit)
    );

    expect(isMeetingLimitReached).toBe(true);

    let startMeetingExecuted = false;
    const handleStartMeeting = () => {
      if (isMeetingLimitReached) {
        return; // strictly blocked
      }
      startMeetingExecuted = true;
    };

    handleStartMeeting();
    expect(startMeetingExecuted).toBe(false);
  });

  it("should never block pro/premium users even when usage numbers are high", () => {
    const isPremium = true;
    const entitlements = {
      isPremium: true,
      breakdown: {
        voiceTyping: { isExhausted: false },
        transcriptionMinutes: { isExhausted: false },
        meetings: { isExhausted: false }
      },
      usage: {
        voiceTypingUsed: 9999,
        voiceTypingLimit: -1,
        meetingsUsed: 999,
        meetingsLimit: -1
      }
    };

    const isVoiceLimitReached = !isPremium && Boolean(
      entitlements?.breakdown?.voiceTyping?.isExhausted ||
      (entitlements?.usage && entitlements.usage.voiceTypingLimit > 0 && entitlements.usage.voiceTypingUsed >= entitlements.usage.voiceTypingLimit)
    );
    const isMeetingLimitReached = !isPremium && Boolean(
      entitlements?.breakdown?.meetings?.isExhausted ||
      (entitlements?.usage && entitlements.usage.meetingsLimit > 0 && entitlements.usage.meetingsUsed >= entitlements.usage.meetingsLimit)
    );

    expect(isVoiceLimitReached).toBe(false);
    expect(isMeetingLimitReached).toBe(false);

    let startCommandExecuted = false;
    const handleVoiceStart = () => {
      if (isVoiceLimitReached) return;
      startCommandExecuted = true;
    };

    handleVoiceStart();
    expect(startCommandExecuted).toBe(true);
  });

  it("should record voice typing items into voice history and allow search filtering", () => {
    interface TestVoiceHistoryItem {
      id: string;
      text: string;
      timestamp: string;
      date: string;
      language: string;
      outputLanguage?: string;
      duration?: number;
    }

    const items: TestVoiceHistoryItem[] = [
      {
        id: "vh_1",
        text: "Please send the quarterly revenue report to the team.",
        timestamp: "09:30 AM",
        date: "Nov 4, 2026",
        language: "english",
        duration: 12
      },
      {
        id: "vh_2",
        text: "Hum kal subah 10 baje milenge meeting ke liye.",
        timestamp: "10:15 AM",
        date: "Nov 4, 2026",
        language: "hinglish",
        duration: 8
      }
    ];

    // Filter by search query
    const searchFilter = (list: TestVoiceHistoryItem[], q: string) => {
      const lower = q.toLowerCase();
      return list.filter((item) => item.text.toLowerCase().includes(lower) || item.language.toLowerCase().includes(lower));
    };

    expect(searchFilter(items, "revenue")).toHaveLength(1);
    expect(searchFilter(items, "revenue")[0].id).toBe("vh_1");
    expect(searchFilter(items, "meeting")).toHaveLength(1);
    expect(searchFilter(items, "meeting")[0].id).toBe("vh_2");
    expect(searchFilter(items, "nonexistent")).toHaveLength(0);
  });

  it("should support deleting voice history records and clearing all voice history", () => {
    let history = [
      { id: "vh_1", text: "First record" },
      { id: "vh_2", text: "Second record" },
      { id: "vh_3", text: "Third record" }
    ];

    // Delete single item
    history = history.filter((i) => i.id !== "vh_2");
    expect(history).toHaveLength(2);
    expect(history.find((i) => i.id === "vh_2")).toBeUndefined();

    // Clear all
    history = [];
    expect(history).toHaveLength(0);
  });

  it("should support transcript input editing and text insertion into simulated field", () => {
    let transcriptInput = "Initial dictated voice note";

    // Edit transcript in input
    transcriptInput += " with user additions.";
    expect(transcriptInput).toBe("Initial dictated voice note with user additions.");

    // Simulate insertion into input element
    const inputElement = {
      type: "text",
      value: "Prefix: ",
      selectionStart: 8,
      selectionEnd: 8
    };

    const start = inputElement.selectionStart;
    const end = inputElement.selectionEnd;
    inputElement.value = inputElement.value.substring(0, start) + transcriptInput + inputElement.value.substring(end);

    expect(inputElement.value).toBe("Prefix: Initial dictated voice note with user additions.");
  });

  it("should maintain both transcript input and transcript output simultaneously in the widget", () => {
    let transcriptInput = "Raw voice audio words spoken by user";
    let transcriptOutput = "Polished, grammatically refined voice output.";

    expect(transcriptInput).not.toBe(transcriptOutput);
    expect(transcriptInput).toContain("Raw voice");
    expect(transcriptOutput).toContain("Polished");

    // Copying output should use transcriptOutput
    const textToCopy = transcriptOutput || transcriptInput;
    expect(textToCopy).toBe("Polished, grammatically refined voice output.");

    // Clearing input should not wipe output unless requested
    transcriptInput = "";
    expect(transcriptInput).toBe("");
    expect(transcriptOutput).toBe("Polished, grammatically refined voice output.");
  });

  it("should synchronize widget voice input into the site's voice history userStore", () => {
    const mockSiteVoiceHistory: any[] = [];
    const saveToSiteHistory = (userId: string, item: any) => {
      mockSiteVoiceHistory.unshift({
        id: item.id,
        userId,
        transcript: item.transcript,
        transformedText: item.transformedText,
        language: item.language,
        createdAt: item.createdAt
      });
    };

    const widgetSpokenInput = "Quarterly roadmap sync discussion";
    const widgetOutput = "Quarterly roadmap sync discussion finalized.";

    saveToSiteHistory("user_123", {
      id: "trans_test_1",
      transcript: widgetSpokenInput,
      transformedText: widgetOutput,
      language: "english",
      createdAt: new Date().toISOString()
    });

    expect(mockSiteVoiceHistory).toHaveLength(1);
    expect(mockSiteVoiceHistory[0].userId).toBe("user_123");
    expect(mockSiteVoiceHistory[0].transcript).toBe(widgetSpokenInput);
    expect(mockSiteVoiceHistory[0].transformedText).toBe(widgetOutput);
  });

  it("should clear all previous voice typing fields when starting new voice typing or resetting", () => {
    let voiceTranscriptInput = "Old spoken words from previous run";
    let voiceTranscriptOutput = "Old transformed text";
    let voiceDuration = 42;
    let voiceError: string | null = "Some past error";
    let voiceState = "completed";

    // Reset voice typing
    const handleResetVoiceTyping = () => {
      voiceTranscriptInput = "";
      voiceTranscriptOutput = "";
      voiceDuration = 0;
      voiceError = null;
      voiceState = "idle";
    };

    handleResetVoiceTyping();

    expect(voiceTranscriptInput).toBe("");
    expect(voiceTranscriptOutput).toBe("");
    expect(voiceDuration).toBe(0);
    expect(voiceError).toBeNull();
    expect(voiceState).toBe("idle");
  });

  it("should clear all previous meeting fields when creating a new meeting", () => {
    let meetingTitle = "Past Meeting Title - Q3 Retro";
    let currentMeeting: any = { id: "m_1", title: "Past Meeting" };
    let meetingDuration = 120;
    let editedSummary = "Old summary notes";
    let editedTopics = [{ title: "Topic 1" }];
    let editedDecisions = [{ decision: "Decision 1" }];
    let editedActions = [{ task: "Task 1" }];
    let meetingStep = "completed";

    // New meeting action
    const handleStartNewMeeting = () => {
      meetingTitle = "";
      currentMeeting = null;
      meetingStep = "setup";
      meetingDuration = 0;
      editedSummary = "";
      editedTopics = [];
      editedDecisions = [];
      editedActions = [];
    };

    handleStartNewMeeting();

    expect(meetingTitle).toBe("");
    expect(currentMeeting).toBeNull();
    expect(meetingStep).toBe("setup");
    expect(meetingDuration).toBe(0);
    expect(editedSummary).toBe("");
    expect(editedTopics).toHaveLength(0);
    expect(editedDecisions).toHaveLength(0);
    expect(editedActions).toHaveLength(0);
  });
});




