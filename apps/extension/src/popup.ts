const API_URL =
  "http://localhost:3001";

// --------------------------------------------------
// DOM
// --------------------------------------------------

const recordButton =
  document.getElementById(
    "record-button"
  ) as HTMLButtonElement;

const recordIcon =
  document.getElementById(
    "record-icon"
  ) as HTMLSpanElement;

const recordText =
  document.getElementById(
    "record-text"
  ) as HTMLSpanElement;

const tabAudioButton =
  document.getElementById(
    "tab-audio-button"
  ) as HTMLButtonElement | null;

const transcriptContainer =
  document.getElementById(
    "transcript-container"
  ) as HTMLDivElement;

const transcriptElement =
  document.getElementById(
    "transcript"
  ) as HTMLDivElement;

const message =
  document.getElementById(
    "message"
  ) as HTMLParagraphElement;

// --------------------------------------------------
// STATE
// --------------------------------------------------

let isRecording = false;
let isProcessing = false;
let isTabCapturing = false;
let isTabProcessing = false;

let targetLanguage = "Auto";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

interface TranscriptionResponse {
  text: string;
}

interface TransformResponse {
  finalText: string;
  targetLanguage: string;
  transformation: string;
}

interface InsertResponse {
  success: boolean;
  reason?: string;
}

interface TabPipelineResult {
  transcript: string;
  language: unknown;
  understanding: unknown;
  context: unknown;
  transformation: TransformResponse;
}

interface LatestTabResultResponse {
  result:
    | TabPipelineResult
    | null;

  error:
    | string
    | null;

  isCapturing: boolean;
  isProcessing: boolean;
  targetLanguage: string;
}

// --------------------------------------------------
// TARGET LANGUAGE UI
// --------------------------------------------------

function createTargetLanguageUI() {
  if (
    document.getElementById(
      "voxflow-target-language-container"
    )
  ) {
    return;
  }

  const container =
    document.createElement("div");

  container.id =
    "voxflow-target-language-container";

  container.style.marginBottom =
    "12px";

  const label =
    document.createElement("label");

  label.textContent =
    "Output language";

  label.style.display =
    "block";

  label.style.marginBottom =
    "6px";

  label.style.fontSize =
    "12px";

  label.style.fontWeight =
    "600";

  const select =
    document.createElement("select");

  select.id =
    "voxflow-target-language";

  select.style.width =
    "100%";

  select.style.padding =
    "8px";

  select.style.borderRadius =
    "8px";

  select.style.border =
    "1px solid #ddd";

  select.style.background =
    "#fff";

  const languages = [
    "Auto",
    "English",
    "Hindi",
    "German",
    "Portuguese",
    "Spanish",
    "French"
  ];

  for (const language of languages) {
    const option =
      document.createElement("option");

    option.value =
      language;

    option.textContent =
      language;

    select.appendChild(option);
  }

  select.value =
    targetLanguage;

  select.addEventListener(
    "change",
    async () => {
      targetLanguage =
        select.value;

      localStorage.setItem(
        "voxflow-target-language",
        targetLanguage
      );

      try {
        await chrome.runtime.sendMessage({
          type: "SET_TARGET_LANGUAGE",
          targetLanguage
        });

        message.textContent =
          `Output language: ${targetLanguage}`;
      } catch (error) {
        console.error(
          "VoxFlow target language error:",
          error
        );
      }
    }
  );

  container.appendChild(label);
  container.appendChild(select);

  const firstElement =
    document.body.firstElementChild;

  if (firstElement) {
    firstElement.prepend(
      container
    );
  } else {
    document.body.prepend(
      container
    );
  }
}

function loadTargetLanguage() {
  const saved =
    localStorage.getItem(
      "voxflow-target-language"
    );

  if (
    saved &&
    [
      "Auto",
      "English",
      "Hindi",
      "German",
      "Portuguese",
      "Spanish",
      "French"
    ].includes(saved)
  ) {
    targetLanguage =
      saved;
  }
}

// --------------------------------------------------
// AI OUTPUT UI
// --------------------------------------------------

