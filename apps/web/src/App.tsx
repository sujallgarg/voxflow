import { useState } from "react";
import { RecordButton } from "./components/RecordButton";
import { useRecorder } from "./hooks/useRecorder";
import "./index.css";

const API_URL = "http://localhost:3001";

interface LanguageResult {
  primaryLanguage: string;
  languages: string[];
  mixedLanguage: boolean;
}

interface UnderstandingResult {
  meaning: string;
  intent: string;
  languages: string[];
  mixedLanguage: boolean;
  importantDetails: string[];
}

interface ContextResult {
  audience: string;
  communicationType: string;
  tone: string;
  formality: string;
  likelyChannel: string;
  purpose: string;
  confidence: number;
}

interface TransformationResult {
  finalText: string;
  targetLanguage: string;
  transformation: string;
}

function App() {
  const {
    status,
    audioBlob,
    error,
    startRecording,
    stopRecording,
    resetRecording
  } = useRecorder();

  // ==================================================
  // STEP 3 — SPEECH → TEXT
  // ==================================================

  const [transcript, setTranscript] = useState("");

  const [isTranscribing, setIsTranscribing] =
    useState(false);

  const [transcriptionError, setTranscriptionError] =
    useState<string | null>(null);

  // ==================================================
  // STEP 4 — LANGUAGE DETECTION
  // ==================================================

  const [language, setLanguage] =
    useState<LanguageResult | null>(null);

  const [isDetectingLanguage, setIsDetectingLanguage] =
    useState(false);

  const [languageError, setLanguageError] =
    useState<string | null>(null);

  // ==================================================
  // STEP 5 — MIXED-LANGUAGE UNDERSTANDING
  // ==================================================

  const [understanding, setUnderstanding] =
    useState<UnderstandingResult | null>(null);

  const [isUnderstanding, setIsUnderstanding] =
    useState(false);

  const [understandingError, setUnderstandingError] =
    useState<string | null>(null);

  // ==================================================
  // STEP 6 — CONTEXT DETECTION
  // ==================================================

  const [context, setContext] =
    useState<ContextResult | null>(null);

  const [isDetectingContext, setIsDetectingContext] =
    useState(false);

  const [contextError, setContextError] =
    useState<string | null>(null);

  // ==================================================
  // STEP 7 — AI TRANSFORMATION
  // ==================================================

  const [targetLanguage, setTargetLanguage] =
    useState("Auto");

  const [transformation, setTransformation] =
    useState<TransformationResult | null>(null);

  const [isTransforming, setIsTransforming] =
    useState(false);

  const [transformationError, setTransformationError] =
    useState<string | null>(null);

  const isRecording = status === "recording";

  // ==================================================
  // STEP 3 — TRANSCRIBE AUDIO
  // ==================================================

  async function transcribeAudio() {
    if (!audioBlob) return;

    try {
      setIsTranscribing(true);
      setTranscriptionError(null);

      // Clear previous pipeline results
      setTranscript("");

      setLanguage(null);
      setLanguageError(null);

      setUnderstanding(null);
      setUnderstandingError(null);

      setContext(null);
      setContextError(null);

      setTransformation(null);
      setTransformationError(null);

      const formData = new FormData();

      formData.append(
        "audio",
        audioBlob,
        "voxflow-recording.webm"
      );

      const response = await fetch(
        `${API_URL}/transcribe`,
        {
          method: "POST",
          body: formData
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Transcription failed."
        );
      }

      setTranscript(data.text);
    } catch (error) {
      console.error(error);

      setTranscriptionError(
        error instanceof Error
          ? error.message
          : "Unable to transcribe your recording."
      );
    } finally {
      setIsTranscribing(false);
    }
  }

  // ==================================================
  // STEP 4 — DETECT LANGUAGE
  // ==================================================

  async function detectTranscriptLanguage() {
    if (!transcript.trim()) return;

    try {
      setIsDetectingLanguage(true);
      setLanguageError(null);

      const response = await fetch(
        `${API_URL}/detect-language`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            transcript
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Language detection failed."
        );
      }

      setLanguage(data);
    } catch (error) {
      console.error(error);

      setLanguageError(
        error instanceof Error
          ? error.message
          : "Unable to detect language."
      );
    } finally {
      setIsDetectingLanguage(false);
    }
  }

  // ==================================================
  // STEP 5 — UNDERSTAND TRANSCRIPT
  // ==================================================

  async function understandTranscript() {
    if (!transcript.trim()) return;

    try {
      setIsUnderstanding(true);
      setUnderstandingError(null);

      const response = await fetch(
        `${API_URL}/understand`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            transcript
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Understanding failed."
        );
      }

      setUnderstanding(data);
    } catch (error) {
      console.error(error);

      setUnderstandingError(
        error instanceof Error
          ? error.message
          : "Unable to understand transcript."
      );
    } finally {
      setIsUnderstanding(false);
    }
  }

  // ==================================================
  // STEP 6 — DETECT CONTEXT
  // ==================================================

  async function detectTranscriptContext() {
    if (!transcript.trim()) return;

    try {
      setIsDetectingContext(true);
      setContextError(null);

      const response = await fetch(
        `${API_URL}/detect-context`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            transcript
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Context detection failed."
        );
      }

      setContext(data);
    } catch (error) {
      console.error(error);

      setContextError(
        error instanceof Error
          ? error.message
          : "Unable to detect context."
      );
    } finally {
      setIsDetectingContext(false);
    }
  }

  // ==================================================
  // STEP 7 — AI TRANSFORMATION
  // ==================================================

  async function transformTranscript() {
    if (!transcript.trim()) return;

    try {
      setIsTransforming(true);
      setTransformationError(null);

      const response = await fetch(
        `${API_URL}/transform`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            transcript,

            // Step 5
            meaning:
              understanding?.meaning,

            intent:
              understanding?.intent,

            // Step 6
            audience:
              context?.audience,

            communicationType:
              context?.communicationType,

            tone:
              context?.tone,

            formality:
              context?.formality,

            likelyChannel:
              context?.likelyChannel,

            purpose:
              context?.purpose,

            // Step 7
            targetLanguage:
              targetLanguage === "Auto"
                ? undefined
                : targetLanguage
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Transformation failed."
        );
      }

      setTransformation(data);
    } catch (error) {
      console.error(error);

      setTransformationError(
        error instanceof Error
          ? error.message
          : "Unable to transform transcript."
      );
    } finally {
      setIsTransforming(false);
    }
  }

  // ==================================================
  // COPY FINAL MESSAGE
  // ==================================================

  async function copyFinalMessage() {
    if (!transformation?.finalText) return;

    try {
      await navigator.clipboard.writeText(
        transformation.finalText
      );
    } catch (error) {
      console.error(
        "Unable to copy final message:",
        error
      );
    }
  }

  return (
    <main className="app">
      <div className="card">

        {/* ============================================
            BRAND
        ============================================ */}

        <div className="brand">
          <div className="logo">
            V
          </div>

          <div>
            <h1>VoxFlow</h1>

            <p>
              Speak naturally. Type anywhere.
            </p>
          </div>
        </div>

        {/* ============================================
            VOICE AREA
        ============================================ */}

        <div className="voice-area">

          <div
            className={`mic-circle ${
              isRecording ? "active" : ""
            }`}
          >
            🎙
          </div>

          <h2>
            {isRecording
              ? "Listening..."
              : "Ready when you are"}
          </h2>

          <p className="status">
            {status === "idle" &&
              "Click below and start speaking."}

            {status === "requesting" &&
              "Requesting microphone access..."}

            {status === "recording" &&
              "VoxFlow is listening to you."}

            {status === "stopped" &&
              "Recording captured successfully."}

            {status === "error" &&
              "Something went wrong."}
          </p>

          {/* RECORD */}

          <RecordButton
            isRecording={isRecording}
            onStart={startRecording}
            onStop={stopRecording}
          />

          {/* ==========================================
              AUDIO CAPTURED
          ========================================== */}

          {audioBlob && (
            <div className="result">

              <strong>
                Audio captured ✓
              </strong>

              <span>
                {(audioBlob.size / 1024).toFixed(
                  1
                )}{" "}
                KB
              </span>

              <button
                type="button"
                onClick={transcribeAudio}
                disabled={isTranscribing}
              >
                {isTranscribing
                  ? "Transcribing..."
                  : "Convert to text"}
              </button>

              <button
                type="button"
                onClick={resetRecording}
              >
                Record again
              </button>

            </div>
          )}

          {/* ==========================================
              TRANSCRIPT
          ========================================== */}

          {transcript && (
            <div className="transcript">

              <span>
                Transcript
              </span>

              <p>
                {transcript}
              </p>

              {/* STEP 4 */}

              <button
                type="button"
                onClick={
                  detectTranscriptLanguage
                }
                disabled={
                  isDetectingLanguage
                }
              >
                {isDetectingLanguage
                  ? "Detecting language..."
                  : "Detect language"}
              </button>

              {/* STEP 5 */}

              <button
                type="button"
                onClick={
                  understandTranscript
                }
                disabled={isUnderstanding}
              >
                {isUnderstanding
                  ? "Understanding..."
                  : "Understand meaning"}
              </button>

              {/* STEP 6 */}

              <button
                type="button"
                onClick={
                  detectTranscriptContext
                }
                disabled={
                  isDetectingContext
                }
              >
                {isDetectingContext
                  ? "Detecting context..."
                  : "Detect context"}
              </button>

              {/* ======================================
                  STEP 7 — OUTPUT LANGUAGE
              ====================================== */}

              <div className="target-language">

                <label htmlFor="target-language">
                  Output language
                </label>

                <select
                  id="target-language"
                  value={targetLanguage}
                  onChange={(event) =>
                    setTargetLanguage(
                      event.target.value
                    )
                  }
                >
                  <option value="Auto">
                    Auto
                  </option>

                  <option value="English">
                    English
                  </option>

                  <option value="Hindi">
                    Hindi
                  </option>

                  <option value="German">
                    German
                  </option>

                  <option value="Portuguese">
                    Portuguese
                  </option>

                  <option value="Spanish">
                    Spanish
                  </option>

                  <option value="French">
                    French
                  </option>
                </select>

              </div>

              {/* STEP 7 */}

              <button
                type="button"
                onClick={
                  transformTranscript
                }
                disabled={isTransforming}
              >
                {isTransforming
                  ? "Creating message..."
                  : "Create final message"}
              </button>

            </div>
          )}

          {/* ==========================================
              STEP 4 — LANGUAGE RESULT
          ========================================== */}

          {language && (
            <div className="language-result">

              <span>
                Language detected
              </span>

              <strong>
                {language.primaryLanguage}
              </strong>

              <p>
                {language.languages.length === 1
                  ? `Detected: ${language.languages[0]}`
                  : `Detected: ${language.languages.join(
                      " + "
                    )}`}
              </p>

              {language.mixedLanguage && (
                <small>
                  Mixed-language speech detected
                </small>
              )}

            </div>
          )}

          {languageError && (
            <div className="error">
              {languageError}
            </div>
          )}

          {/* ==========================================
              STEP 5 — UNDERSTANDING RESULT
          ========================================== */}

          {understanding && (
            <div className="understanding-result">

              <span>
                VoxFlow understood
              </span>

              <strong>
                {understanding.intent}
              </strong>

              <p>
                {understanding.meaning}
              </p>

              <div className="understanding-languages">

                {understanding.languages.map(
                  (item) => (
                    <span key={item}>
                      {item}
                    </span>
                  )
                )}

              </div>

              {understanding
                .importantDetails
                .length > 0 && (
                <div className="important-details">

                  <strong>
                    Important details
                  </strong>

                  <ul>
                    {understanding
                      .importantDetails
                      .map(
                        (
                          detail,
                          index
                        ) => (
                          <li
                            key={index}
                          >
                            {detail}
                          </li>
                        )
                      )}
                  </ul>

                </div>
              )}

            </div>
          )}

          {understandingError && (
            <div className="error">
              {understandingError}
            </div>
          )}

          {/* ==========================================
              STEP 6 — CONTEXT RESULT
          ========================================== */}

          {context && (
            <div className="context-result">

              <span>
                Context detected
              </span>

              <div className="context-grid">

                <div>
                  <small>
                    Audience
                  </small>

                  <strong>
                    {context.audience}
                  </strong>
                </div>

                <div>
                  <small>
                    Communication
                  </small>

                  <strong>
                    {
                      context.communicationType
                    }
                  </strong>
                </div>

                <div>
                  <small>
                    Tone
                  </small>

                  <strong>
                    {context.tone}
                  </strong>
                </div>

                <div>
                  <small>
                    Formality
                  </small>

                  <strong>
                    {context.formality}
                  </strong>
                </div>

                <div>
                  <small>
                    Likely channel
                  </small>

                  <strong>
                    {context.likelyChannel}
                  </strong>
                </div>

              </div>

              <div className="context-purpose">

                <small>
                  Purpose
                </small>

                <p>
                  {context.purpose}
                </p>

              </div>

              <small>
                Confidence:{" "}
                {Math.round(
                  context.confidence * 100
                )}
                %
              </small>

            </div>
          )}

          {contextError && (
            <div className="error">
              {contextError}
            </div>
          )}

          {/* ==========================================
              STEP 7 — FINAL OUTPUT
          ========================================== */}

          {transformation && (
            <div className="transformation-result">

              <span>
                VoxFlow output
              </span>

              <strong>
                {transformation.targetLanguage}
              </strong>

              <p>
                {transformation.finalText}
              </p>

              <small>
                {transformation.transformation}
              </small>

              <button
                type="button"
                onClick={
                  copyFinalMessage
                }
              >
                Copy final message
              </button>

            </div>
          )}

          {transformationError && (
            <div className="error">
              {transformationError}
            </div>
          )}

          {/* ==========================================
              GENERAL ERRORS
          ========================================== */}

          {error && (
            <div className="error">
              {error}
            </div>
          )}

          {transcriptionError && (
            <div className="error">
              {transcriptionError}
            </div>
          )}

        </div>

        {/* ============================================
            FOOTER
        ============================================ */}

        <div className="footer">
          <span>
            Step 7
          </span>

          <span>
            AI Transformation
          </span>
        </div>

      </div>
    </main>
  );
}

export default App;