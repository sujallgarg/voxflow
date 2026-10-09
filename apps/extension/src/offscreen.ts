console.log("VoxFlow: Offscreen audio document loaded.");

interface OffscreenStartTabMessage {
  target: "offscreen";
  type: "OFFSCREEN_START_TAB";
  streamId: string;
  sessionId: string;
}

interface OffscreenStopTabMessage {
  target: "offscreen";
  type: "OFFSCREEN_STOP_TAB";
}

interface OffscreenStartMicMessage {
  target: "offscreen";
  type: "OFFSCREEN_START_MIC";
  sessionId: string;
}

interface OffscreenStopMicMessage {
  target: "offscreen";
  type: "OFFSCREEN_STOP_MIC";
}

interface OffscreenGetStateMessage {
  target: "offscreen";
  type: "OFFSCREEN_GET_STATE";
}

type OffscreenCommand =
  | OffscreenStartTabMessage
  | OffscreenStopTabMessage
  | OffscreenStartMicMessage
  | OffscreenStopMicMessage
  | OffscreenGetStateMessage;

type CaptureMode = "none" | "tab" | "mic";

let captureMode: CaptureMode = "none";
let currentSessionId = "";
let mediaRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;

let audioChunks: Blob[] = [];
let isFinishing = false;

// --------------------------------------------------
// MESSAGE DISPATCHER (Strictly filters for offscreen)
// --------------------------------------------------

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!message || typeof message !== "object") {
      return false;
    }

    const cmd = message as Partial<OffscreenCommand>;
    if (cmd.target !== "offscreen") {
      // Ignore messages intended for background or popup
      return false;
    }

    // 1. Tab Capture Start
    if (cmd.type === "OFFSCREEN_START_TAB" && cmd.streamId) {
      const sessionId = cmd.sessionId || Date.now().toString();
      void startTabCapture(cmd.streamId, sessionId).then((res) => {
        sendResponse(res);
      });
      return true;
    }

    // 2. Tab Capture Stop
    if (cmd.type === "OFFSCREEN_STOP_TAB") {
      stopCapture();
      sendResponse({ success: true });
      return true;
    }

    // 3. Microphone Start
    if (cmd.type === "OFFSCREEN_START_MIC") {
      const sessionId = cmd.sessionId || Date.now().toString();
      void startMicRecording(sessionId).then((res) => {
        sendResponse(res);
      });
      return true;
    }

    // 4. Microphone Stop
    if (cmd.type === "OFFSCREEN_STOP_MIC") {
      stopCapture();
      sendResponse({ success: true });
      return true;
    }

    // 5. Query State
    if (cmd.type === "OFFSCREEN_GET_STATE") {
      sendResponse({
        isCapturing: captureMode !== "none",
        captureMode,
        sessionId: currentSessionId,
        isFinishing
      });
      return true;
    }

    return false;
  }
);

// --------------------------------------------------
// TAB AUDIO CAPTURE
// --------------------------------------------------

async function startTabCapture(
  streamId: string,
  sessionId: string
): Promise<{ success: boolean; reason?: string }> {
  if (captureMode !== "none") {
    console.warn("VoxFlow: capture already active in mode:", captureMode);
    return {
      success: false,
      reason: `Another recording is already active (${captureMode}).`
    };
  }

  try {
    console.log("VoxFlow: initializing tab audio capture, streamId:", streamId);
    audioChunks = [];
    isFinishing = false;
    currentSessionId = sessionId;

    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId
        }
      },
      video: false
    } as MediaStreamConstraints);

    const tracks = mediaStream.getAudioTracks();
    if (tracks.length === 0) {
      throw new Error("No audio tracks found in captured tab.");
    }

    audioContext = new AudioContext();
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const source = audioContext.createMediaStreamSource(mediaStream);
    const recordingDestination = audioContext.createMediaStreamDestination();

    // Route 1: Keep tab audio playing through user speakers
    source.connect(audioContext.destination);
    // Route 2: Feed same stream to MediaRecorder
    source.connect(recordingDestination);

    const mimeType = getSupportedMimeType();
    mediaRecorder = mimeType
      ? new MediaRecorder(recordingDestination.stream, { mimeType })
      : new MediaRecorder(recordingDestination.stream);

    setupMediaRecorderListeners("tab");

    mediaRecorder.start(250);
    captureMode = "tab";

    console.log("VoxFlow: tab audio recording successfully started.");
    return { success: true };
  } catch (error) {
    console.error("VoxFlow: start tab capture failed:", error);
    cleanup();
    const reason =
      error instanceof Error ? error.message : "Unable to capture tab audio.";
    return { success: false, reason };
  }
}

// --------------------------------------------------
// MICROPHONE RECORDING
// --------------------------------------------------

