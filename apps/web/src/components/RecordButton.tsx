interface RecordButtonProps {
  isRecording: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function RecordButton({
  isRecording,
  onStart,
  onStop
}: RecordButtonProps) {
  return (
    <button
      type="button"
      onClick={isRecording ? onStop : onStart}
      className={`record-button ${
        isRecording ? "recording" : ""
      }`}
    >
      <span className="record-icon">
        {isRecording ? "■" : "🎙"}
      </span>

      <span>
        {isRecording ? "Stop speaking" : "Start speaking"}
      </span>
    </button>
  );
}