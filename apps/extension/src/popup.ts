import {
  MIXED_LANGUAGE_MODES,
  STANDARD_LANGUAGES,
  isValidTargetLanguage
} from "./languages.js";

interface SessionState {
  sessionId: string;
  mode: "idle" | "recording_mic" | "capturing_tab" | "capturing_meeting" | "processing";
  step:
    | "idle"
    | "recording"
    | "finalizing"
    | "transcribing"
    | "detecting_language"
    | "understanding"
    | "detecting_context"
    | "transforming"
    | "generating_notes"
    | "ready"
    | "error";
  targetLanguage: string;
  targetTabId?: number | null;
  transcript?: string;
  finalText?: string;
  error?: string | null;
  startedAt?: number;
  completedAt?: number;
  meetingId?: string;
  meetingTitle?: string;
  meetingLink?: string;
  isPaused?: boolean;
}

const STORAGE_KEY_SESSION = "voxflow_session_state";
const STORAGE_KEY_TARGET_LANG = "voxflow_target_language";

// --------------------------------------------------
// DOM ELEMENTS
// --------------------------------------------------

// Mode Tabs
const tabBtnVoice = document.getElementById("tab-btn-voice") as HTMLButtonElement;
const tabBtnMeeting = document.getElementById("tab-btn-meeting") as HTMLButtonElement;
const viewVoice = document.getElementById("view-voice") as HTMLElement;
const viewMeeting = document.getElementById("view-meeting") as HTMLElement;

// Status Bar
const statusBar = document.getElementById("status-bar") as HTMLDivElement;
const statusText = document.getElementById("status-text") as HTMLSpanElement;
const meetingTimer = document.getElementById("meeting-timer") as HTMLSpanElement;

// Language Selector
const languageSelect = document.getElementById("voxflow-target-language") as HTMLSelectElement;

// Voice Input Controls
const recordButton = document.getElementById("record-button") as HTMLButtonElement;
const recordIcon = document.getElementById("record-icon") as HTMLSpanElement;
const recordText = document.getElementById("record-text") as HTMLSpanElement;

const tabAudioButton = document.getElementById("tab-audio-button") as HTMLButtonElement;
const tabAudioIcon = document.getElementById("tab-audio-icon") as HTMLSpanElement;
const tabAudioText = document.getElementById("tab-audio-text") as HTMLSpanElement;

const messageEl = document.getElementById("message") as HTMLParagraphElement;

const transcriptContainer = document.getElementById("transcript-container") as HTMLDivElement;
const transcriptEl = document.getElementById("transcript") as HTMLDivElement;

const finalTextContainer = document.getElementById("final-text-container") as HTMLDivElement;
const finalTextEl = document.getElementById("final-text") as HTMLDivElement;
const outputLangBadge = document.getElementById("output-language-badge") as HTMLSpanElement;

const insertButton = document.getElementById("insert-button") as HTMLButtonElement;
const copyButton = document.getElementById("copy-button") as HTMLButtonElement;
const resetButton = document.getElementById("reset-button") as HTMLButtonElement;

// Meeting Controls
const meetingTitleInput = document.getElementById("meeting-title-input") as HTMLInputElement;
const meetingIdleControls = document.getElementById("meeting-idle-controls") as HTMLDivElement;
const startMeetingButton = document.getElementById("start-meeting-button") as HTMLButtonElement;

const meetingActiveControls = document.getElementById("meeting-active-controls") as HTMLDivElement;
const meetingStatusLabel = document.getElementById("meeting-status-label") as HTMLSpanElement;
const meetingActiveTimer = document.getElementById("meeting-active-timer") as HTMLSpanElement;
const pauseMeetingButton = document.getElementById("pause-meeting-button") as HTMLButtonElement;
const pauseIcon = document.getElementById("pause-icon") as HTMLSpanElement;
const pauseText = document.getElementById("pause-text") as HTMLSpanElement;
const stopMeetingButton = document.getElementById("stop-meeting-button") as HTMLButtonElement;

const meetingProcessingCard = document.getElementById("meeting-processing-card") as HTMLDivElement;
const meetingMessage = document.getElementById("meeting-message") as HTMLParagraphElement;

