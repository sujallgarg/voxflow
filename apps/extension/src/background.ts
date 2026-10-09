console.log("VoxFlow background service worker loaded.");

const API_BASE_URL = "http://localhost:3001";
const STORAGE_KEY_SESSION = "voxflow_session_state";
const STORAGE_KEY_TARGET_LANG = "voxflow_target_language";

interface PipelineResult {
  transcript: string;
  language: unknown;
  understanding: unknown;
  context: unknown;
  transformation: {
    finalText: string;
    targetLanguage: string;
    transformation: string;
  };
}

interface SessionState {
  sessionId: string;
  mode: "idle" | "recording_mic" | "capturing_tab" | "processing";
  step:
    | "idle"
    | "recording"
    | "finalizing"
    | "transcribing"
    | "detecting_language"
    | "understanding"
    | "detecting_context"
    | "transforming"
    | "ready"
    | "error";
  targetLanguage: string;
  targetTabId?: number | null;
  transcript?: string;
  finalText?: string;
  error?: string | null;
  startedAt?: number;
  completedAt?: number;
}

let currentSession: SessionState = {
  sessionId: "init",
  mode: "idle",
  step: "idle",
  targetLanguage: "Auto",
  transcript: "",
  finalText: "",
  error: null
};

let capturedTabId: number | null = null;
let isStartingCapture = false;
let isStoppingCapture = false;

// --------------------------------------------------
// STORAGE & SESSION INITIALIZATION
// --------------------------------------------------

let sessionInitPromise: Promise<void> | null = null;

async function initSessionFromStorage(): Promise<void> {
  try {
    // Enable session storage access across extension contexts if available
    if ("session" in chrome.storage && chrome.storage.session.setAccessLevel) {
      chrome.storage.session
        .setAccessLevel({
          accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS"
        })
        .catch(() => {});
    }

    const data = await chrome.storage.local.get([
      STORAGE_KEY_SESSION,
      STORAGE_KEY_TARGET_LANG
    ]);

    const savedTargetLang = (data[STORAGE_KEY_TARGET_LANG] as string) || "Auto";

    if (data[STORAGE_KEY_SESSION]) {
      currentSession = data[STORAGE_KEY_SESSION] as SessionState;

      // If SW resumed while it thought recording was active, verify offscreen
      if (
        currentSession.mode === "recording_mic" ||
        currentSession.mode === "capturing_tab"
      ) {
        const offscreenAlive = await checkOffscreenState();
        if (!offscreenAlive.isCapturing) {
          console.log("Offscreen inactive on service worker resume. Resetting recording state.");
          currentSession.mode = "idle";
          currentSession.step = "idle";
          await persistSession();
        }
      }
    } else {
      currentSession = {
        sessionId: Date.now().toString(),
        mode: "idle",
        step: "idle",
        targetLanguage: savedTargetLang,
        transcript: "",
        finalText: "",
        error: null
      };
      await persistSession();
    }
  } catch (err) {
    console.error("VoxFlow: failed to load session from storage:", err);
  }
}

function ensureSessionLoaded(): Promise<void> {
  if (!sessionInitPromise) {
    sessionInitPromise = initSessionFromStorage();
  }
  return sessionInitPromise;
}

async function persistSession(): Promise<void> {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEY_SESSION]: currentSession,
      [STORAGE_KEY_TARGET_LANG]: currentSession.targetLanguage
    });
    // Mirror to session storage if supported
    if ("session" in chrome.storage) {
      chrome.storage.session
        .set({
          [STORAGE_KEY_SESSION]: currentSession
        })
        .catch(() => {});
    }
  } catch (err) {
    console.error("VoxFlow: failed to persist session:", err);
  }
}

void ensureSessionLoaded();

// --------------------------------------------------
// OFFSCREEN DOCUMENT MANAGEMENT
// --------------------------------------------------

async function hasOffscreenDocument(): Promise<boolean> {
  try {
    if ("getContexts" in chrome.runtime && typeof chrome.runtime.getContexts === "function") {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"]
      });
      return contexts.length > 0;
    }
  } catch {}

  try {
    const res = (await chrome.runtime.sendMessage({
      target: "offscreen",
      type: "OFFSCREEN_GET_STATE"
    })) as { isCapturing?: boolean } | undefined;
    return Boolean(res);
  } catch {
    return false;
  }
}

