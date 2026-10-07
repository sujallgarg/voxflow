interface InsertRequest {
  type: "INSERT_TEXT";
  text: string;
}

interface StartTabCaptureRequest {
  type: "START_TAB_CAPTURE";
  targetLanguage?: string;
}

interface StopTabCaptureRequest {
  type: "STOP_TAB_CAPTURE";
}

interface GetTabCaptureStateRequest {
  type: "GET_TAB_CAPTURE_STATE";
}

interface GetLatestTabResultRequest {
  type: "GET_LATEST_TAB_RESULT";
}

interface SetTargetLanguageRequest {
  type: "SET_TARGET_LANGUAGE";
  targetLanguage: string;
}

interface OffscreenCompleteMessage {
  type: "TAB_CAPTURE_COMPLETE";
  audioBase64: string;
  mimeType: string;
}

interface OffscreenStartedMessage {
  type: "TAB_CAPTURE_STARTED";
}

interface OffscreenErrorMessage {
  type: "TAB_CAPTURE_ERROR";
  error: string;
}

interface TabPipelineResult {
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

type BackgroundMessage =
  | InsertRequest
  | StartTabCaptureRequest
  | StopTabCaptureRequest
  | GetTabCaptureStateRequest
  | GetLatestTabResultRequest
  | SetTargetLanguageRequest
  | OffscreenCompleteMessage
  | OffscreenStartedMessage
  | OffscreenErrorMessage;

let capturedTabId: number | null = null;

let captureStarting = false;
let captureStopping = false;

let tabPipelineProcessing = false;

let activeTargetLanguage = "Auto";

let latestTabPipelineResult:
  | TabPipelineResult
  | null = null;

let latestTabPipelineError:
  | string
  | null = null;

console.log(
  "VoxFlow background service worker loaded."
);

// --------------------------------------------------
// OFFSCREEN DOCUMENT
// --------------------------------------------------

async function createOffscreenDocument() {
  const existingContexts =
    await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"]
    });

  if (existingContexts.length > 0) {
    return;
  }

  console.log(
    "VoxFlow: creating offscreen document..."
  );

  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["USER_MEDIA"],
    justification:
      "Capture audio from the current Chrome tab for VoxFlow transcription."
  });

  console.log(
    "VoxFlow: offscreen document created."
  );
}

async function closeOffscreenDocument() {
  try {
    const contexts =
      await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"]
      });

    if (contexts.length > 0) {
      await chrome.offscreen.closeDocument();

      console.log(
        "VoxFlow: offscreen document closed."
      );
    }
  } catch (error) {
    console.error(
      "VoxFlow offscreen cleanup error:",
      error
    );
  }
}

// --------------------------------------------------
// INSERT TEXT
// --------------------------------------------------

async function handleInsertText(
  message: InsertRequest,
  sendResponse: (
    response: {
      success: boolean;
      reason?: string;
    }
  ) => void
) {
  try {
    const tabs =
      await chrome.tabs.query({
        active: true,
        currentWindow: true
      });

    const activeTab = tabs[0];

    if (!activeTab?.id) {
      sendResponse({
        success: false,
        reason: "No active tab found."
      });

      return;
    }

    const response =
      await chrome.tabs.sendMessage(
        activeTab.id,
        message
      );

    sendResponse(
      response ?? {
        success: false,
        reason:
          "No response from content script."
      }
    );
  } catch (error) {
    console.error(
      "VoxFlow insertion error:",
      error
    );

    sendResponse({
      success: false,
      reason:
        "Could not communicate with the active page."
    });
  }
}

// --------------------------------------------------
// START TAB CAPTURE
// --------------------------------------------------