const meetingCompletedCard = document.getElementById("meeting-completed-card") as HTMLDivElement;
const completedMeetingTitle = document.getElementById("completed-meeting-title") as HTMLHeadingElement;
const completedMeetingSummary = document.getElementById("completed-meeting-summary") as HTMLParagraphElement;
const openMeetingLink = document.getElementById("open-meeting-link") as HTMLAnchorElement;
const meetingResetBtn = document.getElementById("meeting-reset-btn") as HTMLButtonElement;

// Local mirror of session
let currentSession: SessionState = {
  sessionId: "init",
  mode: "idle",
  step: "idle",
  targetLanguage: "Auto",
  transcript: "",
  finalText: "",
  error: null
};

let activeTab: "voice" | "meeting" = "voice";
let timerInterval: number | null = null;

// --------------------------------------------------
// TIMER UTILITY
// --------------------------------------------------

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function startTimer(startedAt?: number) {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  const baseTime = startedAt || Date.now();
  const update = () => {
    const elapsed = Math.floor((Date.now() - baseTime) / 1000);
    const formatted = formatDuration(elapsed);
    if (meetingTimer) meetingTimer.textContent = formatted;
    if (meetingActiveTimer) meetingActiveTimer.textContent = formatted;
  };

  update();
  timerInterval = window.setInterval(update, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// --------------------------------------------------
// TAB SWITCHING
// --------------------------------------------------

function switchTab(target: "voice" | "meeting") {
  activeTab = target;
  if (target === "voice") {
    tabBtnVoice.classList.add("active");
    tabBtnVoice.setAttribute("aria-selected", "true");
    tabBtnMeeting.classList.remove("active");
    tabBtnMeeting.setAttribute("aria-selected", "false");
    viewVoice.classList.remove("hidden");
    viewMeeting.classList.add("hidden");
  } else {
    tabBtnMeeting.classList.add("active");
    tabBtnMeeting.setAttribute("aria-selected", "true");
    tabBtnVoice.classList.remove("active");
    tabBtnVoice.setAttribute("aria-selected", "false");
    viewMeeting.classList.remove("hidden");
    viewVoice.classList.add("hidden");
  }
}

tabBtnVoice.addEventListener("click", () => switchTab("voice"));
tabBtnMeeting.addEventListener("click", () => switchTab("meeting"));

// --------------------------------------------------
// POPULATE LANGUAGE SELECTOR
// --------------------------------------------------

function populateLanguageSelector() {
  languageSelect.innerHTML = "";

  // 1. Auto
  const autoOpt = document.createElement("option");
  autoOpt.value = "Auto";
  autoOpt.textContent = "Auto (Contextual Detection)";
  languageSelect.appendChild(autoOpt);

  // 2. Mixed Language Modes
  const mixedGroup = document.createElement("optgroup");
  mixedGroup.label = "── Mixed Language Modes ──";
  for (const mode of MIXED_LANGUAGE_MODES) {
    const opt = document.createElement("option");
    opt.value = mode.name;
    opt.textContent = `${mode.name} (Code-switching)`;
    mixedGroup.appendChild(opt);
  }
  languageSelect.appendChild(mixedGroup);

  // 3. Standard Languages
  const langGroup = document.createElement("optgroup");
  langGroup.label = "── Languages ──";
  for (const lang of STANDARD_LANGUAGES) {
    const opt = document.createElement("option");
    opt.value = lang;
    opt.textContent = lang;
    langGroup.appendChild(opt);
  }
  languageSelect.appendChild(langGroup);
}

// --------------------------------------------------
// RENDER UI FROM SESSION STATE
// --------------------------------------------------

function renderUI(session: SessionState) {
  currentSession = session;

  // Sync selected language
  if (session.targetLanguage && languageSelect.value !== session.targetLanguage) {
    languageSelect.value = session.targetLanguage;
  }

  // Automatic View Switching if active meeting session is running
  if (
    session.mode === "capturing_meeting" ||
    (session.mode === "processing" && session.step === "generating_notes") ||
    (session.step === "ready" && session.meetingId)
  ) {
    switchTab("meeting");
  }

  // Status Bar & Pill Styling
  statusBar.classList.remove("recording", "processing");

  if (session.mode === "recording_mic") {
    statusBar.classList.add("recording");
    statusText.textContent = "🎙️ Recording from microphone...";
    meetingTimer.classList.add("hidden");
    stopTimer();
  } else if (session.mode === "capturing_tab") {
    statusBar.classList.add("recording");
    statusText.textContent = "🔊 Capturing tab audio...";
    meetingTimer.classList.add("hidden");
    stopTimer();
  } else if (session.mode === "capturing_meeting") {
    statusBar.classList.add("recording");
    statusText.textContent = session.isPaused
      ? "⏸️ Meeting capture paused"
      : "👥 Capturing meeting audio...";
    meetingTimer.classList.remove("hidden");
    if (!session.isPaused) {
      startTimer(session.startedAt);
    } else {
      stopTimer();
    }
  } else if (session.mode === "processing") {
    statusBar.classList.add("processing");
    meetingTimer.classList.add("hidden");
    stopTimer();
    switch (session.step) {
      case "generating_notes":
        statusText.textContent = "⏳ Generating meeting notes & AI summary...";
        break;
      case "finalizing":
        statusText.textContent = "⏳ Finalizing audio...";
        break;
      case "transcribing":
        statusText.textContent = "⏳ Transcribing speech...";
        break;
      case "detecting_language":
        statusText.textContent = "⏳ Detecting spoken language...";
        break;
      case "understanding":
        statusText.textContent = "⏳ Analyzing meaning and intent...";
        break;
      case "detecting_context":
        statusText.textContent = "⏳ Detecting communication context...";
        break;
      case "transforming":
        statusText.textContent = "⏳ AI Transforming message...";
        break;
      default:
        statusText.textContent = "⏳ Processing audio with AI...";
    }
  } else if (session.step === "ready") {
    meetingTimer.classList.add("hidden");
    stopTimer();
    statusText.textContent = session.meetingId
      ? "✓ Meeting notes saved to workspace"
      : "✓ Text ready for insertion";
  } else if (session.step === "error" || session.error) {
    meetingTimer.classList.add("hidden");
    stopTimer();
    statusText.textContent = "⚠️ An error occurred";
  } else {
    meetingTimer.classList.add("hidden");
    stopTimer();
    statusText.textContent = "Extension ready";
  }

  // -------------------------
  // Voice Controls State
  // -------------------------
  if (session.mode === "recording_mic") {
    recordButton.classList.add("recording");
    recordIcon.textContent = "⏹";
    recordText.textContent = "Stop speaking";
    recordButton.disabled = false;

    tabAudioButton.disabled = true;
    tabAudioButton.classList.remove("recording");
    tabAudioIcon.textContent = "🔊";
    tabAudioText.textContent = "Listen to Tab";
  } else if (session.mode === "capturing_tab") {
    tabAudioButton.classList.add("recording");
    tabAudioIcon.textContent = "⏹";
    tabAudioText.textContent = "Stop Tab Audio";
    tabAudioButton.disabled = false;

    recordButton.disabled = true;
    recordButton.classList.remove("recording");
    recordIcon.textContent = "🎙";
    recordText.textContent = "Start speaking";
  } else if (session.mode === "processing" || session.mode === "capturing_meeting") {
    recordButton.disabled = true;
    recordButton.classList.remove("recording");
    recordIcon.textContent = "🎙";
    recordText.textContent = "Start speaking";

    tabAudioButton.disabled = true;
    tabAudioButton.classList.remove("recording");
    tabAudioIcon.textContent = "🔊";
    tabAudioText.textContent = "Listen to Tab";
  } else {
    recordButton.disabled = false;
    recordButton.classList.remove("recording");
    recordIcon.textContent = "🎙";
    recordText.textContent = "Start speaking";

    tabAudioButton.disabled = false;
    tabAudioButton.classList.remove("recording");
    tabAudioIcon.textContent = "🔊";
    tabAudioText.textContent = "Listen to Tab";
  }

  // Voice Message area
  if (session.error && activeTab === "voice") {
    messageEl.textContent = session.error;
    messageEl.classList.add("error");
  } else if (session.mode === "recording_mic") {
    messageEl.textContent = "Listening to microphone. You may close popup anytime.";
    messageEl.classList.remove("error");
  } else if (session.mode === "capturing_tab") {
    messageEl.textContent = "Recording tab audio. Tab playback continues normally.";
    messageEl.classList.remove("error");
  } else if (session.mode === "processing" && session.step !== "generating_notes") {
    messageEl.textContent = "AI pipeline running in background...";
    messageEl.classList.remove("error");
  } else if (session.step === "ready" && !session.meetingId) {
    messageEl.textContent = `Completed ✓ (${session.targetLanguage})`;
    messageEl.classList.remove("error");
  } else {
    messageEl.textContent = "";
    messageEl.classList.remove("error");
  }

  // Voice Output Preview
  if (session.transcript && session.transcript.trim() && !session.meetingId) {
    transcriptEl.textContent = session.transcript;
    transcriptContainer.classList.remove("hidden");
  } else {
    transcriptContainer.classList.add("hidden");
  }

  if (session.finalText && session.finalText.trim() && !session.meetingId) {
    finalTextEl.textContent = session.finalText;
    outputLangBadge.textContent = session.targetLanguage || "Auto";
    finalTextContainer.classList.remove("hidden");
  } else {
    finalTextContainer.classList.add("hidden");
  }

  // -------------------------
  // Meeting Controls State
  // -------------------------
  if (session.mode === "capturing_meeting") {
    meetingIdleControls.classList.add("hidden");
    meetingActiveControls.classList.remove("hidden");
    meetingProcessingCard.classList.add("hidden");
    meetingCompletedCard.classList.add("hidden");

    if (session.isPaused) {
      meetingStatusLabel.textContent = "Capture Paused";
      pauseIcon.textContent = "▶";
      pauseText.textContent = "Resume";
    } else {
      meetingStatusLabel.textContent = "Recording Active";
      pauseIcon.textContent = "⏸";
      pauseText.textContent = "Pause";
    }
    pauseMeetingButton.disabled = false;
    stopMeetingButton.disabled = false;
  } else if (session.mode === "processing" && session.step === "generating_notes") {
    meetingIdleControls.classList.add("hidden");
    meetingActiveControls.classList.add("hidden");
    meetingProcessingCard.classList.remove("hidden");
    meetingCompletedCard.classList.add("hidden");
  } else if (session.step === "ready" && session.meetingId) {
    meetingIdleControls.classList.add("hidden");
    meetingActiveControls.classList.add("hidden");
    meetingProcessingCard.classList.add("hidden");
    meetingCompletedCard.classList.remove("hidden");

    completedMeetingTitle.textContent = session.meetingTitle || "Meeting Notes";
    completedMeetingSummary.textContent =
      session.finalText || session.transcript || "Notes saved to your workspace.";
    openMeetingLink.href =
      session.meetingLink || `http://localhost:5173/#/meetings/${session.meetingId}`;
  } else {
    // Meeting Idle
    meetingIdleControls.classList.remove("hidden");
    meetingActiveControls.classList.add("hidden");
    meetingProcessingCard.classList.add("hidden");
    meetingCompletedCard.classList.add("hidden");
    startMeetingButton.disabled = false;
  }

  // Meeting error display
  if (session.error && activeTab === "meeting") {
    meetingMessage.textContent = session.error;
    meetingMessage.classList.add("error");
  } else {
    meetingMessage.textContent = "";
    meetingMessage.classList.remove("error");
  }
}

// --------------------------------------------------
// SESSION SYNC & LISTENERS
// --------------------------------------------------

async function syncState() {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: "GET_SESSION_STATE"
    })) as { session?: SessionState } | undefined;

    if (response?.session) {
      renderUI(response.session);
      return;
    }

    // Storage fallback
    const stored = await chrome.storage.local.get([
      STORAGE_KEY_SESSION,
      STORAGE_KEY_TARGET_LANG
    ]);

    if (stored[STORAGE_KEY_SESSION]) {
      renderUI(stored[STORAGE_KEY_SESSION] as SessionState);
    }
  } catch (err) {
    console.error("VoxFlow state query error:", err);
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEY_SESSION]?.newValue) {
    renderUI(changes[STORAGE_KEY_SESSION].newValue as SessionState);
  }
});