function ensureFinalTextUI() {
  if (
    document.getElementById(
      "voxflow-final-text-container"
    )
  ) {
    return;
  }

  const container =
    document.createElement("div");

  container.id =
    "voxflow-final-text-container";

  container.style.marginTop =
    "12px";

  const title =
    document.createElement("div");

  title.textContent =
    "AI Output";

  title.style.fontWeight =
    "600";

  title.style.fontSize =
    "12px";

  title.style.marginBottom =
    "6px";

  const output =
    document.createElement("div");

  output.id =
    "voxflow-final-text";

  output.style.padding =
    "10px";

  output.style.borderRadius =
    "8px";

  output.style.background =
    "#8f5d5dff";

  output.style.whiteSpace =
    "pre-wrap";

  output.style.wordBreak =
    "break-word";

  output.textContent =
    "No output yet.";

  container.appendChild(
    title
  );

  container.appendChild(
    output
  );

  const parent =
    transcriptContainer.parentElement;

  if (parent) {
    parent.appendChild(
      container
    );
  } else {
    document.body.appendChild(
      container
    );
  }
}

function showFinalText(
  text: string
) {
  ensureFinalTextUI();

  const output =
    document.getElementById(
      "voxflow-final-text"
    );

  if (output) {
    output.textContent =
      text;
  }
}

// --------------------------------------------------
// TRANSCRIPT UI
// --------------------------------------------------

function showTranscript(
  transcript: string
) {
  transcriptElement.textContent =
    transcript;

  transcriptContainer.classList.remove(
    "hidden"
  );
}

// --------------------------------------------------
// TAB CAPTURE STATE
// --------------------------------------------------

async function syncTabCaptureState() {
  try {
    const response =
      await chrome.runtime.sendMessage({
        type: "GET_TAB_CAPTURE_STATE"
      });

    if (!response) {
      return;
    }

    isTabCapturing =
      Boolean(
        response.isCapturing
      );

    isTabProcessing =
      Boolean(
        response.isProcessing
      );

    if (
      response.targetLanguage
    ) {
      targetLanguage =
        response.targetLanguage;

      localStorage.setItem(
        "voxflow-target-language",
        targetLanguage
      );

      const select =
        document.getElementById(
          "voxflow-target-language"
        ) as HTMLSelectElement | null;

      if (select) {
        select.value =
          targetLanguage;
      }
    }

    updateTabButton();
  } catch (error) {
    console.error(
      "VoxFlow state sync error:",
      error
    );
  }
}

function updateTabButton() {
  if (!tabAudioButton) {
    return;
  }

  if (isTabProcessing) {
    tabAudioButton.disabled =
      true;

    tabAudioButton.textContent =
      "⏳ Processing...";

    return;
  }

  if (isTabCapturing) {
    tabAudioButton.disabled =
      false;

    tabAudioButton.textContent =
      "⏹ Stop Tab Audio";

    return;
  }

  tabAudioButton.disabled =
    false;

  tabAudioButton.textContent =
    "🔊 Listen to Tab";
}

// --------------------------------------------------
// LOAD SAVED RESULT
// --------------------------------------------------

async function loadLatestTabResult() {
  try {
    const response =
      (await chrome.runtime.sendMessage({
        type: "GET_LATEST_TAB_RESULT"
      })) as LatestTabResultResponse;

    if (!response) {
      return;
    }

    isTabCapturing =
      Boolean(
        response.isCapturing
      );

    isTabProcessing =
      Boolean(
        response.isProcessing
      );

    if (
      response.targetLanguage
    ) {
      targetLanguage =
        response.targetLanguage;

      localStorage.setItem(
        "voxflow-target-language",
        targetLanguage
      );

      const select =
        document.getElementById(
          "voxflow-target-language"
        ) as HTMLSelectElement | null;

      if (select) {
        select.value =
          targetLanguage;
      }
    }

    if (response.result) {
      console.log(
        "VoxFlow: loaded saved AI result:",
        response.result
      );

      showTranscript(
        response.result.transcript
      );

      showFinalText(
        response.result
          .transformation
          .finalText
      );

      message.textContent =
        `Done ✓ → ${response.result.transformation.targetLanguage}`;
    }

    if (response.error) {
      message.textContent =
        response.error;
    }

    updateTabButton();
  } catch (error) {
    console.error(
      "VoxFlow: failed to load latest result:",
      error
    );
  }
}

// --------------------------------------------------
// TAB AUDIO BUTTON
// --------------------------------------------------

