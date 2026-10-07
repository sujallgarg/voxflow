console.log(
  "VoxFlow: OFFSCREEN SCRIPT LOADED."
);

interface StartTabCaptureMessage {
  type: "START_TAB_CAPTURE";
  streamId: string;
}

interface StopTabCaptureMessage {
  type: "STOP_TAB_CAPTURE";
}

type OffscreenMessage =
  | StartTabCaptureMessage
  | StopTabCaptureMessage;

let mediaRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;

let audioChunks: Blob[] = [];

let isCapturing = false;
let isFinishing = false;

chrome.runtime.onMessage.addListener(
  (
    message: OffscreenMessage,
    _sender,
    sendResponse
  ) => {
    if (
      message.type === "START_TAB_CAPTURE"
    ) {
      void startTabCapture(
        message.streamId
      );

      sendResponse({
        success: true
      });

      return true;
    }

    if (
      message.type === "STOP_TAB_CAPTURE"
    ) {
      stopTabCapture();

      sendResponse({
        success: true
      });

      return true;
    }

    return false;
  }
);

async function startTabCapture(
  streamId: string
) {
  if (isCapturing) {
    console.warn(
      "VoxFlow: tab capture already active."
    );

    return;
  }

  try {
    console.log(
      "VoxFlow: starting tab capture..."
    );

    audioChunks = [];
    isFinishing = false;

    mediaStream =
      await navigator.mediaDevices.getUserMedia(
        {
          audio: {
            mandatory: {
              chromeMediaSource: "tab",
              chromeMediaSourceId:
                streamId
            }
          },
          video: false
        } as MediaStreamConstraints
      );

    const tracks =
      mediaStream.getAudioTracks();

    console.log(
      "VoxFlow: audio tracks:",
      tracks.length
    );

    if (tracks.length === 0) {
      throw new Error(
        "No audio track captured."
      );
    }

    audioContext =
      new AudioContext();

    if (
      audioContext.state ===
      "suspended"
    ) {
      await audioContext.resume();
    }

    const source =
      audioContext.createMediaStreamSource(
        mediaStream
      );

    const recordingDestination =
      audioContext.createMediaStreamDestination();

    /*
     * Keep YouTube/browser audio playing.
     */
    source.connect(
      audioContext.destination
    );

    /*
     * Send the same audio to MediaRecorder.
     */
    source.connect(
      recordingDestination
    );

    const mimeType =
      getSupportedMimeType();

    mediaRecorder = mimeType
      ? new MediaRecorder(
          recordingDestination.stream,
          {
            mimeType
          }
        )
      : new MediaRecorder(
          recordingDestination.stream
        );

    mediaRecorder.ondataavailable =
      (event) => {
        if (event.data.size > 0) {
          audioChunks.push(
            event.data
          );

          console.log(
            "VoxFlow: audio chunk:",
            event.data.size
          );
        }
      };

    mediaRecorder.onerror =
      (event) => {
        console.error(
          "VoxFlow: MediaRecorder error:",
          event
        );

        if (!isFinishing) {
          chrome.runtime.sendMessage({
            type: "TAB_CAPTURE_ERROR",
            error:
              "Tab audio recorder encountered an error."
          });
        }

        cleanup();
      };

    mediaRecorder.onstop =
      () => {
        if (isFinishing) {
          return;
        }

        void finishRecording();
      };

    mediaRecorder.start(250);

    isCapturing = true;

    console.log(
      "VoxFlow: tab recording started."
    );

    chrome.runtime.sendMessage({
      type: "TAB_CAPTURE_STARTED"
    });
  } catch (error) {
    console.error(
      "VoxFlow: tab capture failed:",
      error
    );

    cleanup();

    chrome.runtime.sendMessage({
      type: "TAB_CAPTURE_ERROR",
      error:
        error instanceof Error
          ? error.message
          : "Unable to capture tab audio."
    });
  }
}

function stopTabCapture() {
  if (!isCapturing) {
    console.log(
      "VoxFlow: no active capture."
    );

    cleanup();

    return;
  }

  if (isFinishing) {
    return;
  }

  console.log(
    "VoxFlow: stopping tab capture..."
  );

  if (
    mediaRecorder &&
    mediaRecorder.state !== "inactive"
  ) {
    mediaRecorder.stop();
  } else {
    void finishRecording();
  }
}

async function finishRecording() {
  if (isFinishing) {
    return;
  }

  isFinishing = true;

  try {
    console.log(
      "VoxFlow: finishing recording..."
    );

    /*
     * Wait for the final dataavailable event.
     */
    await new Promise<void>(
      (resolve) => {
        setTimeout(resolve, 150);
      }
    );

    console.log(
      "VoxFlow: chunks:",
      audioChunks.length
    );

    if (audioChunks.length === 0) {
      throw new Error(
        "No tab audio was captured."
      );
    }

    const mimeType =
      audioChunks[0]?.type ||
      mediaRecorder?.mimeType ||
      "audio/webm";

    const audioBlob =
      new Blob(audioChunks, {
        type: mimeType
      });

    console.log(
      "VoxFlow: audio blob size:",
      audioBlob.size
    );

    if (audioBlob.size === 0) {
      throw new Error(
        "Captured tab audio is empty."
      );
    }

    /*
     * Chrome extension messaging uses JSON-style
     * serialization here, so do NOT send ArrayBuffer
     * directly.
     *
     * Convert the Blob to base64 instead.
     */
    const base64 =
      await blobToBase64(
        audioBlob
      );

    console.log(
      "VoxFlow: base64 audio length:",
      base64.length
    );

    chrome.runtime.sendMessage({
      type: "TAB_CAPTURE_COMPLETE",
      audioBase64: base64,
      mimeType
    });
  } catch (error) {
    console.error(
      "VoxFlow: finish capture error:",
      error
    );

    chrome.runtime.sendMessage({
      type: "TAB_CAPTURE_ERROR",
      error:
        error instanceof Error
          ? error.message
          : "Unable to process tab audio."
    });
  } finally {
    cleanup();
  }
}

function blobToBase64(
  blob: Blob
): Promise<string> {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onloadend = () => {
        const result =
          reader.result;

        if (
          typeof result !== "string"
        ) {
          reject(
            new Error(
              "Unable to convert audio to base64."
            )
          );

          return;
        }

        const commaIndex =
          result.indexOf(",");

        if (commaIndex === -1) {
          reject(
            new Error(
              "Invalid base64 audio data."
            )
          );

          return;
        }

        resolve(
          result.slice(
            commaIndex + 1
          )
        );
      };

      reader.onerror = () => {
        reject(
          new Error(
            "Failed to read audio blob."
          )
        );
      };

      reader.readAsDataURL(blob);
    }
  );
}

function cleanup() {
  isCapturing = false;

  if (mediaStream) {
    mediaStream
      .getTracks()
      .forEach((track) => {
        track.stop();
      });
  }

  if (audioContext) {
    void audioContext
      .close()
      .catch(() => {});
  }

  mediaRecorder = null;
  mediaStream = null;
  audioContext = null;
  audioChunks = [];

  console.log(
    "VoxFlow: tab capture cleaned up."
  );
}

function getSupportedMimeType() {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus"
  ];

  for (const type of types) {
    if (
      MediaRecorder.isTypeSupported(
        type
      )
    ) {
      return type;
    }
  }

  return "";
}