// --------------------------------------------------
// LANGUAGE SELECTOR CHANGE
// --------------------------------------------------

languageSelect.addEventListener("change", async () => {
  const chosenLanguage = languageSelect.value;
  if (!isValidTargetLanguage(chosenLanguage)) return;

  try {
    await chrome.runtime.sendMessage({
      type: "SET_TARGET_LANGUAGE",
      targetLanguage: chosenLanguage
    });
    messageEl.textContent = `Target language set to ${chosenLanguage}`;
    messageEl.classList.remove("error");
  } catch (err) {
    console.error("Set language error:", err);
  }
});

// --------------------------------------------------
// MICROPHONE RECORDING CONTROLS
// --------------------------------------------------

recordButton.addEventListener("click", async () => {
  if (currentSession.mode === "recording_mic") {
    // STOP
    recordButton.disabled = true;
    messageEl.textContent = "Stopping recording...";
    try {
      const res = (await chrome.runtime.sendMessage({
        type: "STOP_MIC_RECORDING"
      })) as { success: boolean; reason?: string } | undefined;

      if (!res?.success) {
        throw new Error(res?.reason || "Could not stop microphone.");
      }
    } catch (err) {
      messageEl.textContent = err instanceof Error ? err.message : "Stop failed";
      messageEl.classList.add("error");
      recordButton.disabled = false;
    }
    return;
  }

  // START
  recordButton.disabled = true;
  messageEl.textContent = "Starting microphone...";

  try {
    const res = (await chrome.runtime.sendMessage({
      type: "START_MIC_RECORDING",
      targetLanguage: languageSelect.value
    })) as { success: boolean; reason?: string } | undefined;

    if (!res?.success) {
      const reason = res?.reason || "";
      if (
        reason.toLowerCase().includes("permission") ||
        reason.toLowerCase().includes("notallowederror") ||
        reason.toLowerCase().includes("denied")
      ) {
        await chrome.tabs.create({ url: "permission.html" });
        throw new Error("Please grant microphone permission in the opened tab.");
      }
      throw new Error(reason || "Failed to start microphone recording.");
    }
  } catch (err) {
    messageEl.textContent = err instanceof Error ? err.message : "Start failed";
    messageEl.classList.add("error");
    recordButton.disabled = false;
  }
});