if (tabAudioButton) {
  tabAudioButton.addEventListener(
    "click",
    async () => {
      if (
        isProcessing ||
        isRecording ||
        isTabProcessing
      ) {
        return;
      }

      // --------------------------------------------
      // STOP
      // --------------------------------------------

      if (isTabCapturing) {
        tabAudioButton.disabled =
          true;

        message.textContent =
          "Stopping tab capture...";

        try {
          const response =
            await chrome.runtime.sendMessage({
              type: "STOP_TAB_CAPTURE"
            });

          if (
            !response?.success
          ) {
            throw new Error(
              response?.reason ||
                "Failed to stop tab capture."
            );
          }

          isTabCapturing =
            false;

          /*
           * IMPORTANT:
           *
           * We do NOT consider the operation
           * completely finished yet.
           *
           * Background is now processing the
           * captured audio.
           */

          isTabProcessing =
            true;

          message.textContent =
            "Audio captured. Processing...";

          updateTabButton();
        } catch (error) {
          console.error(
            "Stop tab capture error:",
            error
          );

          isTabCapturing =
            false;

          isTabProcessing =
            false;

          updateTabButton();

          message.textContent =
            error instanceof Error
              ? error.message
              : "Error stopping tab capture.";
        }

        return;
      }

      // --------------------------------------------
      // START
      // --------------------------------------------

      tabAudioButton.disabled =
        true;

      recordButton.disabled =
        true;

      message.textContent =
        "Starting tab capture...";

      try {
        const response =
          await chrome.runtime.sendMessage({
            type: "START_TAB_CAPTURE",
            targetLanguage
          });

        if (
          !response?.success
        ) {
          throw new Error(
            response?.reason ||
              "Failed to start tab capture."
          );
        }

        isTabCapturing =
          true;

        isTabProcessing =
          false;

        message.textContent =
          `Listening to tab → ${targetLanguage}`;

        updateTabButton();
      } catch (error) {
        console.error(
          "Start tab capture error:",
          error
        );

        isTabCapturing =
          false;

        isTabProcessing =
          false;

        recordButton.disabled =
          false;

        updateTabButton();

        message.textContent =
          error instanceof Error
            ? error.message
            : "Error starting tab capture.";
      }
    }
  );
}

// --------------------------------------------------
// REAL-TIME PIPELINE RESULTS
// --------------------------------------------------

chrome.runtime.onMessage.addListener(
  (message) => {
    if (
      message.type ===
      "TAB_PIPELINE_COMPLETE"
    ) {
      const result =
        message.result as TabPipelineResult;

      isTabCapturing =
        false;

      isTabProcessing =
        false;

      showTranscript(
        result.transcript
      );

      showFinalText(
        result.transformation
          .finalText
      );

      messageElement(
        `Done ✓ → ${result.transformation.targetLanguage}`
      );

      updateTabButton();

      recordButton.disabled =
        false;

      return;
    }

    if (
      message.type ===
      "TAB_PIPELINE_ERROR"
    ) {
      isTabCapturing =
        false;

      isTabProcessing =
        false;

      messageElement(
        message.error ||
          "VoxFlow pipeline failed."
      );

      updateTabButton();

      recordButton.disabled =
        false;
    }
  }
);

function messageElement(
  text: string
) {
  message.textContent =
    text;
}

// --------------------------------------------------
// MICROPHONE BUTTON
// --------------------------------------------------

recordButton.addEventListener(
  "click",
  async () => {
    if (
      isProcessing ||
      isTabCapturing ||
      isTabProcessing
    ) {
      return;
    }

    if (isRecording) {
      await stopRecording();

      return;
    }

    await startRecording();
  }
);

function resetRecordButton() {
  recordButton.disabled =
    false;

  recordButton.classList.remove(
    "recording"
  );

  recordIcon.textContent =
    "🎙";

  recordText.textContent =
    "Start speaking";

  if (
    tabAudioButton &&
    !isTabCapturing &&
    !isTabProcessing
  ) {
    tabAudioButton.disabled =
      false;
  }
}

async function startRecording() {
  try {
    message.textContent =
      "Requesting microphone...";

    recordButton.disabled =
      true;

    if (tabAudioButton) {
      tabAudioButton.disabled =
        true;
    }

    try {
      if (
        navigator.permissions?.query
      ) {
        const permission =
          await navigator.permissions.query({
            name:
              "microphone" as PermissionName
          });

        if (
          permission.state ===
          "denied"
        ) {
          throw new Error(
            "Microphone permission was denied."
          );
        }
      }
    } catch {
      // Continue if permission API
      // is unavailable.
    }

    const setupResponse =
      await chrome.runtime.sendMessage({
        type: "SETUP_OFFSCREEN"
      });

    if (
      setupResponse &&
      setupResponse.success === false
    ) {
      throw new Error(
        setupResponse.reason ||
          "Failed to initialize audio recorder."
      );
    }

    const startResponse =
      await chrome.runtime.sendMessage({
        target: "offscreen",
        type: "START_RECORDING"
      });

    if (
      !startResponse?.success
    ) {
      throw new Error(
        startResponse?.error ||
          "Microphone could not be accessed."
      );
    }

    isRecording =
      true;

    isProcessing =
      false;

    recordButton.disabled =
      false;

    recordButton.classList.add(
      "recording"
    );

    recordIcon.textContent =
      "■";

    recordText.textContent =
      "Stop speaking";

    message.textContent =
      "Listening...";
  } catch (error) {
    console.error(
      "VoxFlow microphone error:",
      error
    );

    message.textContent =
      error instanceof Error
        ? error.message
        : "Microphone could not be accessed.";

    isRecording =
      false;

    isProcessing =
      false;

    resetRecordButton();
  }
}