async function handleStartTabCapture(
  targetLanguage: string | undefined,
  sendResponse: (
    response: {
      success: boolean;
      reason?: string;
    }
  ) => void
) {
  if (captureStarting) {
    sendResponse({
      success: false,
      reason:
        "Tab capture is already starting."
    });

    return;
  }

  if (capturedTabId !== null) {
    sendResponse({
      success: false,
      reason:
        "Tab audio is already being captured."
    });

    return;
  }

  if (tabPipelineProcessing) {
    sendResponse({
      success: false,
      reason:
        "VoxFlow is still processing the previous audio."
    });

    return;
  }

  captureStarting = true;

  activeTargetLanguage =
    targetLanguage || "Auto";

  latestTabPipelineResult = null;
  latestTabPipelineError = null;

  console.log(
    "VoxFlow: target language:",
    activeTargetLanguage
  );

  try {
    console.log(
      "VoxFlow: START_TAB_CAPTURE received."
    );

    const tabs =
      await chrome.tabs.query({
        active: true,
        currentWindow: true
      });

    const activeTab = tabs[0];

    if (!activeTab?.id) {
      sendResponse({
        success: false,
        reason: "No active tab found."
      });

      return;
    }

    console.log(
      "VoxFlow: active tab:",
      activeTab.id,
      activeTab.url
    );

    await createOffscreenDocument();

    console.log(
      "VoxFlow: requesting tab stream ID..."
    );

    const streamId =
      await chrome.tabCapture.getMediaStreamId({
        targetTabId: activeTab.id
      });

    console.log(
      "VoxFlow: stream ID received."
    );

    capturedTabId = activeTab.id;

    await chrome.runtime.sendMessage({
      type: "START_TAB_CAPTURE",
      streamId
    });

    console.log(
      "VoxFlow: stream ID sent to offscreen."
    );

    sendResponse({
      success: true
    });
  } catch (error) {
    capturedTabId = null;

    console.error(
      "VoxFlow: tab capture error:",
      error
    );

    await closeOffscreenDocument();

    sendResponse({
      success: false,
      reason:
        error instanceof Error
          ? error.message
          : "Unable to start tab audio capture."
    });
  } finally {
    captureStarting = false;
  }
}

// --------------------------------------------------
// STOP TAB CAPTURE
// --------------------------------------------------

async function handleStopTabCapture(
  sendResponse: (
    response: {
      success: boolean;
      reason?: string;
    }
  ) => void
) {
  if (captureStopping) {
    sendResponse({
      success: false,
      reason:
        "Tab capture is already stopping."
    });

    return;
  }

  captureStopping = true;

  try {
    console.log(
      "VoxFlow: STOP_TAB_CAPTURE received."
    );

    await chrome.runtime.sendMessage({
      type: "STOP_TAB_CAPTURE"
    });

    capturedTabId = null;

    sendResponse({
      success: true
    });

    /*
     * IMPORTANT:
     *
     * Do NOT close the offscreen document here.
     *
     * The offscreen document still needs to finish
     * creating the audio blob and send
     * TAB_CAPTURE_COMPLETE.
     */
  } catch (error) {
    console.error(
      "VoxFlow stop tab capture error:",
      error
    );

    capturedTabId = null;

    await closeOffscreenDocument();

    sendResponse({
      success: false,
      reason:
        error instanceof Error
          ? error.message
          : "Unable to stop tab audio capture."
    });
  } finally {
    captureStopping = false;
  }
}

// --------------------------------------------------
// BASE64 → BLOB
// --------------------------------------------------

function base64ToBlob(
  base64: string,
  mimeType: string
): Blob {
  const binaryString = atob(base64);

  const bytes =
    new Uint8Array(
      binaryString.length
    );

  for (
    let index = 0;
    index < binaryString.length;
    index++
  ) {
    bytes[index] =
      binaryString.charCodeAt(index);
  }

  return new Blob(
    [bytes],
    {
      type: mimeType
    }
  );
}

// --------------------------------------------------
// TRANSCRIBE CAPTURED AUDIO
// --------------------------------------------------

async function transcribeCapturedAudio(
  audioBase64: string,
  mimeType: string
) {
  console.log(
    "VoxFlow: converting captured audio..."
  );

  const audioBlob =
    base64ToBlob(
      audioBase64,
      mimeType
    );

  console.log(
    "VoxFlow: audio blob size:",
    audioBlob.size
  );

  if (audioBlob.size === 0) {
    throw new Error(
      "Captured audio blob is empty."
    );
  }

  const formData =
    new FormData();

  formData.append(
    "file",
    audioBlob,
    "tab-audio.webm"
  );

  console.log(
    "VoxFlow: sending audio to /transcribe..."
  );

  const response =
    await fetch(
      "http://localhost:3001/transcribe",
      {
        method: "POST",
        body: formData
      }
    );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `Transcription failed (${response.status}): ${errorText}`
    );
  }

  const result =
    await response.json();

  console.log(
    "VoxFlow: transcription result:",
    JSON.stringify(
      result,
      null,
      2
    )
  );

  const transcript =
    result?.text?.trim();

  if (!transcript) {
    throw new Error(
      "Transcription returned empty text."
    );
  }

  console.log(
    "VoxFlow: transcript:",
    transcript
  );

  return {
    transcript
  };
}

// --------------------------------------------------
// FULL AI PIPELINE
// --------------------------------------------------

