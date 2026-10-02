import { useCallback, useEffect, useRef, useState } from "react";

export type RecordingStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "stopped"
  | "error";

interface UseRecorderReturn {
  status: RecordingStatus;
  audioBlob: Blob | null;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  resetRecording: () => void;
}

export function useRecorder(): UseRecorderReturn {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setAudioBlob(null);
      setStatus("requesting");
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      mediaStreamRef.current = stream;

      const recorder = new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm"
        });

        setAudioBlob(blob);
        setStatus("stopped");

        stream.getTracks().forEach((track) => {
          track.stop();
        });

        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
      };

      recorder.onerror = () => {
        setError("Something went wrong while recording.");
        setStatus("error");

        stream.getTracks().forEach((track) => {
          track.stop();
        });
      };

      recorder.start();

      setStatus("recording");
    } catch (err) {
      console.error("VoxFlow microphone error:", err);

      setError(
        "Microphone access was denied or is unavailable."
      );

      setStatus("error");
    }
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  const resetRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
    }

    mediaRecorderRef.current = null;
    mediaStreamRef.current = null;
    chunksRef.current = [];

    setAudioBlob(null);
    setError(null);
    setStatus("idle");
  }, []);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, []);

  return {
    status,
    audioBlob,
    error,
    startRecording,
    stopRecording,
    resetRecording
  };
}