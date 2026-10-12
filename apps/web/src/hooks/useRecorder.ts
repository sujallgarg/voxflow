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
  duration: number;
  durationFormatted: string;
  volume: number; // 0 to 1
  waveform: number[]; // 16 amplitude values between 0.05 and 1
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  cancelRecording: () => void;
  resetRecording: () => void;
}

export function useRecorder(): UseRecorderReturn {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0);
  const [waveform, setWaveform] = useState<number[]>(new Array(16).fill(0.1));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isCancelledRef = useRef<boolean>(false);
  const stopResolveRef = useRef<((blob: Blob | null) => void) | null>(null);

  // Helper to format seconds into MM:SS
  const formatDuration = (secs: number): string => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
  };

  // Stop Web Audio API analyser
  const stopAudioAnalyser = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setVolume(0);
    setWaveform(new Array(16).fill(0.1));
  }, []);

  // Stop duration timer
  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  // Stop media tracks
  const stopTracks = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      mediaStreamRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (status === "recording" || status === "requesting") {
      return;
    }

    try {
      setError(null);
      setAudioBlob(null);
      setStatus("requesting");
      setDuration(0);
      chunksRef.current = [];
      isCancelledRef.current = false;

      // Check browser MediaDevices support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser does not support microphone audio capture. Please try latest Chrome or Edge.");
      }

      // Request microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      mediaStreamRef.current = stream;

      // Pick supported mime type
      let mimeType = "audio/webm";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
          mimeType = "audio/ogg";
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      // Setup Web Audio Analyser for live visualizer
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyser.smoothingTimeConstant = 0.8;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateVisualizer = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);

            // Compute average volume
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avgVol = Math.min(1, (sum / dataArray.length) / 128);
            setVolume(avgVol);

            // Sample 16 bars
            const bars: number[] = [];
            const step = Math.max(1, Math.floor(dataArray.length / 16));
            for (let i = 0; i < 16; i++) {
              const val = dataArray[i * step] || 0;
              // Map to minimum height 0.08 up to 1
              bars.push(Math.max(0.08, Math.min(1, val / 255)));
            }
            setWaveform(bars);

            animFrameRef.current = requestAnimationFrame(updateVisualizer);
          };
          updateVisualizer();
        }
      } catch (audioErr) {
        console.warn("VoxFlow: Web Audio visualizer not available, continuing recording:", audioErr);
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stopAudioAnalyser();
        stopTimer();
        stopTracks();

        if (isCancelledRef.current) {
          chunksRef.current = [];
          setAudioBlob(null);
          setStatus("idle");
          if (stopResolveRef.current) {
            stopResolveRef.current(null);
            stopResolveRef.current = null;
          }
          return;
        }

        if (chunksRef.current.length === 0) {
          setError("No audio data was recorded.");
          setStatus("error");
          if (stopResolveRef.current) {
            stopResolveRef.current(null);
            stopResolveRef.current = null;
          }
          return;
        }

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm"
        });

        setAudioBlob(blob);
        setStatus("stopped");
        mediaRecorderRef.current = null;

        if (stopResolveRef.current) {
          stopResolveRef.current(blob);
          stopResolveRef.current = null;
        }
      };

      recorder.onerror = () => {
        stopAudioAnalyser();
        stopTimer();
        stopTracks();
        setError("An error occurred while capturing audio.");
        setStatus("error");
        if (stopResolveRef.current) {
          stopResolveRef.current(null);
          stopResolveRef.current = null;
        }
      };

      // Collect data in 250ms chunks for reliability
      recorder.start(250);
      setStatus("recording");

      // Start elapsed timer
      timerIntervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("VoxFlow microphone error:", err);
      stopAudioAnalyser();
      stopTimer();
      stopTracks();

      let friendlyMsg = "Unable to access microphone.";
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        friendlyMsg = "Microphone access was denied. Please allow microphone permissions in your browser address bar.";
      } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
        friendlyMsg = "No microphone input device detected. Please connect a microphone and try again.";
      } else if (err?.name === "NotReadableError" || err?.name === "TrackStartError") {
        friendlyMsg = "Microphone is in use by another application or blocked by system permissions.";
      } else if (err?.message) {
        friendlyMsg = err.message;
      }

      setError(friendlyMsg);
      setStatus("error");
      if (stopResolveRef.current) {
        stopResolveRef.current(null);
        stopResolveRef.current = null;
      }
    }
  }, [status, stopAudioAnalyser, stopTimer, stopTracks]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      isCancelledRef.current = false;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        stopResolveRef.current = resolve;
        recorder.stop();
      } else {
        resolve(null);
      }
    });
  }, []);

  const cancelRecording = useCallback(() => {
    isCancelledRef.current = true;
    if (stopResolveRef.current) {
      stopResolveRef.current(null);
      stopResolveRef.current = null;
    }
    stopAudioAnalyser();
    stopTimer();
    stopTracks();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    chunksRef.current = [];
    setAudioBlob(null);
    setDuration(0);
    setError(null);
    setStatus("idle");
  }, [stopAudioAnalyser, stopTimer, stopTracks]);

  const resetRecording = useCallback(() => {
    cancelRecording();
  }, [cancelRecording]);

  useEffect(() => {
    return () => {
      stopAudioAnalyser();
      stopTimer();
      stopTracks();
    };
  }, [stopAudioAnalyser, stopTimer, stopTracks]);

  return {
    status,
    audioBlob,
    error,
    duration,
    durationFormatted: formatDuration(duration),
    volume,
    waveform,
    startRecording,
    stopRecording,
    cancelRecording,
    resetRecording
  };
}