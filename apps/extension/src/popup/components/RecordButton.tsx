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
      className={isRecording ? "record-button recording" : "record-button"}
    >
      <span className="record-icon">
        {isRecording ? "■" : "🎙"}
      </span>

      <span>
        {isRecording ? "Stop recording" : "Start speaking"}
      </span>
    </button>
  );
}