async function createOffscreenDocument(): Promise<void> {
  const exists = await hasOffscreenDocument();
  if (exists) {
    return;
  }

  console.log("VoxFlow: creating offscreen audio document...");
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["USER_MEDIA"],
    justification: "Capture microphone and tab audio for VoxFlow speech transcription."
  });

  // Brief initialization delay
  await new Promise<void>((resolve) => setTimeout(resolve, 150));
  console.log("VoxFlow: offscreen document created and ready.");
}

async function closeOffscreenDocument(): Promise<void> {
  try {
    const exists = await hasOffscreenDocument();
    if (exists) {
      await chrome.offscreen.closeDocument();
      console.log("VoxFlow: offscreen document closed.");
    }
  } catch (error) {
    console.warn("VoxFlow offscreen cleanup notice:", error);
  }
}

async function checkOffscreenState(): Promise<{ isCapturing: boolean; captureMode?: string }> {
  try {
    const exists = await hasOffscreenDocument();
    if (!exists) {
      return { isCapturing: false };
    }

    const state = (await chrome.runtime.sendMessage({
      target: "offscreen",
      type: "OFFSCREEN_GET_STATE"
    })) as { isCapturing: boolean; captureMode?: string } | undefined;

    return {
      isCapturing: Boolean(state?.isCapturing),
      captureMode: state?.captureMode
    };
  } catch {
    return { isCapturing: false };
  }
}

// --------------------------------------------------
// TEXT INSERTION WITH SCRIPT INJECTION RETRY
// --------------------------------------------------

async function handleInsertText(
  text: string,
  sendResponse: (res: { success: boolean; reason?: string }) => void
) {
  try {
    let targetTab: chrome.tabs.Tab | undefined;

    if (currentSession.targetTabId) {
      try {
        const tab = await chrome.tabs.get(currentSession.targetTabId);
        if (tab?.id) targetTab = tab;
      } catch {
        targetTab = undefined;
      }
    }

    if (!targetTab) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      targetTab = tabs[0];
      if (!targetTab?.id) {
        const fallbackTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        targetTab = fallbackTabs[0];
      }
    }

    if (!targetTab?.id) {
      sendResponse({ success: false, reason: "No active browser tab found to insert text into." });
      return;
    }

    const tabId = targetTab.id;

    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: "INSERT_TEXT",
        text
      });

      if (response && response.success) {
        sendResponse(response);
        return;
      }

      if (response && response.reason) {
        sendResponse(response);
        return;
      }
    } catch {
      // Content script not ready; attempt injection fallback
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"]
      });

      await new Promise((r) => setTimeout(r, 120));

      const retryResponse = await chrome.tabs.sendMessage(tabId, {
        type: "INSERT_TEXT",
        text
      });

      sendResponse(retryResponse ?? { success: false, reason: "No response from text field handler." });
    } catch (injectErr) {
      console.error("Script injection insertion error:", injectErr);
      sendResponse({
        success: false,
        reason: "Could not insert text into this webpage (restricted page or iframe)."
      });
    }
  } catch (error) {
    console.error("VoxFlow insertion error:", error);
    sendResponse({
      success: false,
      reason: error instanceof Error ? error.message : "Text insertion failed."
    });
  }
}

// --------------------------------------------------
// START MICROPHONE RECORDING
// --------------------------------------------------

async function handleStartMicRecording(
  targetLanguage: string | undefined,
  sendResponse: (res: { success: boolean; reason?: string; sessionId?: string }) => void
) {
  await ensureSessionLoaded();

  if (isStartingCapture) {
    sendResponse({ success: false, reason: "Recording is already starting." });
    return;
  }

  if (currentSession.mode === "recording_mic") {
    sendResponse({ success: false, reason: "Microphone recording is already active." });
    return;
  }

  if (currentSession.mode === "capturing_tab") {
    sendResponse({ success: false, reason: "Tab audio capture is currently active. Stop it first." });
    return;
  }

  if (currentSession.mode === "processing") {
    sendResponse({ success: false, reason: "Previous audio is still being processed." });
    return;
  }

  isStartingCapture = true;

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0] ?? (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];

    await createOffscreenDocument();

    const newSessionId = Date.now().toString();

    const response = (await chrome.runtime.sendMessage({
      target: "offscreen",
      type: "OFFSCREEN_START_MIC",
      sessionId: newSessionId
    })) as { success: boolean; reason?: string } | undefined;

    if (!response?.success) {
      throw new Error(response?.reason || "Failed to start microphone in extension context.");
    }

    currentSession = {
      sessionId: newSessionId,
      mode: "recording_mic",
      step: "recording",
      targetLanguage: targetLanguage || currentSession.targetLanguage || "Auto",
      targetTabId: activeTab?.id ?? null,
      transcript: "",
      finalText: "",
      error: null,
      startedAt: Date.now()
    };

    await persistSession();
    sendResponse({ success: true, sessionId: newSessionId });
  } catch (error) {
    console.error("VoxFlow: start mic error:", error);
    const reason = error instanceof Error ? error.message : "Unable to start microphone recording.";
    currentSession.mode = "idle";
    currentSession.step = "error";
    currentSession.error = reason;
    await persistSession();
    await closeOffscreenDocument();
    sendResponse({ success: false, reason });
  } finally {
    isStartingCapture = false;
  }
}