// --------------------------------------------------
// TAB AUDIO CAPTURE CONTROLS
// --------------------------------------------------

tabAudioButton.addEventListener("click", async () => {
  if (currentSession.mode === "capturing_tab") {
    // STOP
    tabAudioButton.disabled = true;
    messageEl.textContent = "Stopping tab audio capture...";
    try {
      const res = (await chrome.runtime.sendMessage({
        type: "STOP_TAB_CAPTURE"
      })) as { success: boolean; reason?: string } | undefined;

      if (!res?.success) {
        throw new Error(res?.reason || "Could not stop tab capture.");
      }
    } catch (err) {
      messageEl.textContent = err instanceof Error ? err.message : "Stop failed";
      messageEl.classList.add("error");
      tabAudioButton.disabled = false;
    }
    return;
  }

  // START
  tabAudioButton.disabled = true;
  messageEl.textContent = "Starting tab audio capture...";

  try {
    const res = (await chrome.runtime.sendMessage({
      type: "START_TAB_CAPTURE",
      targetLanguage: languageSelect.value
    })) as { success: boolean; reason?: string } | undefined;

    if (!res?.success) {
      throw new Error(res?.reason || "Failed to start tab audio capture.");
    }
  } catch (err) {
    messageEl.textContent = err instanceof Error ? err.message : "Start failed";
    messageEl.classList.add("error");
    tabAudioButton.disabled = false;
  }
});