async function startMicRecording(
  sessionId: string
): Promise<{ success: boolean; reason?: string }> {
  if (captureMode !== "none") {
    console.warn("VoxFlow: capture already active in mode:", captureMode);
    return {
      success: false,
      reason: `Another recording is already active (${captureMode}).`
    };
  }

  try {
    console.log("VoxFlow: initializing microphone recording in offscreen...");
    audioChunks = [];
    isFinishing = false;
    currentSessionId = sessionId;

    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    const tracks = mediaStream.getAudioTracks();
    if (tracks.length === 0) {
      throw new Error("No microphone audio tracks available.");
    }

    const mimeType = getSupportedMimeType();
    mediaRecorder = mimeType
      ? new MediaRecorder(mediaStream, { mimeType })
      : new MediaRecorder(mediaStream);

    setupMediaRecorderListeners("mic");

    mediaRecorder.start(250);
    captureMode = "mic";

    console.log("VoxFlow: microphone recording successfully started.");
    return { success: true };
  } catch (error) {
    console.error("VoxFlow: start mic recording failed:", error);
    cleanup();
    const reason =
      error instanceof Error ? error.message : "Unable to access microphone.";
    return { success: false, reason };
  }
}

// --------------------------------------------------
// MEDIARECORDER EVENT LISTENERS
// --------------------------------------------------

function setupMediaRecorderListeners(mode: "tab" | "mic") {
  if (!mediaRecorder) return;

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  mediaRecorder.onerror = (event) => {
    console.error(`VoxFlow [${mode}] MediaRecorder error:`, event);
    if (!isFinishing) {
      chrome.runtime
        .sendMessage({
          target: "background",
          type: "RECORDING_ERROR",
          sessionId: currentSessionId,
          mode,
          error: "MediaRecorder encountered an error while capturing audio."
        })
        .catch(() => {});
    }
    cleanup();
  };

  mediaRecorder.onstop = () => {
    if (isFinishing) return;
    void finalizeAndSend(mode);
  };
}

// --------------------------------------------------
// STOP CAPTURE
// --------------------------------------------------

function stopCapture() {
  if (captureMode === "none") {
    console.log("VoxFlow: no active capture to stop.");
    cleanup();
    return;
  }

  if (isFinishing) {
    console.log("VoxFlow: capture is already finalizing.");
    return;
  }

  const activeMode = captureMode;
  console.log(`VoxFlow: stopping active ${activeMode} capture...`);

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  } else {
    void finalizeAndSend(activeMode);
  }
}

// --------------------------------------------------
// FINALIZE AUDIO & SEND TO BACKGROUND
// --------------------------------------------------

async function finalizeAndSend(mode: "tab" | "mic") {
  if (isFinishing) return;
  isFinishing = true;

  const sessionId = currentSessionId;

  try {
    console.log(`VoxFlow: finalizing ${mode} recording (session: ${sessionId})...`);

    // Allow any pending dataavailable events to flush
    await new Promise<void>((resolve) => setTimeout(resolve, 200));

    if (audioChunks.length === 0) {
      throw new Error(`No audio data was recorded (${mode}).`);
    }

    const mimeType =
      audioChunks[0]?.type || mediaRecorder?.mimeType || "audio/webm";

    const audioBlob = new Blob(audioChunks, { type: mimeType });
    console.log(`VoxFlow [${mode}] finalized blob size:`, audioBlob.size, "bytes");

    if (audioBlob.size === 0) {
      throw new Error(`Finalized audio recording is empty (${mode}).`);
    }

    const base64 = await blobToBase64(audioBlob);

    const completeMessageType =
      mode === "tab" ? "TAB_CAPTURE_COMPLETE" : "MIC_RECORDING_COMPLETE";

    await chrome.runtime.sendMessage({
      target: "background",
      type: completeMessageType,
      sessionId,
      audioBase64: base64,
      mimeType
    });

    console.log(`VoxFlow: sent ${completeMessageType} to background.`);
  } catch (error) {
    console.error(`VoxFlow: finalize ${mode} failed:`, error);
    const errorMsg =
      error instanceof Error ? error.message : "Failed to finalize audio recording.";

    chrome.runtime
      .sendMessage({
        target: "background",
        type: "RECORDING_ERROR",
        sessionId,
        mode,
        error: errorMsg
      })
      .catch(() => {});
  } finally {
    cleanup();
  }
}

// --------------------------------------------------
// CLEANUP & HELPERS
// --------------------------------------------------

function cleanup() {
  captureMode = "none";
  isFinishing = false;
  currentSessionId = "";

  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {}
    });
  }

  if (audioContext) {
    try {
      void audioContext.close();
    } catch {}
  }

  mediaRecorder = null;
  mediaStream = null;
  audioContext = null;
  audioChunks = [];

  console.log("VoxFlow: offscreen resources cleaned up.");
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unable to serialize audio data to base64."));
        return;
      }
      const commaIndex = result.indexOf(",");
      if (commaIndex === -1) {
        reject(new Error("Malformed base64 audio format."));
        return;
      }
      resolve(result.slice(commaIndex + 1));
    };
    reader.onerror = () => {
      reject(new Error("FileReader failed to convert audio blob."));
    };
    reader.readAsDataURL(blob);
  });
}

function getSupportedMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus"
  ];

  for (const mime of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }

  return "";
}