// --------------------------------------------------
// STOP MICROPHONE RECORDING
// --------------------------------------------------

async function handleStopMicRecording(
  sendResponse: (res: { success: boolean; reason?: string }) => void
) {
  await ensureSessionLoaded();

  if (isStoppingCapture) {
    sendResponse({ success: false, reason: "Recording is already stopping." });
    return;
  }

  if (currentSession.mode !== "recording_mic") {
    sendResponse({ success: false, reason: "Microphone recording is not active." });
    return;
  }

  isStoppingCapture = true;

  try {
    currentSession.step = "finalizing";
    await persistSession();

    await chrome.runtime.sendMessage({
      target: "offscreen",
      type: "OFFSCREEN_STOP_MIC"
    });

    sendResponse({ success: true });
  } catch (error) {
    console.error("VoxFlow: stop mic error:", error);
    sendResponse({
      success: false,
      reason: error instanceof Error ? error.message : "Unable to stop microphone."
    });
  } finally {
    isStoppingCapture = false;
  }
}

// --------------------------------------------------
// START TAB AUDIO CAPTURE
// --------------------------------------------------

async function handleStartTabCapture(
  targetLanguage: string | undefined,
  sendResponse: (res: { success: boolean; reason?: string; sessionId?: string }) => void
) {
  await ensureSessionLoaded();

  if (isStartingCapture) {
    sendResponse({ success: false, reason: "Tab capture is already starting." });
    return;
  }

  if (currentSession.mode === "capturing_tab") {
    sendResponse({ success: false, reason: "Tab audio capture is already active." });
    return;
  }

  if (currentSession.mode === "recording_mic") {
    sendResponse({ success: false, reason: "Microphone recording is currently active. Stop it first." });
    return;
  }

  if (currentSession.mode === "processing") {
    sendResponse({ success: false, reason: "Previous audio is still being processed." });
    return;
  }

  isStartingCapture = true;

  try {
    let activeTab: chrome.tabs.Tab | undefined;
    const currentTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (currentTabs[0]?.id && !currentTabs[0].url?.startsWith("chrome-extension://")) {
      activeTab = currentTabs[0];
    }
    if (!activeTab) {
      const lastFocusedTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      activeTab = lastFocusedTabs.find((t) => t.id && !t.url?.startsWith("chrome-extension://"));
    }

    if (!activeTab?.id) {
      sendResponse({ success: false, reason: "No active browser tab found to capture audio from." });
      return;
    }

    if (
      activeTab.url?.startsWith("chrome://") ||
      activeTab.url?.startsWith("edge://") ||
      activeTab.url?.startsWith("about:")
    ) {
      sendResponse({
        success: false,
        reason: "Chrome cannot capture audio from internal browser pages (chrome://). Open a normal website like YouTube."
      });
      return;
    }

    await createOffscreenDocument();

    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: activeTab.id
    });

    capturedTabId = activeTab.id;
    const newSessionId = Date.now().toString();

    const response = (await chrome.runtime.sendMessage({
      target: "offscreen",
      type: "OFFSCREEN_START_TAB",
      streamId,
      sessionId: newSessionId
    })) as { success: boolean; reason?: string } | undefined;

    if (!response?.success) {
      throw new Error(response?.reason || "Failed to start tab audio in extension context.");
    }

    currentSession = {
      sessionId: newSessionId,
      mode: "capturing_tab",
      step: "recording",
      targetLanguage: targetLanguage || currentSession.targetLanguage || "Auto",
      targetTabId: activeTab.id,
      transcript: "",
      finalText: "",
      error: null,
      startedAt: Date.now()
    };

    await persistSession();
    sendResponse({ success: true, sessionId: newSessionId });
  } catch (error) {
    console.error("VoxFlow: start tab capture error:", error);
    capturedTabId = null;
    const reason = error instanceof Error ? error.message : "Unable to start tab audio capture.";
    currentSession.mode = "idle";
    currentSession.step = "error";
    currentSession.error = reason;
    await persistSession();
    await closeOffscreenDocument();
    sendResponse({ success: false, reason });
  } finally {
    isStartingCapture = false;
  }
}