// --------------------------------------------------
// MEETING CAPTURE CONTROLS
// --------------------------------------------------

startMeetingButton.addEventListener("click", async () => {
  startMeetingButton.disabled = true;
  meetingMessage.textContent = "Starting meeting audio capture...";
  meetingMessage.classList.remove("error");

  try {
    const res = (await chrome.runtime.sendMessage({
      type: "START_MEETING_CAPTURE",
      targetLanguage: languageSelect.value,
      meetingTitle: meetingTitleInput.value
    })) as { success: boolean; reason?: string } | undefined;

    if (!res?.success) {
      const reason = res?.reason || "Failed to start meeting capture.";
      if (
        reason.toLowerCase().includes("permission") ||
        reason.toLowerCase().includes("notallowederror") ||
        reason.toLowerCase().includes("denied")
      ) {
        await chrome.tabs.create({ url: "permission.html" });
        throw new Error("Please grant microphone permission in the opened tab.");
      }
      throw new Error(reason);
    }
  } catch (err) {
    meetingMessage.textContent = err instanceof Error ? err.message : "Meeting start failed";
    meetingMessage.classList.add("error");
    startMeetingButton.disabled = false;
  }
});

pauseMeetingButton.addEventListener("click", async () => {
  pauseMeetingButton.disabled = true;
  try {
    if (currentSession.isPaused) {
      await chrome.runtime.sendMessage({ type: "RESUME_MEETING_CAPTURE" });
    } else {
      await chrome.runtime.sendMessage({ type: "PAUSE_MEETING_CAPTURE" });
    }
  } catch (err) {
    console.error("Pause/resume error:", err);
  } finally {
    pauseMeetingButton.disabled = false;
  }
});

