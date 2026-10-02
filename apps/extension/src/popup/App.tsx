import { RecordButton } from "./components/RecordButton";
import { useRecorder } from "../hooks/useRecorder";
function App() {
  const {
    status,
    audioBlob,
    error,
    startRecording,
    stopRecording,
    resetRecording
  } = useRecorder();

  const isRecording = status === "recording";

  return (
    <main className="voxflow-popup">
      <div className="brand">
        <div className="logo">V</div>

        <div>
          <h1>VoxFlow</h1>
          <p>Speak naturally. Type anywhere.</p>
        </div>
      </div>

      <div className="recording-card">
        <div className={isRecording ? "pulse active" : "pulse"}>
          🎙
        </div>

        <div className="status">
          {status === "idle" && "Ready to listen"}

          {status === "requesting" &&
            "Requesting microphone..."}

          {status === "recording" &&
            "Listening..."}

          {status === "stopped" &&
            "Recording captured"}

          {status === "error" &&
            "Microphone error"}
        </div>
      </div>

      <RecordButton
        isRecording={isRecording}
        onStart={startRecording}
        onStop={stopRecording}
      />

      {audioBlob && (
        <div className="result">
          <div>
            <strong>Audio captured</strong>
            <span>
              {(audioBlob.size / 1024).toFixed(1)} KB
            </span>
          </div>

          <button
            type="button"
            onClick={resetRecording}
            className="reset-button"
          >
            Record again
          </button>
        </div>
      )}

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      <div className="language">
        <span>●</span>
        Auto-detect language
      </div>
    </main>
  );
}

export default App;