async function runTabPipeline(
  audioBase64: string,
  mimeType: string
): Promise<TabPipelineResult> {
  tabPipelineProcessing = true;

  try {
    // ----------------------------------------------
    // TRANSCRIPTION
    // ----------------------------------------------

    const transcription =
      await transcribeCapturedAudio(
        audioBase64,
        mimeType
      );

    const {
      transcript
    } = transcription;

    // ----------------------------------------------
    // LANGUAGE DETECTION
    // ----------------------------------------------

    console.log(
      "VoxFlow: detecting language..."
    );

    const languageResponse =
      await fetch(
        "http://localhost:3001/detect-language",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            transcript
          })
        }
      );

    if (!languageResponse.ok) {
      const errorText =
        await languageResponse.text();

      throw new Error(
        `Language detection failed (${languageResponse.status}): ${errorText}`
      );
    }

    const language =
      await languageResponse.json();

    console.log(
      "VoxFlow: language result:",
      JSON.stringify(
        language,
        null,
        2
      )
    );

    // ----------------------------------------------
    // UNDERSTANDING
    // ----------------------------------------------

    console.log(
      "VoxFlow: understanding transcript..."
    );

    const understandingResponse =
      await fetch(
        "http://localhost:3001/understand",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            transcript
          })
        }
      );

    if (!understandingResponse.ok) {
      const errorText =
        await understandingResponse.text();

      throw new Error(
        `Understanding failed (${understandingResponse.status}): ${errorText}`
      );
    }

    const understanding =
      await understandingResponse.json();

    console.log(
      "VoxFlow: understanding result:",
      JSON.stringify(
        understanding,
        null,
        2
      )
    );

    // ----------------------------------------------
    // CONTEXT
    // ----------------------------------------------

    console.log(
      "VoxFlow: detecting context..."
    );

    const contextResponse =
      await fetch(
        "http://localhost:3001/detect-context",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            transcript
          })
        }
      );

    if (!contextResponse.ok) {
      const errorText =
        await contextResponse.text();

      throw new Error(
        `Context detection failed (${contextResponse.status}): ${errorText}`
      );
    }

    const context =
      await contextResponse.json();

    console.log(
      "VoxFlow: context result:",
      JSON.stringify(
        context,
        null,
        2
      )
    );

    // ----------------------------------------------
    // TRANSFORMATION
    // ----------------------------------------------

    console.log(
      "VoxFlow: transforming transcript..."
    );

    const transformationResponse =
      await fetch(
        "http://localhost:3001/transform",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            transcript,

            meaning:
              understanding.meaning,

            intent:
              understanding.intent,

            audience:
              context.audience,

            communicationType:
              context.communicationType,

            tone:
              context.tone,

            formality:
              context.formality,

            likelyChannel:
              context.likelyChannel,

            purpose:
              context.purpose,

            targetLanguage:
              activeTargetLanguage ===
              "Auto"
                ? undefined
                : activeTargetLanguage
          })
        }
      );

    if (!transformationResponse.ok) {
      const errorText =
        await transformationResponse.text();

      throw new Error(
        `Transformation failed (${transformationResponse.status}): ${errorText}`
      );
    }

    const transformation =
      await transformationResponse.json();

    console.log(
      "VoxFlow: transformation result:",
      JSON.stringify(
        transformation,
        null,
        2
      )
    );

    console.log(
      "----------------------------------------"
    );

    console.log(
      "VoxFlow: FINAL TEXT:",
      transformation.finalText
    );

    console.log(
      "----------------------------------------"
    );

    return {
      transcript,
      language,
      understanding,
      context,
      transformation
    };
  } finally {
    tabPipelineProcessing = false;
  }
}

// --------------------------------------------------
// SEND RESULT TO POPUP SAFELY
// --------------------------------------------------

async function sendPipelineResultToPopup(
  result: TabPipelineResult
) {
  try {
    await chrome.runtime.sendMessage({
      type: "TAB_PIPELINE_COMPLETE",
      result
    });
  } catch {
    /*
     * Popup may be closed.
     *
     * This is NOT an error anymore because
     * the result is already stored in
     * latestTabPipelineResult.
     */
    console.log(
      "VoxFlow: popup is closed. Result saved."
    );
  }
}

async function sendPipelineErrorToPopup(
  error: string
) {
  try {
    await chrome.runtime.sendMessage({
      type: "TAB_PIPELINE_ERROR",
      error
    });
  } catch {
    console.log(
      "VoxFlow: popup is closed. Error saved."
    );
  }
}

// --------------------------------------------------
// MESSAGE HANDLER
// --------------------------------------------------