stopMeetingButton.addEventListener("click", async () => {
  stopMeetingButton.disabled = true;
  pauseMeetingButton.disabled = true;
  meetingMessage.textContent = "Stopping capture and preparing audio for AI...";
  meetingMessage.classList.remove("error");

  try {
    const res = (await chrome.runtime.sendMessage({
      type: "STOP_MEETING_CAPTURE"
    })) as { success: boolean; reason?: string } | undefined;

    if (!res?.success) {
      throw new Error(res?.reason || "Could not stop meeting capture.");
    }
  } catch (err) {
    meetingMessage.textContent = err instanceof Error ? err.message : "Stop failed";
    meetingMessage.classList.add("error");
    stopMeetingButton.disabled = false;
    pauseMeetingButton.disabled = false;
  }
});

openMeetingLink.addEventListener("click", (e) => {
  e.preventDefault();
  const url =
    currentSession.meetingLink ||
    (currentSession.meetingId ? `http://localhost:5173/#/meetings/${currentSession.meetingId}` : "http://localhost:5173/#/meetings");
  chrome.tabs.create({ url });
});

meetingResetBtn.addEventListener("click", async () => {
  try {
    await chrome.runtime.sendMessage({ type: "RESET_SESSION" });
    meetingTitleInput.value = "";
    meetingCompletedCard.classList.add("hidden");
    meetingIdleControls.classList.remove("hidden");
  } catch (err) {
    console.error("Reset meeting error:", err);
  }
});

// --------------------------------------------------
// INSERT TEXT ACTION
// --------------------------------------------------

insertButton.addEventListener("click", async () => {
  if (!currentSession.finalText) return;

  insertButton.disabled = true;
  messageEl.textContent = "Inserting text into active field...";
  messageEl.classList.remove("error");

  try {
    const res = (await chrome.runtime.sendMessage({
      type: "INSERT_TEXT",
      text: currentSession.finalText
    })) as { success: boolean; reason?: string } | undefined;

    if (res?.success) {
      messageEl.textContent = "Text inserted successfully ✓";
    } else {
      messageEl.textContent =
        res?.reason || "Could not insert text. Ensure a text field is focused.";
      messageEl.classList.add("error");
    }
  } catch (err) {
    messageEl.textContent = err instanceof Error ? err.message : "Insertion error";
    messageEl.classList.add("error");
  } finally {
    insertButton.disabled = false;
  }
});

// --------------------------------------------------
// COPY ACTION
// --------------------------------------------------

copyButton.addEventListener("click", async () => {
  if (!currentSession.finalText) return;

  try {
    await navigator.clipboard.writeText(currentSession.finalText);
    const originalText = copyButton.textContent;
    copyButton.textContent = "✓ Copied";
    setTimeout(() => {
      copyButton.textContent = originalText;
    }, 1500);
  } catch (err) {
    console.error("Clipboard copy error:", err);
  }
});

// --------------------------------------------------
// RESET ACTION
// --------------------------------------------------

resetButton.addEventListener("click", async () => {
  try {
    await chrome.runtime.sendMessage({ type: "RESET_SESSION" });
  } catch (err) {
    console.error("Reset error:", err);
  }
});

// --------------------------------------------------
// INITIALIZATION
// --------------------------------------------------

populateLanguageSelector();
void syncState();