async function stopRecording() {
  if (isProcessing) {
    return;
  }

  isRecording =
    false;

  isProcessing =
    true;

  recordButton.disabled =
    true;

  if (tabAudioButton) {
    tabAudioButton.disabled =
      true;
  }

  recordIcon.textContent =
    "⏳";

  recordText.textContent =
    "Processing...";

  message.textContent =
    "Transcribing...";

  try {
    const stopResponse =
      await chrome.runtime.sendMessage({
        target: "offscreen",
        type: "STOP_RECORDING"
      });

    if (
      !stopResponse?.success ||
      !stopResponse.audioDataUrl
    ) {
      throw new Error(
        stopResponse?.error ||
          "No audio was recorded."
      );
    }

    const response =
      await fetch(
        stopResponse.audioDataUrl
      );

    const audioBlob =
      await response.blob();

    if (
      audioBlob.size === 0
    ) {
      throw new Error(
        "No audio was recorded."
      );
    }

    // --------------------------------------------
    // TRANSCRIBE
    // --------------------------------------------

    const formData =
      new FormData();

    formData.append(
      "file",
      audioBlob,
      "voxflow.webm"
    );

    const transcribeResponse =
      await fetch(
        `${API_URL}/transcribe`,
        {
          method: "POST",
          body: formData
        }
      );

    if (
      !transcribeResponse.ok
    ) {
      const error =
        await transcribeResponse
          .json()
          .catch(
            () => null
          );

      throw new Error(
        error?.error ||
          `Transcription failed (${transcribeResponse.status})`
      );
    }

    const transcribeResult =
      (await transcribeResponse.json()) as
        TranscriptionResponse;

    if (
      !transcribeResult.text?.trim()
    ) {
      throw new Error(
        "No speech was detected."
      );
    }

    const transcript =
      transcribeResult.text.trim();

    showTranscript(
      transcript
    );

    // --------------------------------------------
    // TRANSFORM
    // --------------------------------------------

    message.textContent =
      "Transforming...";

    const transformResponse =
      await fetch(
        `${API_URL}/transform`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            transcript,

            targetLanguage:
              targetLanguage ===
              "Auto"
                ? undefined
                : activeTargetLanguage
          })
        }
      );

    if (
      !transformResponse.ok
    ) {
      const error =
        await transformResponse
          .json()
          .catch(
            () => null
          );

      throw new Error(
        error?.error ||
          `Transformation failed (${transformResponse.status})`
      );
    }

    const transformResult =
      (await transformResponse.json()) as
        TransformResponse;

    if (
      !transformResult.finalText
    ) {
      throw new Error(
        "VoxFlow returned empty final text."
      );
    }

    showFinalText(
      transformResult.finalText
    );

    // --------------------------------------------
    // INSERT
    // --------------------------------------------

    message.textContent =
      "Inserting...";

    const insertResponse =
      (await chrome.runtime.sendMessage({
        type: "INSERT_TEXT",
        text:
          transformResult.finalText
      })) as InsertResponse;

    if (
      !insertResponse?.success
    ) {
      message.textContent =
        insertResponse?.reason ||
        "Unable to insert text.";

      return;
    }

    message.textContent =
      "Text inserted ✓";
  } catch (error) {
    console.error(
      "VoxFlow automatic pipeline error:",
      error
    );

    message.textContent =
      error instanceof Error
        ? error.message
        : "Something went wrong.";
  } finally {
    isRecording =
      false;

    isProcessing =
      false;

    resetRecordButton();
  }
}

// --------------------------------------------------
// INITIALIZATION
// --------------------------------------------------

loadTargetLanguage();

createTargetLanguageUI();

ensureFinalTextUI();

void syncTabCaptureState();

void loadLatestTabResult();