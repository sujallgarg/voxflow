import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/authContext";
import { useSubscription } from "../lib/subscriptionContext";
import { SUPPORTED_LANGUAGES } from "../data/languages";
import type { MeetingRecord, TopicItem, DecisionItem, ActionItem } from "@voxflow/shared";

export type WidgetMode = "voice" | "meeting" | "history" | "settings";
export type VoiceState = "idle" | "recording" | "paused" | "transcribing" | "completed" | "error";
export type MeetingStep = "setup" | "recording" | "processing" | "completed" | "history";
export type AudioSourceType = "mic" | "system" | "combined";

export const FloatingWebWidget: React.FC = () => {
  const { user } = useAuth();
  const { entitlements, isPremium } = useSubscription();

  // Settings stored in localStorage
  const [preferredLang, setPreferredLang] = useState(() => {
    try {
      return localStorage.getItem("voxflow_pref_lang") || "auto";
    } catch {
      return "auto";
    }
  });

  const [preferredOutputLang, setPreferredOutputLang] = useState(() => {
    try {
      return localStorage.getItem("voxflow_pref_output_lang") || "same";
    } catch {
      return "same";
    }
  });

  const [defaultMode, setDefaultMode] = useState<WidgetMode>(() => {
    try {
      const stored = localStorage.getItem("voxflow_pref_mode");
      if (stored === "meeting" || stored === "voice") return stored;
    } catch {}
    return "voice";
  });

  const [selectedMicId, setSelectedMicId] = useState<string>(() => {
    try {
      return localStorage.getItem("voxflow_pref_mic") || "";
    } catch {
      return "";
    }
  });

  const [audioConstraints, setAudioConstraints] = useState({
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  });

  // Available audio input devices
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);

  // Widget Open / Closed State
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const search = window.location.search || "";
      const hash = window.location.hash || "";
      if (search.includes("widget=open") || hash.includes("widget-open")) {
        return true;
      }
    }
    return false;
  });

  // Segmented Mode Navigation: voice | meeting | history | settings
  const [activeMode, setActiveMode] = useState<WidgetMode>(defaultMode);

  // ==========================================
  // VOICE TYPING STATE
  // ==========================================
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceTargetLang, setVoiceTargetLang] = useState(preferredLang);
  const [voiceOutputLang, setVoiceOutputLang] = useState(preferredOutputLang);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [voiceWaveform, setVoiceWaveform] = useState<number[]>(new Array(16).fill(0.08));

  // Voice recording refs
  const voiceMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceMediaStreamRef = useRef<MediaStream | null>(null);
  const voiceAudioCtxRef = useRef<AudioContext | null>(null);
  const voiceAnalyserRef = useRef<AnalyserNode | null>(null);
  const voiceAnimFrameRef = useRef<number | null>(null);
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceIsCancelledRef = useRef(false);

  // Focus tracking for target text input insertion
  const lastActiveInputRef = useRef<HTMLElement | null>(null);
  const widgetContainerRef = useRef<HTMLDivElement | null>(null);

  // ==========================================
  // MEETING NOTES STATE
  // ==========================================
  const [meetingStep, setMeetingStep] = useState<MeetingStep>("setup");
  const [meetingTitle, setMeetingTitle] = useState(() => {
    const d = new Date();
    return `Meeting - ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  });
  const [meetingLanguage, setMeetingLanguage] = useState("Auto");
  const [meetingSource, setMeetingSource] = useState<AudioSourceType>("mic");
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [isMeetingPaused, setIsMeetingPaused] = useState(false);
  const [meetingProcessingStage, setMeetingProcessingStage] = useState<string>("Finalizing audio...");
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const [sourceNotice, setSourceNotice] = useState<string | null>(null);
  const [meetingWaveform, setMeetingWaveform] = useState<number[]>(new Array(16).fill(0.08));

  // Meeting result & tabs
  const [currentMeeting, setCurrentMeeting] = useState<MeetingRecord | null>(null);
  const [meetingTab, setMeetingTab] = useState<"overview" | "summary" | "topics" | "decisions" | "actions" | "transcript">("overview");
  const [isEditingMeeting, setIsEditingMeeting] = useState(false);
  const [editedSummary, setEditedSummary] = useState("");
  const [editedTopics, setEditedTopics] = useState<TopicItem[]>([]);
  const [editedDecisions, setEditedDecisions] = useState<DecisionItem[]>([]);
  const [editedActions, setEditedActions] = useState<ActionItem[]>([]);

  // Meeting history state
  const [storedMeetings, setStoredMeetings] = useState<MeetingRecord[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historySort, setHistorySort] = useState<"newest" | "oldest" | "title">("newest");
  const [meetingToDelete, setMeetingToDelete] = useState<MeetingRecord | null>(null);

  // Live meeting audio recording refs
  const meetingMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const meetingStreamsToCleanupRef = useRef<(() => void) | null>(null);
  const meetingChunksRef = useRef<Blob[]>([]);
  const meetingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meetingAudioCtxRef = useRef<AudioContext | null>(null);
  const meetingAnalyserRef = useRef<AnalyserNode | null>(null);
  const meetingAnimFrameRef = useRef<number | null>(null);

  // Global Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 2800);
  }, []);

  // Enumerate audio input devices
  const refreshAudioDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((d) => d.kind === "audioinput");
      setAudioDevices(inputs);
    } catch (err) {
      console.warn("Could not enumerate audio devices:", err);
    }
  }, []);

  useEffect(() => {
    void refreshAudioDevices();
    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", refreshAudioDevices);
      return () => {
        navigator.mediaDevices.removeEventListener("devicechange", refreshAudioDevices);
      };
    }
  }, [refreshAudioDevices]);

  // Global Keyboard Shortcut: ⌘ ⇧ X (or Ctrl ⇧ X) to toggle widget
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "x" || e.key === "X")) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Suppress duplicate extension-injected overlays on the official website so only one clean capsule displays
  useEffect(() => {
    const suppressExtensionDuplicates = () => {
      const extRoots = document.querySelectorAll(
        "#voxflow-extension-root, [data-voxflow-extension-host], #voxflow-overlay-container, #voxflow-capsule"
      );
      extRoots.forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.setProperty("display", "none", "important");
        htmlEl.style.setProperty("visibility", "hidden", "important");
        htmlEl.style.setProperty("pointer-events", "none", "important");
      });
    };

    suppressExtensionDuplicates();

    if (typeof MutationObserver !== "undefined") {
      const observer = new MutationObserver(() => {
        suppressExtensionDuplicates();
      });
      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });
      return () => observer.disconnect();
    }
  }, []);

  // Track focused text inputs outside the widget for voice typing insertion
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (widgetContainerRef.current?.contains(target)) return;

      const isInput =
        target.tagName === "INPUT" &&
        ["text", "search", "email", "url", "tel", "password", ""].includes(
          (target as HTMLInputElement).type?.toLowerCase() || ""
        );
      const isTextArea = target.tagName === "TEXTAREA";
      const isEditable = target.isContentEditable;

      if (isInput || isTextArea || isEditable) {
        lastActiveInputRef.current = target;
      }
    };

    document.addEventListener("focusin", handleFocusIn, true);
    return () => {
      document.removeEventListener("focusin", handleFocusIn, true);
    };
  }, []);

  // Load meeting history from local storage and backend API
  const loadStoredMeetings = useCallback(async () => {
    let localList: MeetingRecord[] = [];
    try {
      const raw = localStorage.getItem("voxflow_stored_meetings");
      if (raw) localList = JSON.parse(raw);
    } catch {}

    setStoredMeetings(localList);

    if (user) {
      try {
        const res = await api.getMeetings();
        if (res && Array.isArray(res.meetings)) {
          const merged = [...res.meetings];
          for (const item of localList) {
            if (!merged.some((m) => m.id === item.id)) {
              merged.push(item);
            }
          }
          setStoredMeetings(merged);
        }
      } catch {}
    }
  }, [user]);

  useEffect(() => {
    void loadStoredMeetings();
  }, [loadStoredMeetings]);

  const saveMeetingToStorage = (record: MeetingRecord) => {
    try {
      const raw = localStorage.getItem("voxflow_stored_meetings");
      const list: MeetingRecord[] = raw ? JSON.parse(raw) : [];
      const updated = [record, ...list.filter((m) => m.id !== record.id)];
      localStorage.setItem("voxflow_stored_meetings", JSON.stringify(updated.slice(0, 50)));
      setStoredMeetings(updated);
    } catch {}

    if (user) {
      api.saveMeeting(record).catch(() => {});
    }
  };

  const deleteMeetingFromStorage = async (id: string) => {
    try {
      const raw = localStorage.getItem("voxflow_stored_meetings");
      const list: MeetingRecord[] = raw ? JSON.parse(raw) : [];
      const updated = list.filter((m) => m.id !== id);
      localStorage.setItem("voxflow_stored_meetings", JSON.stringify(updated));
      setStoredMeetings(updated);
      showToast("Meeting deleted.");
    } catch {}

    if (user) {
      api.deleteMeeting(id).catch(() => {});
    }

    if (currentMeeting?.id === id) {
      setCurrentMeeting(null);
      setMeetingStep("setup");
    }
    setMeetingToDelete(null);
  };

  // ==========================================
  // VOICE TYPING AUDIO PIPELINE
  // ==========================================
  const stopVoiceAnalyser = () => {
    if (voiceAnimFrameRef.current) {
      cancelAnimationFrame(voiceAnimFrameRef.current);
      voiceAnimFrameRef.current = null;
    }
    if (voiceAudioCtxRef.current && voiceAudioCtxRef.current.state !== "closed") {
      voiceAudioCtxRef.current.close().catch(() => {});
      voiceAudioCtxRef.current = null;
    }
    voiceAnalyserRef.current = null;
    setVoiceWaveform(new Array(16).fill(0.08));
  };

  const setupVoiceAnalyser = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      voiceAudioCtxRef.current = ctx;

      const sourceNode = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      sourceNode.connect(analyser);
      voiceAnalyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVisualizer = () => {
        if (!voiceAnalyserRef.current) return;
        voiceAnalyserRef.current.getByteFrequencyData(dataArray);

        const bars: number[] = [];
        const step = Math.max(1, Math.floor(dataArray.length / 16));
        for (let i = 0; i < 16; i++) {
          const val = dataArray[i * step] || 0;
          bars.push(Math.max(0.08, Math.min(1, val / 255)));
        }
        setVoiceWaveform(bars);
        voiceAnimFrameRef.current = requestAnimationFrame(updateVisualizer);
      };
      updateVisualizer();
    } catch (err) {
      console.warn("Voice visualizer error:", err);
    }
  };

  const handleVoiceStart = async () => {
    setVoiceError(null);
    setVoiceDuration(0);
    voiceChunksRef.current = [];
    voiceIsCancelledRef.current = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError("Microphone capture is not supported in this browser. Please use Chrome or Edge.");
      setVoiceState("error");
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: selectedMicId ? { exact: selectedMicId } : undefined,
          echoCancellation: audioConstraints.echoCancellation,
          noiseSuppression: audioConstraints.noiseSuppression,
          autoGainControl: audioConstraints.autoGainControl
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      voiceMediaStreamRef.current = stream;

      let mimeType = "audio/webm";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      voiceMediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          voiceChunksRef.current.push(event.data);
        }
      };

      setupVoiceAnalyser(stream);
      recorder.start(250);
      setVoiceState("recording");

      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = setInterval(() => {
        setVoiceDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Voice capture error:", err);
      let msg = "Microphone access denied or unavailable. Please check permissions.";
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        msg = "Microphone permission was denied. Please allow microphone access in your browser bar.";
      } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
        msg = "No microphone found. Please connect an audio input device.";
      }
      setVoiceError(msg);
      setVoiceState("error");
    }
  };

  const handleVoicePause = () => {
    const rec = voiceMediaRecorderRef.current;
    if (rec && rec.state === "recording") {
      try {
        rec.pause();
        if (voiceTimerRef.current) {
          clearInterval(voiceTimerRef.current);
          voiceTimerRef.current = null;
        }
        setVoiceState("paused");
      } catch {}
    }
  };

  const handleVoiceResume = () => {
    const rec = voiceMediaRecorderRef.current;
    if (rec && rec.state === "paused") {
      try {
        rec.resume();
        voiceTimerRef.current = setInterval(() => {
          setVoiceDuration((prev) => prev + 1);
        }, 1000);
        setVoiceState("recording");
      } catch {}
    }
  };

  const handleVoiceCancel = () => {
    voiceIsCancelledRef.current = true;
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    stopVoiceAnalyser();
    if (voiceMediaRecorderRef.current) {
      try {
        voiceMediaRecorderRef.current.stop();
      } catch {}
      voiceMediaRecorderRef.current = null;
    }
    if (voiceMediaStreamRef.current) {
      voiceMediaStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      voiceMediaStreamRef.current = null;
    }
    voiceChunksRef.current = [];
    setVoiceState("idle");
    setVoiceError(null);
  };

  const handleVoiceStop = async () => {
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    stopVoiceAnalyser();

    const recorder = voiceMediaRecorderRef.current;
    if (!recorder) return;

    setVoiceState("transcribing");

    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          if (voiceIsCancelledRef.current || voiceChunksRef.current.length === 0) {
            reject(new Error("No audio was recorded. Please speak clearly into your microphone."));
            return;
          }
          const finalBlob = new Blob(voiceChunksRef.current, {
            type: recorder.mimeType || "audio/webm"
          });
          resolve(finalBlob);
        };
        try {
          recorder.stop();
        } catch {
          reject(new Error("Failed to stop recording."));
        }
      });

      if (voiceMediaStreamRef.current) {
        voiceMediaStreamRef.current.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
        voiceMediaStreamRef.current = null;
      }

      let text = "";
      if (user) {
        const res = await api.transcribeAudio(blob, "voice-typing.webm", user.id);
        text = res.text?.trim() || "";

        // If user requested a specific output language
        if (text && voiceOutputLang && voiceOutputLang !== "same") {
          const targetLangObj = SUPPORTED_LANGUAGES.find((l) => l.id === voiceOutputLang);
          const targetLangName = targetLangObj ? targetLangObj.name : voiceOutputLang;
          try {
            const transformed = await api.transform({
              transcript: text,
              targetLanguage: targetLangName
            }, user.id);
            if (transformed?.finalText || transformed?.transformation) {
              text = (transformed.finalText || transformed.transformation).trim();
            }
          } catch (transformErr) {
            console.warn("Target output language transformation fallback:", transformErr);
          }
        }
      } else {
        const targetLangObj = voiceOutputLang !== "same"
          ? SUPPORTED_LANGUAGES.find((l) => l.id === voiceOutputLang)
          : (voiceTargetLang === "auto" ? null : SUPPORTED_LANGUAGES.find((l) => l.id === voiceTargetLang));
        const langParam = targetLangObj ? targetLangObj.name : (voiceTargetLang === "auto" ? "English" : voiceTargetLang);

        const demoRes = await api.demoProcessAudio(
          blob,
          langParam
        );
        text = demoRes.pipeline?.transformation?.finalText?.trim() || demoRes.text?.trim() || "";
      }

      if (!text) {
        throw new Error("No speech detected. Please speak closer to your microphone and try again.");
      }

      setVoiceTranscript(text);
      setVoiceState("completed");
    } catch (err: any) {
      console.error("Voice typing transcription error:", err);
      let friendly = err?.message || "Failed to transcribe audio. Please try again.";
      if (err?.code === "DEMO_RATE_LIMIT_EXCEEDED" || err?.status === 429) {
        friendly = "Guest rate limit reached. Sign in for full quota!";
      }
      setVoiceError(friendly);
      setVoiceState("error");
    }
  };

  const handleVoiceCopy = async () => {
    if (!voiceTranscript) return;
    try {
      await navigator.clipboard.writeText(voiceTranscript);
      showToast("Copied to clipboard!");
    } catch {
      showToast("Could not copy to clipboard.");
    }
  };

  const handleVoiceInsert = () => {
    if (!voiceTranscript) return;
    const el = lastActiveInputRef.current;
    if (el && document.body.contains(el)) {
      try {
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
          const input = el as HTMLInputElement | HTMLTextAreaElement;
          const start = input.selectionStart || input.value.length;
          const end = input.selectionEnd || input.value.length;
          const prev = input.value;
          const next = prev.substring(0, start) + voiceTranscript + prev.substring(end);
          input.value = next;
          input.selectionStart = input.selectionEnd = start + voiceTranscript.length;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          input.focus();
          showToast("Inserted into active field!");
          return;
        } else if (el.isContentEditable) {
          el.focus();
          document.execCommand("insertText", false, voiceTranscript);
          showToast("Inserted into active field!");
          return;
        }
      } catch (err) {
        console.warn("Insert into element failed:", err);
      }
    }

    navigator.clipboard.writeText(voiceTranscript).catch(() => {});
    showToast("Copied to clipboard! (Click any text field to paste)");
  };

  // ==========================================
  // MEETING NOTES AUDIO PIPELINE
  // ==========================================
  const stopMeetingAnalyser = () => {
    if (meetingAnimFrameRef.current) {
      cancelAnimationFrame(meetingAnimFrameRef.current);
      meetingAnimFrameRef.current = null;
    }
    if (meetingAudioCtxRef.current && meetingAudioCtxRef.current.state !== "closed") {
      meetingAudioCtxRef.current.close().catch(() => {});
      meetingAudioCtxRef.current = null;
    }
    meetingAnalyserRef.current = null;
    setMeetingWaveform(new Array(16).fill(0.08));
  };

  const setupMeetingAudioAnalyser = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      meetingAudioCtxRef.current = ctx;

      const sourceNode = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      sourceNode.connect(analyser);
      meetingAnalyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVisualizer = () => {
        if (!meetingAnalyserRef.current) return;
        meetingAnalyserRef.current.getByteFrequencyData(dataArray);

        const bars: number[] = [];
        const step = Math.max(1, Math.floor(dataArray.length / 16));
        for (let i = 0; i < 16; i++) {
          const val = dataArray[i * step] || 0;
          bars.push(Math.max(0.08, Math.min(1, val / 255)));
        }
        setMeetingWaveform(bars);
        meetingAnimFrameRef.current = requestAnimationFrame(updateVisualizer);
      };
      updateVisualizer();
    } catch (err) {
      console.warn("Meeting visualizer error:", err);
    }
  };

  const handleStartMeeting = async () => {
    setMeetingError(null);
    setSourceNotice(null);
    setMeetingDuration(0);
    setIsMeetingPaused(false);
    meetingChunksRef.current = [];

    try {
      const tracksToStop: MediaStreamTrack[] = [];
      let activeStream: MediaStream;

      if (meetingSource === "mic") {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: selectedMicId ? { exact: selectedMicId } : undefined,
            echoCancellation: audioConstraints.echoCancellation,
            noiseSuppression: audioConstraints.noiseSuppression,
            autoGainControl: audioConstraints.autoGainControl
          }
        });
        stream.getTracks().forEach((t) => tracksToStop.push(t));
        activeStream = stream;
        setSourceNotice("Recording via microphone.");
      } else if (meetingSource === "system") {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          throw new Error("System audio capture is not supported in this browser. Please use Chrome or Edge.");
        }
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        displayStream.getVideoTracks().forEach((vt) => vt.stop());
        const audioTracks = displayStream.getAudioTracks();
        if (audioTracks.length === 0) {
          displayStream.getTracks().forEach((t) => t.stop());
          throw new Error("No audio track detected. When sharing tab or screen, remember to check 'Share audio'.");
        }
        audioTracks.forEach((t) => tracksToStop.push(t));
        activeStream = new MediaStream(audioTracks);
        setSourceNotice("Capturing system & meeting tab audio.");
      } else {
        // Combined (Mic + System)
        if (!navigator.mediaDevices?.getDisplayMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t) => tracksToStop.push(t));
          activeStream = stream;
          setSourceNotice("System audio unavailable. Recording with microphone.");
        } else {
          try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: true
            });
            displayStream.getVideoTracks().forEach((vt) => vt.stop());
            const tabAudioTracks = displayStream.getAudioTracks();

            const micStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                deviceId: selectedMicId ? { exact: selectedMicId } : undefined,
                echoCancellation: audioConstraints.echoCancellation,
                noiseSuppression: audioConstraints.noiseSuppression,
                autoGainControl: audioConstraints.autoGainControl
              }
            });

            displayStream.getAudioTracks().forEach((t) => tracksToStop.push(t));
            micStream.getAudioTracks().forEach((t) => tracksToStop.push(t));

            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const mixCtx = new AudioCtx();
            const dest = mixCtx.createMediaStreamDestination();

            if (tabAudioTracks.length > 0) {
              const tabNode = mixCtx.createMediaStreamSource(new MediaStream(tabAudioTracks));
              tabNode.connect(dest);
            }
            const micNode = mixCtx.createMediaStreamSource(micStream);
            micNode.connect(dest);

            activeStream = dest.stream;
            setSourceNotice("Combined: Mixing microphone and meeting attendee audio.");
          } catch (mixErr) {
            console.warn("Combined capture fallback to mic:", mixErr);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((t) => tracksToStop.push(t));
            activeStream = stream;
            setSourceNotice("Screen share cancelled. Recording from microphone.");
          }
        }
      }

      meetingStreamsToCleanupRef.current = () => {
        tracksToStop.forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
      };

      let mimeType = "audio/webm";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        }
      }

      const recorder = new MediaRecorder(activeStream, { mimeType });
      meetingMediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          meetingChunksRef.current.push(event.data);
        }
      };

      setupMeetingAudioAnalyser(activeStream);

      recorder.start(250);
      setMeetingStep("recording");

      if (meetingTimerRef.current) clearInterval(meetingTimerRef.current);
      meetingTimerRef.current = setInterval(() => {
        setMeetingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Meeting audio start error:", err);
      let msg = err?.message || "Failed to start meeting recording. Check microphone permissions.";
      if (err?.name === "NotAllowedError") {
        msg = "Microphone or screen sharing permission denied. Please allow permissions to record.";
      }
      setMeetingError(msg);
      setMeetingStep("setup");
    }
  };

  const handleToggleMeetingPause = () => {
    const rec = meetingMediaRecorderRef.current;
    if (!rec) return;

    if (isMeetingPaused) {
      try {
        rec.resume();
        setIsMeetingPaused(false);
        meetingTimerRef.current = setInterval(() => {
          setMeetingDuration((prev) => prev + 1);
        }, 1000);
      } catch {}
    } else {
      try {
        rec.pause();
        setIsMeetingPaused(true);
        if (meetingTimerRef.current) {
          clearInterval(meetingTimerRef.current);
          meetingTimerRef.current = null;
        }
      } catch {}
    }
  };

  const handleCancelMeeting = () => {
    if (meetingDuration > 5 && !window.confirm("Cancel this meeting recording? Current audio will be discarded.")) {
      return;
    }
    if (meetingTimerRef.current) {
      clearInterval(meetingTimerRef.current);
      meetingTimerRef.current = null;
    }
    stopMeetingAnalyser();
    if (meetingMediaRecorderRef.current) {
      try {
        meetingMediaRecorderRef.current.stop();
      } catch {}
      meetingMediaRecorderRef.current = null;
    }
    if (meetingStreamsToCleanupRef.current) {
      meetingStreamsToCleanupRef.current();
      meetingStreamsToCleanupRef.current = null;
    }
    meetingChunksRef.current = [];
    setMeetingStep("setup");
    setMeetingError(null);
  };

  const populateMeetingEditingBuffers = (m: MeetingRecord) => {
    setEditedSummary(m.fullSummary || m.summaryPreview || "");
    setEditedTopics([...(m.topics || [])]);
    setEditedDecisions([...(m.decisions || [])]);
    setEditedActions([...(m.actionItems || [])]);
  };

  const handleFinishMeeting = async () => {
    if (meetingTimerRef.current) {
      clearInterval(meetingTimerRef.current);
      meetingTimerRef.current = null;
    }
    stopMeetingAnalyser();

    const recorder = meetingMediaRecorderRef.current;
    if (!recorder) return;

    setMeetingStep("processing");
    setMeetingProcessingStage("Finalizing audio recording...");

    try {
      const recordedBlob = await new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          if (meetingChunksRef.current.length === 0) {
            reject(new Error("No audio was recorded."));
            return;
          }
          const blob = new Blob(meetingChunksRef.current, {
            type: recorder.mimeType || "audio/webm"
          });
          resolve(blob);
        };
        try {
          recorder.stop();
        } catch {
          reject(new Error("Failed to stop audio recorder."));
        }
      });

      if (meetingStreamsToCleanupRef.current) {
        meetingStreamsToCleanupRef.current();
        meetingStreamsToCleanupRef.current = null;
      }

      setMeetingProcessingStage("Transcribing speech and extracting notes with AI...");

      const totalSeconds = meetingDuration;
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const durationFormatted =
        hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`;

      let meetingRecord: MeetingRecord | null = null;

      try {
        // Authenticated or guest server-side processing
        const res = await api.processMeetingRecording(
          recordedBlob,
          meetingTitle,
          meetingLanguage === "Auto" ? "English" : meetingLanguage,
          user?.id
        );
        if (res && res.meeting) {
          meetingRecord = res.meeting;
        }
      } catch (backendErr: any) {
        console.warn("processMeetingRecording backend notice, trying transcription + notes synthesis:", backendErr);

        // Fallback: Transcribe audio and generate structured meeting notes via /meeting-notes API
        let transcriptText = "";
        if (user) {
          const trans = await api.transcribeAudio(recordedBlob, "meeting-audio.webm", user.id);
          transcriptText = trans.text?.trim() || "";
        } else {
          const demo = await api.demoProcessAudio(
            recordedBlob,
            meetingLanguage === "Auto" ? "English" : meetingLanguage
          );
          transcriptText = demo.text?.trim() || demo.pipeline?.transformation?.finalText || "";
        }

        if (!transcriptText) {
          throw new Error("No speech detected in the recording. Please speak clearly into your microphone.");
        }

        setMeetingProcessingStage("Generating structured summary, topics, decisions, and action items...");
        let notesResult: any = null;
        try {
          notesResult = await api.generateMeetingNotes(transcriptText, meetingTitle, user?.id);
        } catch (notesErr) {
          console.warn("api.generateMeetingNotes recovery, building structured notes from transcript:", notesErr);
          notesResult = {
            title: meetingTitle || "Recorded Meeting Session",
            summary: transcriptText.length > 300 ? `${transcriptText.slice(0, 300)}...` : transcriptText,
            topics: [{ id: "top_1", title: "Session Discussion", summary: transcriptText.slice(0, 200) }],
            decisions: [],
            actionItems: []
          };
        }

        const now = new Date();
        const id = `meeting_${Date.now()}`;
        meetingRecord = {
          id,
          userId: user?.id || "user_me",
          title: notesResult.title || meetingTitle,
          date: now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          duration: durationFormatted,
          durationSeconds: totalSeconds,
          status: "completed",
          primaryLanguages: [meetingLanguage === "Auto" ? "English" : meetingLanguage],
          summaryPreview: notesResult.summary ? notesResult.summary.slice(0, 160) : `Meeting recorded for ${durationFormatted}.`,
          fullSummary: notesResult.summary,
          participants: [{ id: "p1", name: user?.email?.split("@")[0] || "Organizer", role: "Host", avatar: "" }],
          topics: (notesResult.topics || []).map((t: any, i: number) => ({
            id: `top_${Date.now()}_${i}`,
            title: t.title,
            timeRange: "Session",
            summary: t.summary
          })),
          decisions: (notesResult.decisions || []).map((d: any, i: number) => ({
            id: `dec_${Date.now()}_${i}`,
            decision: d.decision,
            context: d.context
          })),
          actionItems: (notesResult.actionItems || []).map((a: any, i: number) => ({
            id: `act_${Date.now()}_${i}`,
            task: a.task,
            assignee: a.assignee || user?.email?.split("@")[0] || "Team",
            dueDate: a.dueDate || "Next week",
            completed: a.completed || false
          })),
          transcript: [
            {
              id: `u_${Date.now()}_1`,
              speakerId: "s1",
              speakerName: user?.email?.split("@")[0] || "Speaker",
              speakerRole: "Participant",
              isCurrentUser: true,
              timestamp: "00:00",
              originalLanguage: meetingLanguage,
              originalText: transcriptText
            }
          ],
          initialNotes: ""
        };
      }

      if (meetingRecord) {
        saveMeetingToStorage(meetingRecord);
        setCurrentMeeting(meetingRecord);
        populateMeetingEditingBuffers(meetingRecord);
        setMeetingStep("completed");
        showToast("Meeting notes generated successfully!");
      } else {
        throw new Error("Could not process meeting notes.");
      }
    } catch (err: any) {
      console.error("Meeting processing error:", err);
      setMeetingError(err?.message || "Failed to process meeting recording. Please try again.");
      setMeetingStep("setup");
    }
  };

  const handleSaveMeetingEdits = () => {
    if (!currentMeeting) return;
    const updated: MeetingRecord = {
      ...currentMeeting,
      fullSummary: editedSummary,
      summaryPreview: editedSummary.slice(0, 160),
      topics: editedTopics,
      decisions: editedDecisions,
      actionItems: editedActions,
      updatedAt: new Date().toISOString()
    };
    setCurrentMeeting(updated);
    saveMeetingToStorage(updated);
    setIsEditingMeeting(false);
    showToast("Meeting notes saved!");
  };

  const generateMeetingMarkdown = (m: MeetingRecord): string => {
    let md = `# ${m.title}\n\n`;
    md += `**Date:** ${m.date} | **Time:** ${m.time} | **Duration:** ${m.duration}\n\n`;
    md += `## Summary\n${m.fullSummary || m.summaryPreview || "No summary available."}\n\n`;

    if (m.topics && m.topics.length > 0) {
      md += `## Discussion Topics\n`;
      m.topics.forEach((t) => {
        md += `- **${t.title}**${t.timeRange ? ` (${t.timeRange})` : ""}: ${t.summary}\n`;
      });
      md += `\n`;
    }

    if (m.decisions && m.decisions.length > 0) {
      md += `## Key Decisions\n`;
      m.decisions.forEach((d) => {
        md += `- **Decision:** ${d.decision}${d.context ? ` (Context: ${d.context})` : ""}\n`;
      });
      md += `\n`;
    }

    if (m.actionItems && m.actionItems.length > 0) {
      md += `## Action Items\n`;
      m.actionItems.forEach((a) => {
        md += `- [${a.completed ? "x" : " "}] **${a.task}** (Assignee: ${a.assignee || "Unassigned"}${a.dueDate ? `, Due: ${a.dueDate}` : ""})\n`;
      });
      md += `\n`;
    }

    if (m.transcript && m.transcript.length > 0) {
      md += `## Transcript\n`;
      m.transcript.forEach((u) => {
        md += `**${u.speakerName || "Speaker"}** (${u.timestamp || "00:00"}): ${u.originalText}\n\n`;
      });
    }

    return md;
  };

  const handleCopyMeetingMarkdown = async () => {
    if (!currentMeeting) return;
    try {
      const md = generateMeetingMarkdown(currentMeeting);
      await navigator.clipboard.writeText(md);
      showToast("Markdown notes copied!");
    } catch {
      showToast("Could not copy notes.");
    }
  };

  const handleExportMeeting = (format: "md" | "txt") => {
    if (!currentMeeting) return;
    const content = generateMeetingMarkdown(currentMeeting);
    const blob = new Blob([content], { type: format === "md" ? "text/markdown" : "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentMeeting.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported as .${format.toUpperCase()}`);
  };

  // Filtered and sorted meeting history
  const filteredMeetings = useMemo(() => {
    let list = storedMeetings;
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      list = list.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.date.toLowerCase().includes(q) ||
          (m.fullSummary || "").toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (historySort === "title") return a.title.localeCompare(b.title);
      const timeA = new Date(a.date).getTime() || 0;
      const timeB = new Date(b.date).getTime() || 0;
      return historySort === "newest" ? timeB - timeA : timeA - timeB;
    });
  }, [storedMeetings, historySearch, historySort]);

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
  };

  // Check if any recording is active
  const isAnyRecording = voiceState === "recording" || voiceState === "paused" || meetingStep === "recording";

  return (
    <div
      id="voxflow-floating-web-widget"
      ref={widgetContainerRef}
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 99999,
        pointerEvents: "none",
        background: "transparent",
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {/* ================= FLOATING TRIGGER CAPSULE (When Closed) ================= */}
      {!isOpen && 
      (
        <button
          id="voxflow-widget-trigger-btn"
          onClick={() => setIsOpen(true)}
          title="Open VoxFlow Voice Typing & Meeting Notes (⌘ ⇧ X)"
          style={{
            pointerEvents: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "#09090b",
            color: "#ffffff",
            border: isAnyRecording ? "1px solid #ef4444" : "1px solid rgba(255, 255, 255, 0.14)",
            padding: "8px 16px",
            borderRadius: "9999px",
            boxShadow: isAnyRecording
              ? "0 4px 20px rgba(239, 68, 68, 0.35)"
              : "0 4px 20px rgba(0, 0, 0, 0.4)",
            cursor: "pointer",
            fontWeight: 500,
            fontSize: "13px",
            letterSpacing: "-0.01em",
            transition: "all 0.15s ease",
            outline: "none",
            lineHeight: 1,
            boxSizing: "border-box"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = isAnyRecording ? "#ef4444" : "#10b981";
            e.currentTarget.style.boxShadow = isAnyRecording
              ? "0 6px 24px rgba(239, 68, 68, 0.45)"
              : "0 6px 24px rgba(16, 185, 129, 0.25)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = isAnyRecording ? "#ef4444" : "rgba(255, 255, 255, 0.14)";
            e.currentTarget.style.boxShadow = isAnyRecording
              ? "0 4px 20px rgba(239, 68, 68, 0.35)"
              : "0 4px 20px rgba(0, 0, 0, 0.4)";
          }}
        >
          {/* Emerald Green Microphone Icon or Pulsing Red Recording Dot */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "18px",
              height: "18px"
            }}
          >
            {isAnyRecording ? (
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: "#ef4444",
                  display: "inline-block",
                  boxShadow: "0 0 8px #ef4444"
                }}
              />
            ) : (
              <svg
                style={{
                  width: "16px",
                  height: "16px",
                  stroke: "#10b981",
                  fill: "none",
                  strokeWidth: 2.2,
                  strokeLinecap: "round",
                  strokeLinejoin: "round"
                }}
                viewBox="0 0 24 24"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            )}
          </div>

          {/* White VoxFlow Branding */}
          <span style={{ fontWeight: 600, color: "#ffffff", fontSize: "13px" }}>
            {voiceState === "recording" || voiceState === "paused"
              ? `REC ${formatTimer(voiceDuration)}`
              : meetingStep === "recording"
              ? `REC ${formatTimer(meetingDuration)}`
              : "VoxFlow"}
          </span>

          {/* Keyboard Shortcut Badge */}
          <span
            style={{
              background: "#18181b",
              color: "#a1a1aa",
              fontSize: "10px",
              fontWeight: 600,
              padding: "3px 6px",
              borderRadius: "4px",
              border: "1px solid #27272a",
              letterSpacing: "0.04em",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
            }}
          >
            ⌘ ⇧ X
          </span>
        </button>
      )}

      {/* ================= EXPANDED WIDGET PANEL ================= */}
      {isOpen && (
        <div
          id="voxflow-widget-panel"
          style={{
            width:
              (activeMode === "meeting" && (meetingStep === "completed" || meetingStep === "history")) ||
              activeMode === "history" ||
              activeMode === "settings"
                ? "540px"
                : "440px",
            pointerEvents: "auto",
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "88vh",
            display: "flex",
            flexDirection: "column",
            background: "#0a0a0c",
            color: "#fafafa",
            border: "1px solid #27272a",
            borderRadius: "16px",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.7), 0 4px 16px rgba(0, 0, 0, 0.5)",
            overflow: "hidden",
            transition: "width 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
          }}
        >
          {/* HEADER & BRAND */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: "1px solid #1e1e24",
              background: "#0e0e11"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "6px",
                  background: "#10b981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "12px",
                  color: "#09090b"
                }}
              >
                V
              </div>
              <span style={{ fontWeight: 600, fontSize: "14px", letterSpacing: "-0.01em", color: "#ffffff" }}>
                VoxFlow
              </span>
              {isPremium && (
                <span
                  style={{
                    background: "rgba(16, 185, 129, 0.15)",
                    color: "#10b981",
                    fontSize: "10px",
                    fontWeight: 600,
                    padding: "2px 6px",
                    borderRadius: "4px",
                    border: "1px solid rgba(16, 185, 129, 0.3)"
                  }}
                >
                  PRO
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {isAnyRecording && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "11px",
                    color: "#ef4444",
                    fontWeight: 600,
                    background: "rgba(239, 68, 68, 0.12)",
                    padding: "3px 8px",
                    borderRadius: "9999px"
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "#ef4444"
                    }}
                  />
                  REC Active
                </span>
              )}
              <button
                id="voxflow-widget-close-btn"
                onClick={() => setIsOpen(false)}
                title="Minimize widget (⌘ ⇧ X)"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#71717a",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  fontSize: "16px",
                  lineHeight: 1
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#71717a")}
              >
                ✕
              </button>
            </div>
          </div>

          {/* SEGMENTED NAVIGATION TABS */}
          <div
            style={{
              display: "flex",
              background: "#141417",
              borderBottom: "1px solid #27272a",
              padding: "4px",
              gap: "4px"
            }}
          >
            <button
              id="voxflow-tab-voice"
              onClick={() => setActiveMode("voice")}
              style={{
                flex: 1,
                padding: "8px 6px",
                border: "none",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
                background: activeMode === "voice" ? "#0a0a0c" : "transparent",
                color: activeMode === "voice" ? "#ffffff" : "#a1a1aa",
                boxShadow: activeMode === "voice" ? "0 2px 8px rgba(0,0,0,0.5)" : "none",
                transition: "all 0.15s ease"
              }}
            >
              <span>🎙️</span>
              <span>Voice Typing</span>
              {(voiceState === "recording" || voiceState === "paused") && (
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ef4444" }} />
              )}
            </button>
            <button
              id="voxflow-tab-meeting"
              onClick={() => {
                setActiveMode("meeting");
                if (meetingStep === "history") {
                  setMeetingStep(currentMeeting ? "completed" : "setup");
                }
              }}
              style={{
                flex: 1,
                padding: "8px 6px",
                border: "none",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
                background: activeMode === "meeting" ? "#0a0a0c" : "transparent",
                color: activeMode === "meeting" ? "#ffffff" : "#a1a1aa",
                boxShadow: activeMode === "meeting" ? "0 2px 8px rgba(0,0,0,0.5)" : "none",
                transition: "all 0.15s ease"
              }}
            >
              <span>👥</span>
              <span>Meeting Notes</span>
              {meetingStep === "recording" && (
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ef4444" }} />
              )}
            </button>
            <button
              id="voxflow-tab-history"
              onClick={() => setActiveMode("history")}
              style={{
                flex: 1,
                padding: "8px 6px",
                border: "none",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
                background: activeMode === "history" ? "#0a0a0c" : "transparent",
                color: activeMode === "history" ? "#ffffff" : "#a1a1aa",
                boxShadow: activeMode === "history" ? "0 2px 8px rgba(0,0,0,0.5)" : "none",
                transition: "all 0.15s ease"
              }}
            >
              <span>📁</span>
              <span>History ({storedMeetings.length})</span>
            </button>
            <button
              id="voxflow-tab-settings"
              onClick={() => setActiveMode("settings")}
              style={{
                padding: "8px 10px",
                border: "none",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                background: activeMode === "settings" ? "#0a0a0c" : "transparent",
                color: activeMode === "settings" ? "#ffffff" : "#a1a1aa",
                boxShadow: activeMode === "settings" ? "0 2px 8px rgba(0,0,0,0.5)" : "none",
                transition: "all 0.15s ease"
              }}
            >
              <span>⚙️</span>
              <span>Settings</span>
            </button>
          </div>

          {/* ======================================================== */}
          {/* TAB 1: VOICE TYPING EXPERIENCE                          */}
          {/* ======================================================== */}
          {activeMode === "voice" && (
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Spoken Language & Output Language Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "11px", color: "#a1a1aa", fontWeight: 500 }}>
                    Spoken Language
                  </label>
                  <select
                    id="voxflow-voice-lang-select"
                    value={voiceTargetLang}
                    onChange={(e) => {
                      setVoiceTargetLang(e.target.value);
                      try {
                        localStorage.setItem("voxflow_pref_lang", e.target.value);
                      } catch {}
                    }}
                    disabled={voiceState === "recording" || voiceState === "transcribing"}
                    style={{
                      background: "#18181b",
                      color: "#fafafa",
                      border: "1px solid #27272a",
                      borderRadius: "6px",
                      padding: "6px 8px",
                      fontSize: "12px",
                      cursor: "pointer",
                      outline: "none"
                    }}
                  >
                    <option value="auto">Auto (Contextual)</option>
                    {SUPPORTED_LANGUAGES.filter((l) => l.id !== "auto").map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "11px", color: "#a1a1aa", fontWeight: 500 }}>
                    Output Language
                  </label>
                  <select
                    id="voxflow-voice-output-lang-select"
                    value={voiceOutputLang}
                    onChange={(e) => {
                      setVoiceOutputLang(e.target.value);
                      setPreferredOutputLang(e.target.value);
                      try {
                        localStorage.setItem("voxflow_pref_output_lang", e.target.value);
                      } catch {}
                    }}
                    disabled={voiceState === "recording" || voiceState === "transcribing"}
                    style={{
                      background: "#18181b",
                      color: "#fafafa",
                      border: "1px solid #27272a",
                      borderRadius: "6px",
                      padding: "6px 8px",
                      fontSize: "12px",
                      cursor: "pointer",
                      outline: "none"
                    }}
                  >
                    <option value="same">Same as Spoken</option>
                    {SUPPORTED_LANGUAGES.filter((l) => l.id !== "auto").map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Microphone Input Selector Row */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "11px", color: "#a1a1aa", fontWeight: 500 }}>
                  Microphone Input
                </label>
                <select
                  value={selectedMicId}
                  onChange={(e) => {
                    setSelectedMicId(e.target.value);
                    try {
                      localStorage.setItem("voxflow_pref_mic", e.target.value);
                    } catch {}
                  }}
                  disabled={voiceState === "recording" || voiceState === "transcribing"}
                  style={{
                    background: "#18181b",
                    color: "#fafafa",
                    border: "1px solid #27272a",
                    borderRadius: "6px",
                    padding: "6px 8px",
                    fontSize: "12px",
                    cursor: "pointer",
                    outline: "none"
                  }}
                >
                  <option value="">Default Microphone</option>
                  {audioDevices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Microphone ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status & Error Notice */}
              {voiceError && (
                <div
                  style={{
                    background: "#2a1215",
                    border: "1px solid #7f1d1d",
                    color: "#fecaca",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}
                >
                  <span>{voiceError}</span>
                  <button
                    onClick={() => setVoiceError(null)}
                    style={{ background: "transparent", border: "none", color: "#fecaca", cursor: "pointer", fontSize: "12px" }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* IDLE STATE */}
              {voiceState === "idle" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "12px",
                    padding: "20px 0"
                  }}
                >
                  <button
                    id="voxflow-voice-start-btn"
                    onClick={handleVoiceStart}
                    style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "50%",
                      background: "#10b981",
                      border: "none",
                      color: "#09090b",
                      fontSize: "24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      boxShadow: "0 6px 20px rgba(16, 185, 129, 0.4)",
                      transition: "transform 0.15s ease"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.06)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  >
                    🎙️
                  </button>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "14px", fontWeight: 600 }}>Click to speak</div>
                    <div style={{ fontSize: "12px", color: "#71717a", marginTop: "2px" }}>
                      Speaks naturally in any language — text is inserted into focused input
                    </div>
                  </div>
                </div>
              )}

              {/* RECORDING / PAUSED STATE */}
              {(voiceState === "recording" || voiceState === "paused") && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "14px",
                    padding: "16px 0"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: voiceState === "paused" ? "#eab308" : "#10b981",
                        boxShadow: voiceState === "paused" ? "0 0 10px #eab308" : "0 0 10px #10b981"
                      }}
                    />
                    <span style={{ fontSize: "18px", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {formatTimer(voiceDuration)}
                    </span>
                    <span style={{ fontSize: "11px", color: "#a1a1aa" }}>
                      {voiceState === "paused" ? "(Paused)" : "(Listening)"}
                    </span>
                  </div>

                  {/* 16-Bar Waveform */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                      height: "44px",
                      width: "100%",
                      padding: "0 24px"
                    }}
                  >
                    {voiceWaveform.map((bar, i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          height: voiceState === "paused" ? "8px" : `${Math.max(8, bar * 42)}px`,
                          background: voiceState === "paused" ? "#71717a" : "#10b981",
                          borderRadius: "9999px",
                          transition: "height 0.08s ease"
                        }}
                      />
                    ))}
                  </div>

                  {/* Voice Controls: Pause / Stop / Cancel */}
                  <div style={{ display: "flex", gap: "8px", width: "100%", maxWidth: "340px" }}>
                    {voiceState === "recording" ? (
                      <button
                        onClick={handleVoicePause}
                        style={{
                          flex: 1,
                          background: "#18181b",
                          color: "#fafafa",
                          border: "1px solid #27272a",
                          borderRadius: "8px",
                          padding: "10px",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer"
                        }}
                      >
                        ⏸ Pause
                      </button>
                    ) : (
                      <button
                        onClick={handleVoiceResume}
                        style={{
                          flex: 1,
                          background: "#18181b",
                          color: "#10b981",
                          border: "1px solid #10b981",
                          borderRadius: "8px",
                          padding: "10px",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer"
                        }}
                      >
                        ▶ Resume
                      </button>
                    )}
                    <button
                      id="voxflow-voice-stop-btn"
                      onClick={handleVoiceStop}
                      style={{
                        flex: 1.5,
                        background: "#10b981",
                        color: "#09090b",
                        border: "none",
                        borderRadius: "8px",
                        padding: "10px",
                        fontWeight: 600,
                        fontSize: "13px",
                        cursor: "pointer"
                      }}
                    >
                      ⏹ Stop & Transcribe
                    </button>
                    <button
                      id="voxflow-voice-cancel-btn"
                      onClick={handleVoiceCancel}
                      style={{
                        background: "transparent",
                        color: "#71717a",
                        border: "1px solid #27272a",
                        borderRadius: "8px",
                        padding: "10px 14px",
                        fontSize: "13px",
                        cursor: "pointer"
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* TRANSCRIBING STATE */}
              {voiceState === "transcribing" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "12px",
                    padding: "28px 0"
                  }}
                >
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      border: "3px solid #27272a",
                      borderTopColor: "#10b981",
                      animation: "spin 0.8s linear infinite"
                    }}
                  />
                  <div style={{ fontSize: "13px", color: "#a1a1aa", fontWeight: 500 }}>
                    Transcribing speech with AI...
                  </div>
                </div>
              )}

              {/* COMPLETED STATE */}
              {voiceState === "completed" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", color: "#a1a1aa", fontWeight: 600 }}>
                      Transcript Output:
                    </span>
                    <button
                      onClick={() => setVoiceTranscript("")}
                      style={{ background: "transparent", border: "none", color: "#71717a", fontSize: "11px", cursor: "pointer" }}
                    >
                      Clear
                    </button>
                  </div>
                  <textarea
                    id="voxflow-voice-transcript-output"
                    value={voiceTranscript}
                    onChange={(e) => setVoiceTranscript(e.target.value)}
                    placeholder="Transcribed text..."
                    rows={4}
                    style={{
                      width: "100%",
                      background: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      fontSize: "13px",
                      lineHeight: "1.5",
                      color: "#fafafa",
                      resize: "vertical",
                      outline: "none",
                      boxSizing: "border-box",
                      fontFamily: "inherit"
                    }}
                  />

                  <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                    <button
                      id="voxflow-voice-insert-btn"
                      onClick={handleVoiceInsert}
                      style={{
                        flex: 1.5,
                        background: "#10b981",
                        color: "#09090b",
                        border: "none",
                        borderRadius: "8px",
                        padding: "9px 12px",
                        fontWeight: 600,
                        fontSize: "12px",
                        cursor: "pointer"
                      }}
                    >
                      ↵ Insert into Field
                    </button>
                    <button
                      id="voxflow-voice-copy-btn"
                      onClick={handleVoiceCopy}
                      style={{
                        background: "#18181b",
                        color: "#fafafa",
                        border: "1px solid #27272a",
                        borderRadius: "8px",
                        padding: "9px 14px",
                        fontWeight: 500,
                        fontSize: "12px",
                        cursor: "pointer"
                      }}
                    >
                      📋 Copy
                    </button>
                    <button
                      id="voxflow-voice-reset-btn"
                      onClick={() => {
                        setVoiceTranscript("");
                        setVoiceState("idle");
                      }}
                      style={{
                        background: "transparent",
                        color: "#71717a",
                        border: "1px solid #27272a",
                        borderRadius: "8px",
                        padding: "9px 12px",
                        fontSize: "12px",
                        cursor: "pointer"
                      }}
                    >
                      New
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: MEETING NOTES EXPERIENCE                         */}
          {/* ======================================================== */}
          {activeMode === "meeting" && (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
              {/* MEETING SETUP VIEW */}
              {meetingStep === "setup" && (
                <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600 }}>Create Meeting Session</span>
                    <button
                      onClick={() => setActiveMode("history")}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#10b981",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      📁 Past Meetings ({storedMeetings.length})
                    </button>
                  </div>

                  {meetingError && (
                    <div
                      style={{
                        background: "#2a1215",
                        border: "1px solid #7f1d1d",
                        color: "#fecaca",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between"
                      }}
                    >
                      <span>{meetingError}</span>
                      <button
                        onClick={() => setMeetingError(null)}
                        style={{ background: "transparent", border: "none", color: "#fecaca", cursor: "pointer", fontSize: "12px" }}
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Meeting Title Input */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "12px", color: "#a1a1aa", fontWeight: 500 }}>
                      Meeting Title
                    </label>
                    <input
                      id="voxflow-meeting-title-input"
                      type="text"
                      value={meetingTitle}
                      onChange={(e) => setMeetingTitle(e.target.value)}
                      placeholder="e.g. Sprint Planning, Client Review"
                      style={{
                        background: "#18181b",
                        border: "1px solid #27272a",
                        color: "#fafafa",
                        borderRadius: "8px",
                        padding: "8px 12px",
                        fontSize: "13px",
                        outline: "none"
                      }}
                    />
                  </div>

                  {/* Audio Source Selection */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "12px", color: "#a1a1aa", fontWeight: 500 }}>
                      Audio Capture Source
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => setMeetingSource("mic")}
                        style={{
                          background: meetingSource === "mic" ? "#062419" : "#18181b",
                          border: `1px solid ${meetingSource === "mic" ? "#10b981" : "#27272a"}`,
                          color: meetingSource === "mic" ? "#10b981" : "#a1a1aa",
                          borderRadius: "8px",
                          padding: "8px 6px",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        <span style={{ fontSize: "14px" }}>🎙️</span>
                        <span>Microphone</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMeetingSource("system")}
                        style={{
                          background: meetingSource === "system" ? "#062419" : "#18181b",
                          border: `1px solid ${meetingSource === "system" ? "#10b981" : "#27272a"}`,
                          color: meetingSource === "system" ? "#10b981" : "#a1a1aa",
                          borderRadius: "8px",
                          padding: "8px 6px",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        <span style={{ fontSize: "14px" }}>🔊</span>
                        <span>Tab / System</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMeetingSource("combined")}
                        style={{
                          background: meetingSource === "combined" ? "#062419" : "#18181b",
                          border: `1px solid ${meetingSource === "combined" ? "#10b981" : "#27272a"}`,
                          color: meetingSource === "combined" ? "#10b981" : "#a1a1aa",
                          borderRadius: "8px",
                          padding: "8px 6px",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        <span style={{ fontSize: "14px" }}>🎙️+🔊</span>
                        <span>Combined</span>
                      </button>
                    </div>

                    <div style={{ fontSize: "11px", color: "#71717a", marginTop: "2px", lineHeight: "1.4" }}>
                      {meetingSource === "mic" && "Captures your local microphone audio only. (Microphone cannot record remote meeting participants due to browser security)."}
                      {meetingSource === "system" && "Captures remote attendees from the shared meeting tab. Remember to check 'Share tab audio'."}
                      {meetingSource === "combined" && "Captures both your microphone and meeting tab audio simultaneously."}
                    </div>
                  </div>

                  {/* Language Selection */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <label style={{ fontSize: "12px", color: "#a1a1aa", fontWeight: 500 }}>
                      Meeting Language
                    </label>
                    <select
                      id="voxflow-meeting-lang-select"
                      value={meetingLanguage}
                      onChange={(e) => setMeetingLanguage(e.target.value)}
                      style={{
                        background: "#18181b",
                        color: "#fafafa",
                        border: "1px solid #27272a",
                        borderRadius: "6px",
                        padding: "4px 8px",
                        fontSize: "12px",
                        cursor: "pointer"
                      }}
                    >
                      <option value="Auto">Auto (Auto-detect)</option>
                      <option value="English">English</option>
                      <option value="Spanish">Spanish</option>
                      <option value="French">French</option>
                      <option value="German">German</option>
                      <option value="Hindi">Hindi</option>
                      <option value="Hinglish">Hinglish</option>
                      <option value="Japanese">Japanese</option>
                    </select>
                  </div>

                  <button
                    id="voxflow-meeting-start-btn"
                    onClick={handleStartMeeting}
                    style={{
                      background: "#10b981",
                      color: "#09090b",
                      border: "none",
                      borderRadius: "8px",
                      padding: "12px",
                      fontWeight: 600,
                      fontSize: "13px",
                      cursor: "pointer",
                      marginTop: "6px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px"
                    }}
                  >
                    <span>🔴</span>
                    <span>Start Meeting Recording</span>
                  </button>
                </div>
              )}

              {/* RECORDING IN PROGRESS VIEW */}
              {meetingStep === "recording" && (
                <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        background: isMeetingPaused ? "#eab308" : "#ef4444",
                        boxShadow: isMeetingPaused ? "0 0 10px #eab308" : "0 0 10px #ef4444"
                      }}
                    />
                    <span style={{ fontSize: "13px", color: "#a1a1aa", fontWeight: 500 }}>
                      {isMeetingPaused ? "Recording Paused" : "Meeting Recording in progress..."}
                    </span>
                  </div>

                  <div style={{ fontSize: "28px", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                    {formatTimer(meetingDuration)}
                  </div>

                  {/* Real-Time Waveform */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                      height: "48px",
                      width: "100%",
                      padding: "0 20px"
                    }}
                  >
                    {meetingWaveform.map((bar, i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          height: isMeetingPaused ? "8px" : `${Math.max(8, bar * 46)}px`,
                          background: isMeetingPaused ? "#71717a" : "#10b981",
                          borderRadius: "9999px",
                          transition: "height 0.08s ease"
                        }}
                      />
                    ))}
                  </div>

                  {sourceNotice && (
                    <div style={{ fontSize: "11px", color: "#a1a1aa", textAlign: "center" }}>
                      {sourceNotice}
                    </div>
                  )}

                  {/* Controls: Pause / Stop & Process / Cancel */}
                  <div style={{ display: "flex", gap: "8px", width: "100%", maxWidth: "340px" }}>
                    <button
                      id="voxflow-meeting-pause-btn"
                      onClick={handleToggleMeetingPause}
                      style={{
                        flex: 1,
                        background: "#18181b",
                        border: "1px solid #27272a",
                        color: "#fafafa",
                        borderRadius: "8px",
                        padding: "10px",
                        fontWeight: 600,
                        fontSize: "12px",
                        cursor: "pointer"
                      }}
                    >
                      {isMeetingPaused ? "▶ Resume" : "⏸ Pause"}
                    </button>
                    <button
                      id="voxflow-meeting-stop-btn"
                      onClick={handleFinishMeeting}
                      style={{
                        flex: 1.5,
                        background: "#10b981",
                        border: "none",
                        color: "#09090b",
                        borderRadius: "8px",
                        padding: "10px",
                        fontWeight: 600,
                        fontSize: "12px",
                        cursor: "pointer"
                      }}
                    >
                      ⏹ Stop & Process
                    </button>
                    <button
                      id="voxflow-meeting-cancel-btn"
                      onClick={handleCancelMeeting}
                      style={{
                        background: "transparent",
                        border: "1px solid #27272a",
                        color: "#71717a",
                        borderRadius: "8px",
                        padding: "10px",
                        fontSize: "12px",
                        cursor: "pointer"
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* PROCESSING VIEW */}
              {meetingStep === "processing" && (
                <div style={{ padding: "36px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      border: "3px solid #27272a",
                      borderTopColor: "#10b981",
                      animation: "spin 0.8s linear infinite"
                    }}
                  />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "14px", fontWeight: 600 }}>Processing Meeting Audio</div>
                    <div style={{ fontSize: "12px", color: "#71717a", marginTop: "4px" }}>
                      {meetingProcessingStage}
                    </div>
                  </div>
                </div>
              )}

              {/* COMPLETED MEETING NOTES VIEW */}
              {meetingStep === "completed" && currentMeeting && (
                <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                  {/* Title and Top Export Bar */}
                  <div
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid #27272a",
                      background: "#0e0e11",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between"
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "14px", color: "#fafafa" }}>{currentMeeting.title}</div>
                      <div style={{ fontSize: "11px", color: "#71717a" }}>
                        {currentMeeting.date} • {currentMeeting.duration}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={handleCopyMeetingMarkdown}
                        title="Copy Markdown"
                        style={{
                          background: "#18181b",
                          border: "1px solid #27272a",
                          color: "#fafafa",
                          borderRadius: "6px",
                          padding: "4px 8px",
                          fontSize: "11px",
                          fontWeight: 500,
                          cursor: "pointer"
                        }}
                      >
                        📋 Copy
                      </button>
                      <button
                        onClick={() => handleExportMeeting("md")}
                        title="Export as Markdown"
                        style={{
                          background: "#18181b",
                          border: "1px solid #27272a",
                          color: "#fafafa",
                          borderRadius: "6px",
                          padding: "4px 8px",
                          fontSize: "11px",
                          fontWeight: 500,
                          cursor: "pointer"
                        }}
                      >
                        📥 .MD
                      </button>
                      <button
                        onClick={() => handleExportMeeting("txt")}
                        title="Export as Text"
                        style={{
                          background: "#18181b",
                          border: "1px solid #27272a",
                          color: "#fafafa",
                          borderRadius: "6px",
                          padding: "4px 8px",
                          fontSize: "11px",
                          fontWeight: 500,
                          cursor: "pointer"
                        }}
                      >
                        📥 .TXT
                      </button>
                    </div>
                  </div>

                  {/* 6 Section Tabs: Overview | Summary | Topics | Decisions | Action Items | Transcript */}
                  <div
                    style={{
                      display: "flex",
                      borderBottom: "1px solid #27272a",
                      background: "#141417",
                      fontSize: "12px"
                    }}
                  >
                    {[
                      { id: "overview", label: "Overview" },
                      { id: "summary", label: "Summary" },
                      { id: "topics", label: `Topics (${currentMeeting.topics?.length || 0})` },
                      { id: "decisions", label: `Decisions (${currentMeeting.decisions?.length || 0})` },
                      { id: "actions", label: `Actions (${currentMeeting.actionItems?.length || 0})` },
                      { id: "transcript", label: "Transcript" }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setMeetingTab(tab.id as any)}
                        style={{
                          flex: 1,
                          padding: "8px 4px",
                          border: "none",
                          borderBottom: meetingTab === tab.id ? "2px solid #10b981" : "2px solid transparent",
                          background: "transparent",
                          color: meetingTab === tab.id ? "#10b981" : "#a1a1aa",
                          fontWeight: meetingTab === tab.id ? 600 : 400,
                          cursor: "pointer",
                          fontSize: "11px",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Content Panels */}
                  <div style={{ padding: "14px", flex: 1, overflowY: "auto", fontSize: "13px", lineHeight: "1.5" }}>
                    {/* OVERVIEW TAB */}
                    {meetingTab === "overview" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {/* Metrics Grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                          <div style={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "8px", padding: "10px", textAlign: "center" }}>
                            <div style={{ fontSize: "18px", fontWeight: 700, color: "#10b981" }}>
                              {currentMeeting.topics?.length || 0}
                            </div>
                            <div style={{ fontSize: "11px", color: "#a1a1aa", marginTop: "2px" }}>Key Topics</div>
                          </div>
                          <div style={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "8px", padding: "10px", textAlign: "center" }}>
                            <div style={{ fontSize: "18px", fontWeight: 700, color: "#3b82f6" }}>
                              {currentMeeting.decisions?.length || 0}
                            </div>
                            <div style={{ fontSize: "11px", color: "#a1a1aa", marginTop: "2px" }}>Decisions</div>
                          </div>
                          <div style={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "8px", padding: "10px", textAlign: "center" }}>
                            <div style={{ fontSize: "18px", fontWeight: 700, color: "#f59e0b" }}>
                              {currentMeeting.actionItems?.length || 0}
                            </div>
                            <div style={{ fontSize: "11px", color: "#a1a1aa", marginTop: "2px" }}>Actions</div>
                          </div>
                        </div>

                        {/* Executive Summary Card */}
                        <div style={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "8px", padding: "12px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <span style={{ fontSize: "12px", fontWeight: 600, color: "#fafafa" }}>Executive Brief</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(currentMeeting.summaryPreview || currentMeeting.fullSummary || "");
                                showToast("Executive brief copied!");
                              }}
                              style={{ background: "transparent", border: "none", color: "#10b981", fontSize: "11px", cursor: "pointer", fontWeight: 500 }}
                            >
                              📋 Copy Brief
                            </button>
                          </div>
                          <p style={{ margin: 0, fontSize: "12px", color: "#d4d4d8", lineHeight: "1.5" }}>
                            {currentMeeting.summaryPreview || currentMeeting.fullSummary || "No summary available."}
                          </p>
                        </div>

                        {/* Top Actions Preview */}
                        {currentMeeting.actionItems && currentMeeting.actionItems.length > 0 && (
                          <div style={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "8px", padding: "12px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                              <span style={{ fontSize: "12px", fontWeight: 600, color: "#fafafa" }}>Top Action Items</span>
                              <button
                                onClick={() => setMeetingTab("actions")}
                                style={{ background: "transparent", border: "none", color: "#10b981", fontSize: "11px", cursor: "pointer" }}
                              >
                                View all →
                              </button>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              {currentMeeting.actionItems.slice(0, 3).map((act, idx) => (
                                <div key={act.id || idx} style={{ fontSize: "12px", color: "#d4d4d8", display: "flex", alignItems: "flex-start", gap: "6px" }}>
                                  <span style={{ color: "#f59e0b" }}>•</span>
                                  <span>{act.task} {act.assignee ? <span style={{ color: "#71717a" }}>({act.assignee})</span> : null}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SUMMARY TAB */}
                    {meetingTab === "summary" && (
                      <div>
                        {isEditingMeeting ? (
                          <textarea
                            value={editedSummary}
                            onChange={(e) => setEditedSummary(e.target.value)}
                            style={{
                              width: "100%",
                              height: "180px",
                              background: "#18181b",
                              border: "1px solid #27272a",
                              color: "#fafafa",
                              borderRadius: "8px",
                              padding: "10px",
                              fontSize: "12px",
                              lineHeight: "1.5",
                              resize: "vertical",
                              fontFamily: "inherit"
                            }}
                          />
                        ) : (
                          <div style={{ whiteSpace: "pre-wrap", color: "#e4e4e7" }}>
                            {currentMeeting.fullSummary || currentMeeting.summaryPreview || "No summary available."}
                          </div>
                        )}
                      </div>
                    )}

                    {/* TOPICS TAB */}
                    {meetingTab === "topics" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {(currentMeeting.topics || []).length === 0 ? (
                          <div style={{ color: "#71717a", fontSize: "12px" }}>No discussion topics recorded.</div>
                        ) : (
                          (currentMeeting.topics || []).map((t, idx) => (
                            <div
                              key={t.id || idx}
                              style={{
                                background: "#18181b",
                                border: "1px solid #27272a",
                                borderRadius: "8px",
                                padding: "10px 12px"
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ fontWeight: 600, fontSize: "12px", color: "#10b981" }}>
                                  {t.title} {t.timeRange && <span style={{ color: "#71717a" }}>({t.timeRange})</span>}
                                </div>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(`${t.title}: ${t.summary}`);
                                    showToast("Topic copied!");
                                  }}
                                  title="Copy topic"
                                  style={{ background: "transparent", border: "none", color: "#71717a", fontSize: "11px", cursor: "pointer" }}
                                >
                                  📋 Copy
                                </button>
                              </div>
                              <div style={{ fontSize: "12px", color: "#d4d4d8", marginTop: "4px" }}>
                                {t.summary}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* DECISIONS TAB */}
                    {meetingTab === "decisions" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {(currentMeeting.decisions || []).length === 0 ? (
                          <div style={{ color: "#71717a", fontSize: "12px" }}>No key decisions recorded.</div>
                        ) : (
                          (currentMeeting.decisions || []).map((d, idx) => (
                            <div
                              key={d.id || idx}
                              style={{
                                background: "#18181b",
                                border: "1px solid #27272a",
                                borderRadius: "8px",
                                padding: "10px 12px"
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ fontWeight: 600, fontSize: "12px" }}>✓ {d.decision}</div>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(d.decision + (d.context ? ` (${d.context})` : ""));
                                    showToast("Decision copied!");
                                  }}
                                  title="Copy decision"
                                  style={{ background: "transparent", border: "none", color: "#71717a", fontSize: "11px", cursor: "pointer" }}
                                >
                                  📋 Copy
                                </button>
                              </div>
                              {d.context && (
                                <div style={{ fontSize: "11px", color: "#71717a", marginTop: "2px" }}>
                                  Context: {d.context}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* ACTION ITEMS TAB */}
                    {meetingTab === "actions" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {(currentMeeting.actionItems || []).length > 0 && (
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <button
                              onClick={() => {
                                const allActions = (currentMeeting.actionItems || [])
                                  .map((a) => `• ${a.task} (${a.assignee || "Team"}${a.dueDate ? `, Due: ${a.dueDate}` : ""})`)
                                  .join("\n");
                                navigator.clipboard.writeText(allActions);
                                showToast("All action items copied!");
                              }}
                              style={{ background: "transparent", border: "none", color: "#10b981", fontSize: "11px", cursor: "pointer", fontWeight: 500 }}
                            >
                              📋 Copy All Actions
                            </button>
                          </div>
                        )}
                        {(currentMeeting.actionItems || []).length === 0 ? (
                          <div style={{ color: "#71717a", fontSize: "12px" }}>No action items recorded.</div>
                        ) : (
                          (currentMeeting.actionItems || []).map((a, idx) => (
                            <div
                              key={a.id || idx}
                              style={{
                                background: "#18181b",
                                border: "1px solid #27272a",
                                borderRadius: "8px",
                                padding: "10px 12px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between"
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 500, fontSize: "12px" }}>• {a.task}</div>
                                <div style={{ fontSize: "11px", color: "#71717a" }}>
                                  Assignee: {a.assignee || "Team"}{a.dueDate ? ` • Due: ${a.dueDate}` : ""}
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(`${a.task} [Assignee: ${a.assignee || "Team"}]`);
                                  showToast("Action item copied!");
                                }}
                                title="Copy action"
                                style={{ background: "transparent", border: "none", color: "#71717a", fontSize: "11px", cursor: "pointer" }}
                              >
                                📋
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* TRANSCRIPT TAB */}
                    {meetingTab === "transcript" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {(currentMeeting.transcript || []).length > 0 && (
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <button
                              onClick={() => {
                                const allT = (currentMeeting.transcript || [])
                                  .map((u) => `${u.speakerName || "Speaker"} (${u.timestamp || "00:00"}): ${u.originalText}`)
                                  .join("\n\n");
                                navigator.clipboard.writeText(allT);
                                showToast("Transcript copied!");
                              }}
                              style={{ background: "transparent", border: "none", color: "#10b981", fontSize: "11px", cursor: "pointer", fontWeight: 500 }}
                            >
                              📋 Copy Transcript
                            </button>
                          </div>
                        )}
                        {(currentMeeting.transcript || []).length === 0 ? (
                          <div style={{ color: "#71717a", fontSize: "12px" }}>No transcript entries.</div>
                        ) : (
                          (currentMeeting.transcript || []).map((u, idx) => (
                            <div
                              key={u.id || idx}
                              style={{
                                borderBottom: "1px solid #1e1e24",
                                paddingBottom: "8px"
                              }}
                            >
                              <div style={{ fontSize: "11px", color: "#71717a", fontWeight: 600 }}>
                                {u.speakerName || "Speaker"} • {u.timestamp || "00:00"}
                              </div>
                              <div style={{ fontSize: "12px", color: "#d4d4d8", marginTop: "2px" }}>
                                {u.originalText}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bottom Footer Actions */}
                  <div
                    style={{
                      padding: "10px 14px",
                      borderTop: "1px solid #27272a",
                      background: "#0e0e11",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between"
                    }}
                  >
                    {isEditingMeeting ? (
                      <button
                        onClick={handleSaveMeetingEdits}
                        style={{
                          background: "#10b981",
                          border: "none",
                          color: "#09090b",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer"
                        }}
                      >
                        💾 Save Edits
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsEditingMeeting(true)}
                        style={{
                          background: "#18181b",
                          border: "1px solid #27272a",
                          color: "#fafafa",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          fontSize: "12px",
                          cursor: "pointer"
                        }}
                      >
                        ✏️ Edit Notes
                      </button>
                    )}

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => setActiveMode("history")}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#a1a1aa",
                          fontSize: "12px",
                          cursor: "pointer"
                        }}
                      >
                        All Meetings
                      </button>
                      <button
                        onClick={() => {
                          setCurrentMeeting(null);
                          setMeetingStep("setup");
                        }}
                        style={{
                          background: "#10b981",
                          border: "none",
                          color: "#09090b",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer"
                        }}
                      >
                        + New Meeting
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: PAST MEETINGS HISTORY VIEW                        */}
          {/* ======================================================== */}
          {(activeMode === "history" || (activeMode === "meeting" && meetingStep === "history")) && (
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", height: "100%", gap: "12px" }}>
              {/* Header Bar */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: "14px", fontWeight: 600 }}>Past Meetings</span>
                  <span style={{ fontSize: "11px", color: "#71717a", marginLeft: "8px" }}>
                    ({storedMeetings.length} saved)
                  </span>
                </div>
                <button
                  onClick={() => {
                    setCurrentMeeting(null);
                    setMeetingStep("setup");
                    setActiveMode("meeting");
                  }}
                  style={{
                    background: "#10b981",
                    border: "none",
                    color: "#09090b",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  + New Meeting
                </button>
              </div>

              {/* Search & Sort Controls */}
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search meetings by title or summary..."
                  style={{
                    flex: 1,
                    background: "#18181b",
                    border: "1px solid #27272a",
                    color: "#fafafa",
                    borderRadius: "6px",
                    padding: "7px 10px",
                    fontSize: "12px",
                    outline: "none"
                  }}
                />
                <select
                  value={historySort}
                  onChange={(e) => setHistorySort(e.target.value as any)}
                  style={{
                    background: "#18181b",
                    border: "1px solid #27272a",
                    color: "#fafafa",
                    borderRadius: "6px",
                    padding: "7px 10px",
                    fontSize: "12px",
                    outline: "none",
                    cursor: "pointer"
                  }}
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="title">Title (A-Z)</option>
                </select>
              </div>

              {/* Delete Confirmation Modal Overlay */}
              {meetingToDelete && (
                <div
                  style={{
                    background: "#2a1215",
                    border: "1px solid #7f1d1d",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px"
                  }}
                >
                  <span style={{ fontSize: "12px", color: "#fecaca" }}>
                    Delete "{meetingToDelete.title}"?
                  </span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={() => deleteMeetingFromStorage(meetingToDelete.id)}
                      style={{
                        background: "#ef4444",
                        border: "none",
                        color: "#ffffff",
                        borderRadius: "4px",
                        padding: "4px 8px",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      Confirm Delete
                    </button>
                    <button
                      onClick={() => setMeetingToDelete(null)}
                      style={{
                        background: "transparent",
                        border: "1px solid #7f1d1d",
                        color: "#fecaca",
                        borderRadius: "4px",
                        padding: "4px 8px",
                        fontSize: "11px",
                        cursor: "pointer"
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Meeting Cards List */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  maxHeight: "360px"
                }}
              >
                {filteredMeetings.length === 0 ? (
                  <div
                    style={{
                      color: "#71717a",
                      fontSize: "13px",
                      textAlign: "center",
                      padding: "36px 16px",
                      background: "#121214",
                      borderRadius: "8px",
                      border: "1px dashed #27272a"
                    }}
                  >
                    <div>No saved meetings found.</div>
                    <button
                      onClick={() => {
                        setCurrentMeeting(null);
                        setMeetingStep("setup");
                        setActiveMode("meeting");
                      }}
                      style={{
                        marginTop: "12px",
                        background: "#10b981",
                        border: "none",
                        color: "#09090b",
                        borderRadius: "6px",
                        padding: "6px 14px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      + Start a Meeting
                    </button>
                  </div>
                ) : (
                  filteredMeetings.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => {
                        setCurrentMeeting(m);
                        populateMeetingEditingBuffers(m);
                        setMeetingStep("completed");
                        setActiveMode("meeting");
                      }}
                      style={{
                        background: "#141417",
                        border: "1px solid #27272a",
                        borderRadius: "10px",
                        padding: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        cursor: "pointer",
                        transition: "border-color 0.15s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#10b981";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#27272a";
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ fontWeight: 600, fontSize: "13px", color: "#fafafa" }}>{m.title}</div>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const md = generateMeetingMarkdown(m);
                              navigator.clipboard.writeText(md);
                              showToast("Markdown notes copied!");
                            }}
                            title="Copy Markdown notes"
                            style={{
                              background: "#1f1f23",
                              border: "1px solid #2e2e33",
                              color: "#fafafa",
                              borderRadius: "4px",
                              padding: "3px 7px",
                              fontSize: "11px",
                              cursor: "pointer"
                            }}
                          >
                            📋 Copy
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMeetingToDelete(m);
                            }}
                            title="Delete meeting"
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#71717a",
                              fontSize: "13px",
                              cursor: "pointer",
                              padding: "2px 4px"
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      <div style={{ fontSize: "11px", color: "#a1a1aa" }}>
                        {m.date} • {m.duration}
                      </div>

                      {m.summaryPreview && (
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#a1a1aa",
                            lineHeight: "1.4",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden"
                          }}
                        >
                          {m.summaryPreview}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                        <span
                          style={{
                            fontSize: "10px",
                            background: "rgba(16, 185, 129, 0.12)",
                            color: "#10b981",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontWeight: 500
                          }}
                        >
                          Topics: {m.topics?.length || 0}
                        </span>
                        <span
                          style={{
                            fontSize: "10px",
                            background: "rgba(59, 130, 246, 0.12)",
                            color: "#60a5fa",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontWeight: 500
                          }}
                        >
                          Decisions: {m.decisions?.length || 0}
                        </span>
                        <span
                          style={{
                            fontSize: "10px",
                            background: "rgba(245, 158, 11, 0.12)",
                            color: "#fbbf24",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontWeight: 500
                          }}
                        >
                          Actions: {m.actionItems?.length || 0}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: SETTINGS & ACCOUNT VIEW                           */}
          {/* ======================================================== */}
          {activeMode === "settings" && (
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" }}>
              {/* Preferences Card */}
              <div style={{ background: "#141417", border: "1px solid #27272a", borderRadius: "10px", padding: "14px" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#fafafa", marginBottom: "10px" }}>
                  Widget Preferences
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "11px", color: "#a1a1aa", display: "block", marginBottom: "4px" }}>
                      Default Starting Tab
                    </label>
                    <select
                      value={defaultMode}
                      onChange={(e) => {
                        const val = e.target.value as WidgetMode;
                        setDefaultMode(val);
                        try {
                          localStorage.setItem("voxflow_pref_mode", val);
                        } catch {}
                      }}
                      style={{
                        width: "100%",
                        background: "#18181b",
                        border: "1px solid #27272a",
                        color: "#fafafa",
                        borderRadius: "6px",
                        padding: "6px 8px",
                        fontSize: "12px",
                        outline: "none"
                      }}
                    >
                      <option value="voice">Voice Typing</option>
                      <option value="meeting">Meeting Notes</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", color: "#a1a1aa", display: "block", marginBottom: "4px" }}>
                      Preferred Spoken Language
                    </label>
                    <select
                      value={preferredLang}
                      onChange={(e) => {
                        setPreferredLang(e.target.value);
                        setVoiceTargetLang(e.target.value);
                        try {
                          localStorage.setItem("voxflow_pref_lang", e.target.value);
                        } catch {}
                      }}
                      style={{
                        width: "100%",
                        background: "#18181b",
                        border: "1px solid #27272a",
                        color: "#fafafa",
                        borderRadius: "6px",
                        padding: "6px 8px",
                        fontSize: "12px",
                        outline: "none"
                      }}
                    >
                      <option value="auto">Auto (Contextual)</option>
                      {SUPPORTED_LANGUAGES.filter((l) => l.id !== "auto").map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", color: "#a1a1aa", display: "block", marginBottom: "4px" }}>
                      Default Output Language
                    </label>
                    <select
                      value={preferredOutputLang}
                      onChange={(e) => {
                        setPreferredOutputLang(e.target.value);
                        setVoiceOutputLang(e.target.value);
                        try {
                          localStorage.setItem("voxflow_pref_output_lang", e.target.value);
                        } catch {}
                      }}
                      style={{
                        width: "100%",
                        background: "#18181b",
                        border: "1px solid #27272a",
                        color: "#fafafa",
                        borderRadius: "6px",
                        padding: "6px 8px",
                        fontSize: "12px",
                        outline: "none"
                      }}
                    >
                      <option value="same">Same as Spoken</option>
                      {SUPPORTED_LANGUAGES.filter((l) => l.id !== "auto").map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Audio Filters Card */}
              <div style={{ background: "#141417", border: "1px solid #27272a", borderRadius: "10px", padding: "14px" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#fafafa", marginBottom: "10px" }}>
                  Audio Processing Filters
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px", color: "#d4d4d8", cursor: "pointer" }}>
                    <span>Echo Cancellation</span>
                    <input
                      type="checkbox"
                      checked={audioConstraints.echoCancellation}
                      onChange={(e) => setAudioConstraints((prev) => ({ ...prev, echoCancellation: e.target.checked }))}
                    />
                  </label>
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px", color: "#d4d4d8", cursor: "pointer" }}>
                    <span>Noise Suppression</span>
                    <input
                      type="checkbox"
                      checked={audioConstraints.noiseSuppression}
                      onChange={(e) => setAudioConstraints((prev) => ({ ...prev, noiseSuppression: e.target.checked }))}
                    />
                  </label>
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px", color: "#d4d4d8", cursor: "pointer" }}>
                    <span>Auto Gain Control</span>
                    <input
                      type="checkbox"
                      checked={audioConstraints.autoGainControl}
                      onChange={(e) => setAudioConstraints((prev) => ({ ...prev, autoGainControl: e.target.checked }))}
                    />
                  </label>
                </div>
              </div>

              {/* Keyboard Shortcuts Card */}
              <div style={{ background: "#141417", border: "1px solid #27272a", borderRadius: "10px", padding: "14px" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#fafafa", marginBottom: "8px" }}>
                  Keyboard Shortcuts
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
                  <span style={{ color: "#a1a1aa" }}>Toggle Capsule / Panel</span>
                  <span
                    style={{
                      background: "#18181b",
                      border: "1px solid #27272a",
                      color: "#fafafa",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontFamily: "monospace",
                      fontSize: "11px"
                    }}
                  >
                    ⌘ ⇧ X / Ctrl ⇧ X
                  </span>
                </div>
              </div>

              {/* Account and Quota Card */}
              <div style={{ background: "#141417", border: "1px solid #27272a", borderRadius: "10px", padding: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#fafafa" }}>Account & Quotas</span>
                  <span
                    style={{
                      background: isPremium ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.08)",
                      color: isPremium ? "#10b981" : "#a1a1aa",
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      fontSize: "11px",
                      fontWeight: 600
                    }}
                  >
                    {entitlements?.planName || (user ? "Free Plan" : "Guest Account")}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#a1a1aa" }}>
                    <span>Account Email:</span>
                    <span style={{ color: "#fafafa" }}>{user?.email || "Guest (Unauthenticated)"}</span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", color: "#a1a1aa" }}>
                    <span>Transcription Usage:</span>
                    <span style={{ color: "#fafafa" }}>
                      {entitlements?.usage?.transcriptionMinutesUsed ?? 0} /{" "}
                      {entitlements?.usage?.transcriptionMinutesLimit ?? 30} mins
                    </span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", color: "#a1a1aa" }}>
                    <span>Meeting Recordings:</span>
                    <span style={{ color: "#fafafa" }}>
                      {entitlements?.usage?.meetingsUsed ?? 0} /{" "}
                      {entitlements?.usage?.meetingsLimit ?? 5} recorded
                    </span>
                  </div>

                  {entitlements?.resetDate && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#a1a1aa" }}>
                      <span>Quota Resets:</span>
                      <span style={{ color: "#fafafa" }}>
                        {new Date(entitlements.resetDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                  {!isPremium && (
                    <a
                      href="#pricing"
                      onClick={() => setIsOpen(false)}
                      style={{
                        marginTop: "8px",
                        background: "#10b981",
                        color: "#09090b",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        textAlign: "center",
                        fontWeight: 600,
                        fontSize: "12px",
                        display: "block"
                      }}
                    >
                      Upgrade to Pro for Unlimited Minutes →
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* GLOBAL TOAST NOTIFICATION */}
          {toastMessage && (
            <div
              style={{
                position: "absolute",
                bottom: "16px",
                left: "50%",
                transform: "translateX(-50%)",
                background: "#18181b",
                color: "#fafafa",
                border: "1px solid #10b981",
                borderRadius: "8px",
                padding: "8px 14px",
                fontSize: "12px",
                fontWeight: 500,
                boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
                pointerEvents: "none",
                zIndex: 10
              }}
            >
              {toastMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