// --------------------------------------------------
// STOP TAB AUDIO CAPTURE
// --------------------------------------------------

async function handleStopTabCapture(
  sendResponse: (res: { success: boolean; reason?: string }) => void
) {
  await ensureSessionLoaded();

  if (isStoppingCapture) {
    sendResponse({ success: false, reason: "Tab capture is already stopping." });
    return;
  }

  if (currentSession.mode !== "capturing_tab") {
    sendResponse({ success: false, reason: "Tab capture is not active." });
    return;
  }

  isStoppingCapture = true;

  try {
    currentSession.step = "finalizing";
    await persistSession();

    await chrome.runtime.sendMessage({
      target: "offscreen",
      type: "OFFSCREEN_STOP_TAB"
    });

    capturedTabId = null;
    sendResponse({ success: true });
  } catch (error) {
    console.error("VoxFlow: stop tab capture error:", error);
    capturedTabId = null;
    sendResponse({
      success: false,
      reason: error instanceof Error ? error.message : "Unable to stop tab audio capture."
    });
  } finally {
    isStoppingCapture = false;
  }
}

// --------------------------------------------------
// BASE64 → BLOB
// --------------------------------------------------

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

// --------------------------------------------------
// FULL AI PIPELINE (PRESERVING ALL 5 API STEPS)
// --------------------------------------------------