chrome.runtime.onMessage.addListener(
  (
    message: BackgroundMessage,
    _sender,
    sendResponse
  ) => {
    // ----------------------------------------------
    // INSERT TEXT
    // ----------------------------------------------

    if (
      message.type ===
      "INSERT_TEXT"
    ) {
      void handleInsertText(
        message,
        sendResponse
      );

      return true;
    }

    // ----------------------------------------------
    // START TAB CAPTURE
    // ----------------------------------------------

    if (
      message.type ===
      "START_TAB_CAPTURE"
    ) {
      void handleStartTabCapture(
        message.targetLanguage,
        sendResponse
      );

      return true;
    }

    // ----------------------------------------------
    // STOP TAB CAPTURE
    // ----------------------------------------------

    if (
      message.type ===
      "STOP_TAB_CAPTURE"
    ) {
      void handleStopTabCapture(
        sendResponse
      );

      return true;
    }

    // ----------------------------------------------
    // GET CAPTURE STATE
    // ----------------------------------------------

    if (
      message.type ===
      "GET_TAB_CAPTURE_STATE"
    ) {
      sendResponse({
        isCapturing:
          capturedTabId !== null,

        isProcessing:
          tabPipelineProcessing,

        targetLanguage:
          activeTargetLanguage
      });

      return true;
    }

    // ----------------------------------------------
    // GET LATEST RESULT
    // ----------------------------------------------

    if (
      message.type ===
      "GET_LATEST_TAB_RESULT"
    ) {
      sendResponse({
        result:
          latestTabPipelineResult,

        error:
          latestTabPipelineError,

        isCapturing:
          capturedTabId !== null,

        isProcessing:
          tabPipelineProcessing,

        targetLanguage:
          activeTargetLanguage
      });

      return true;
    }

    // ----------------------------------------------
    // SET TARGET LANGUAGE
    // ----------------------------------------------

    if (
      message.type ===
      "SET_TARGET_LANGUAGE"
    ) {
      activeTargetLanguage =
        message.targetLanguage ||
        "Auto";

      console.log(
        "VoxFlow: target language changed:",
        activeTargetLanguage
      );

      sendResponse({
        success: true,
        targetLanguage:
          activeTargetLanguage
      });

      return true;
    }

    // ----------------------------------------------
    // OFFSCREEN CAPTURE STARTED
    // ----------------------------------------------

    if (
      message.type ===
      "TAB_CAPTURE_STARTED"
    ) {
      console.log(
        "VoxFlow: OFFSCREEN → capture started."
      );

      return false;
    }

    // ----------------------------------------------
    // OFFSCREEN CAPTURE COMPLETE
    // ----------------------------------------------

    if (
      message.type ===
      "TAB_CAPTURE_COMPLETE"
    ) {
      console.log(
        "VoxFlow: OFFSCREEN → capture complete."
      );

      console.log(
        "VoxFlow: base64 audio length:",
        message.audioBase64?.length
      );

      console.log(
        "VoxFlow: captured audio type:",
        message.mimeType
      );

      /*
       * The capture itself is finished.
       * Now the AI pipeline starts.
       */
      capturedTabId = null;

      void runTabPipeline(
        message.audioBase64,
        message.mimeType
      )
        .then(async (result) => {
          latestTabPipelineResult =
            result;

          latestTabPipelineError =
            null;

          console.log(
            "VoxFlow: complete AI pipeline result:",
            JSON.stringify(
              result,
              null,
              2
            )
          );

          await sendPipelineResultToPopup(
            result
          );

          await closeOffscreenDocument();
        })
        .catch(async (error) => {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "VoxFlow AI pipeline failed.";

          latestTabPipelineResult =
            null;

          latestTabPipelineError =
            errorMessage;

          tabPipelineProcessing =
            false;

          console.error(
            "VoxFlow: tab pipeline error:",
            error
          );

          await sendPipelineErrorToPopup(
            errorMessage
          );

          await closeOffscreenDocument();
        });

      return false;
    }

    // ----------------------------------------------
    // OFFSCREEN ERROR
    // ----------------------------------------------

    if (
      message.type ===
      "TAB_CAPTURE_ERROR"
    ) {
      console.error(
        "VoxFlow: OFFSCREEN → capture error:",
        message.error
      );

      capturedTabId = null;

      latestTabPipelineError =
        message.error;

      tabPipelineProcessing =
        false;

      void closeOffscreenDocument();

      return false;
    }

    return false;
  }
);

// --------------------------------------------------
// TAB CLOSED
// --------------------------------------------------

chrome.tabs.onRemoved.addListener(
  (tabId) => {
    if (
      tabId === capturedTabId
    ) {
      capturedTabId = null;

      console.log(
        "VoxFlow: captured tab closed."
      );
    }
  }
);