async function runAiPipeline(
  audioBase64: string,
  mimeType: string,
  forSessionId: string
): Promise<PipelineResult> {
  await ensureSessionLoaded();

  if (currentSession.sessionId !== forSessionId) {
    console.warn("VoxFlow: ignoring audio from older session:", forSessionId, "current:", currentSession.sessionId);
    throw new Error("Session expired.");
  }

  currentSession.mode = "processing";
  currentSession.step = "transcribing";
  currentSession.error = null;
  await persistSession();

  try {
    // 1. Transcription (/transcribe)
    const audioBlob = base64ToBlob(audioBase64, mimeType);
    if (audioBlob.size === 0) {
      throw new Error("Recorded audio is empty.");
    }

    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");

    console.log("VoxFlow: Step 1 → calling /transcribe...");
    const transcribeRes = await fetch(`${API_BASE_URL}/transcribe`, {
      method: "POST",
      body: formData
    });

    if (!transcribeRes.ok) {
      const errText = await transcribeRes.text();
      throw new Error(`Transcription failed (${transcribeRes.status}): ${errText}`);
    }

    const transcribeData = await transcribeRes.json();
    const transcript = transcribeData?.text?.trim();

    if (!transcript) {
      throw new Error("Transcription returned empty text.");
    }

    currentSession.transcript = transcript;
    currentSession.step = "detecting_language";
    await persistSession();

    // 2. Language Detection (/detect-language)
    console.log("VoxFlow: Step 2 → calling /detect-language...");
    const langRes = await fetch(`${API_BASE_URL}/detect-language`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript })
    });

    let languageData: unknown = null;
    if (langRes.ok) {
      languageData = await langRes.json();
    }

    currentSession.step = "understanding";
    await persistSession();

    // 3. Intent Understanding (/understand)
    console.log("VoxFlow: Step 3 → calling /understand...");
    const understandRes = await fetch(`${API_BASE_URL}/understand`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript })
    });

    let understandData: { meaning?: string; intent?: string } = {};
    if (understandRes.ok) {
      understandData = await understandRes.json();
    }

    currentSession.step = "detecting_context";
    await persistSession();

    // 4. Context Detection (/detect-context)
    console.log("VoxFlow: Step 4 → calling /detect-context...");
    const contextRes = await fetch(`${API_BASE_URL}/detect-context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript })
    });

    let contextData: {
      audience?: string;
      communicationType?: string;
      tone?: string;
      formality?: string;
      likelyChannel?: string;
      purpose?: string;
    } = {};

    if (contextRes.ok) {
      contextData = await contextRes.json();
    }

    currentSession.step = "transforming";
    await persistSession();

    // 5. Context-aware Transformation (/transform)
    console.log("VoxFlow: Step 5 → calling /transform...");
    const transformRes = await fetch(`${API_BASE_URL}/transform`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript,
        meaning: understandData.meaning,
        intent: understandData.intent,
        audience: contextData.audience,
        communicationType: contextData.communicationType,
        tone: contextData.tone,
        formality: contextData.formality,
        likelyChannel: contextData.likelyChannel,
        purpose: contextData.purpose,
        targetLanguage:
          currentSession.targetLanguage === "Auto"
            ? undefined
            : currentSession.targetLanguage
      })
    });

    if (!transformRes.ok) {
      const errText = await transformRes.text();
      throw new Error(`Transformation failed (${transformRes.status}): ${errText}`);
    }

    const transformData = (await transformRes.json()) as {
      finalText: string;
      targetLanguage: string;
      transformation: string;
    };

    const finalResult: PipelineResult = {
      transcript,
      language: languageData,
      understanding: understandData,
      context: contextData,
      transformation: transformData
    };

    currentSession.mode = "idle";
    currentSession.step = "ready";
    currentSession.finalText = transformData.finalText;
    currentSession.completedAt = Date.now();
    currentSession.error = null;

    await persistSession();

    return finalResult;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "AI pipeline encountered an error.";
    console.error("VoxFlow pipeline error:", error);
    currentSession.mode = "idle";
    currentSession.step = "error";
    currentSession.error = errorMsg;
    await persistSession();
    throw error;
  } finally {
    void closeOffscreenDocument();
  }
}

// --------------------------------------------------
// CHROME RUNTIME MESSAGE HANDLER
// --------------------------------------------------

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return false;
  }

  const msg = message as Record<string, unknown>;

  // 1. Text Insertion
  if (msg.type === "INSERT_TEXT" && typeof msg.text === "string") {
    void handleInsertText(msg.text, sendResponse);
    return true;
  }

  // 2. Microphone Controls
  if (msg.type === "START_MIC_RECORDING") {
    void handleStartMicRecording(msg.targetLanguage as string | undefined, sendResponse);
    return true;
  }

  if (msg.type === "STOP_MIC_RECORDING") {
    void handleStopMicRecording(sendResponse);
    return true;
  }

  // 3. Tab Audio Controls
  if (msg.type === "START_TAB_CAPTURE") {
    void handleStartTabCapture(msg.targetLanguage as string | undefined, sendResponse);
    return true;
  }

  if (msg.type === "STOP_TAB_CAPTURE") {
    void handleStopTabCapture(sendResponse);
    return true;
  }

  // 4. Session State Query
  if (msg.type === "GET_SESSION_STATE") {
    void ensureSessionLoaded().then(() => {
      sendResponse({ session: currentSession });
    });
    return true;
  }

  // 5. Set Target Language
  if (msg.type === "SET_TARGET_LANGUAGE") {
    void ensureSessionLoaded().then(async () => {
      const lang = (msg.targetLanguage as string) || "Auto";
      currentSession.targetLanguage = lang;
      await persistSession();
      sendResponse({ success: true, targetLanguage: lang });
    });
    return true;
  }

  // 6. Reset / Clear Session
  if (msg.type === "RESET_SESSION" || msg.type === "CANCEL_RECORDING") {
    void ensureSessionLoaded().then(async () => {
      currentSession = {
        sessionId: Date.now().toString(),
        mode: "idle",
        step: "idle",
        targetLanguage: currentSession.targetLanguage,
        transcript: "",
        finalText: "",
        error: null
      };
      capturedTabId = null;
      await persistSession();
      await closeOffscreenDocument();
      sendResponse({ success: true });
    });
    return true;
  }

  // 7. Offscreen Audio Completion
  if (
    msg.type === "TAB_CAPTURE_COMPLETE" ||
    msg.type === "MIC_RECORDING_COMPLETE"
  ) {
    const sessionId = (msg.sessionId as string) || currentSession.sessionId;
    capturedTabId = null;

    void runAiPipeline(
      msg.audioBase64 as string,
      msg.mimeType as string,
      sessionId
    ).catch(() => {});

    return false;
  }

  // 8. Offscreen Error
  if (msg.type === "RECORDING_ERROR") {
    capturedTabId = null;
    currentSession.mode = "idle";
    currentSession.step = "error";
    currentSession.error = (msg.error as string) || "Recording error occurred.";
    void persistSession();
    void closeOffscreenDocument();
    return false;
  }

  return false;
});

// --------------------------------------------------
// TAB CLOSED LISTENER
// --------------------------------------------------

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === capturedTabId && currentSession.mode === "capturing_tab") {
    console.log("VoxFlow: captured tab closed.");
    capturedTabId = null;
    currentSession.mode = "idle";
    currentSession.step = "error";
    currentSession.error = "Captured browser tab was closed.";
    void persistSession();
    void closeOffscreenDocument();
  }
});