import React, { useState } from "react";
import { DEMO_SCENARIOS } from "../data/demoScenarios";
import { SUPPORTED_LANGUAGES } from "../data/languages";
import { useRecorder } from "../hooks/useRecorder";
import { api, type ProcessPipelineResult } from "../lib/api";

export type FlowState = "IDLE" | "RECORDING" | "PROCESSING" | "TRANSCRIBING" | "ANALYZING" | "COMPLETE" | "ERROR";

export const InteractiveDemo: React.FC = () => {
  // Mode selection: "live" (real mic & real AI backend) vs "preset" (deterministic interactive samples)
  const [interactionMode, setInteractionMode] = useState<"live" | "preset">("live");
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("email-reply");
  const [targetLang, setTargetLang] = useState<string>("English");

  // Core Flow State: IDLE → RECORDING → PROCESSING → TRANSCRIBING → ANALYZING → COMPLETE → ERROR
  const [flowState, setFlowState] = useState<FlowState>("IDLE");
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>("Ready when you are. Click record and speak naturally.");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live AI outputs
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [liveTransformedText, setLiveTransformedText] = useState<string>("");
  const [isEditingOutput, setIsEditingOutput] = useState<boolean>(false);
  const [livePipelineData, setLivePipelineData] = useState<ProcessPipelineResult | null>(null);
  const [copiedToast, setCopiedToast] = useState<boolean>(false);

  // Recorder Hook
  const recorder = useRecorder();

  const currentScenario = DEMO_SCENARIOS.find((s) => s.id === selectedScenarioId) || DEMO_SCENARIOS[0];

  const pipelineSteps = [
    { id: "transcribe", label: "Transcribing Speech", icon: "🎙" },
    { id: "detect-lang", label: "Detecting Language", icon: "🌐" },
    { id: "understand", label: "Understanding Intent", icon: "🧠" },
    { id: "detect-context", label: "Detecting Context", icon: "🎯" },
    { id: "transform", label: "Transforming Text", icon: "✨" }
  ];

  // Real backend execution
  const runLiveAudioPipeline = async (blob: Blob) => {
    try {
      setFlowState("TRANSCRIBING");
      setActiveStepIndex(0);
      setStatusMessage("Sending audio to VoxFlow AI... Transcribing speech.");
      setErrorMessage(null);

      // Step 1: Real Transcription via Groq Whisper
      const { text } = await api.transcribeAudio(blob);

      if (!text || !text.trim()) {
        throw new Error("No spoken words detected in this recording. Please try speaking a bit louder.");
      }

      setLiveTranscript(text);
      setFlowState("ANALYZING");
      setActiveStepIndex(2);
      setStatusMessage("Understanding intent, detecting language, and inferring communication context...");

      // Step 2-5: Real Consolidated AI Pipeline (/process)
      const pipelineResult = await api.processVoice(text, targetLang);

      setLivePipelineData(pipelineResult);
      setLiveTransformedText(pipelineResult.transformation.finalText);
      setFlowState("COMPLETE");
      setActiveStepIndex(4);
      setStatusMessage("Transformation complete! Polished and formatted for your intended recipient.");
    } catch (err: any) {
      console.error("Live pipeline error:", err);
      setFlowState("ERROR");
      setErrorMessage(err?.message || "Failed to process audio through VoxFlow backend. Is the API server running?");
    }
  };

  // Run simulated preset demo progression
  const handleRunPresetDemo = () => {
    setFlowState("PROCESSING");
    setActiveStepIndex(0);
    setStatusMessage("Processing preset sample...");

    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      if (step < pipelineSteps.length) {
        setActiveStepIndex(step);
        if (step === 1) setFlowState("TRANSCRIBING");
        if (step === 2) setFlowState("ANALYZING");
      } else {
        clearInterval(interval);
        setFlowState("COMPLETE");
        setStatusMessage("Preset sample transformed successfully.");
      }
    }, 500);
  };

  const handleStartLiveRecord = async () => {
    setErrorMessage(null);
    setLiveTranscript("");
    setLiveTransformedText("");
    setLivePipelineData(null);
    setIsEditingOutput(false);
    try {
      await recorder.startRecording();
      setFlowState("RECORDING");
      setStatusMessage("Listening... Speak in any language or mix them naturally.");
    } catch (err: any) {
      setFlowState("ERROR");
      setErrorMessage(err?.message || "Failed to access microphone.");
    }
  };

  const handleStopLiveRecord = async () => {
    try {
      const blob = await recorder.stopRecording();
      if (blob) {
        await runLiveAudioPipeline(blob);
      }
    } catch (err: any) {
      setFlowState("ERROR");
      setErrorMessage(err?.message || "Failed to process recorded audio.");
    }
  };

  const handleCancelLiveRecord = () => {
    recorder.cancelRecording();
    setFlowState("IDLE");
    setStatusMessage("Recording cancelled.");
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2400);
    } catch (e) {
      console.warn("Failed to copy text:", e);
    }
  };

  const handleClear = () => {
    recorder.resetRecording();
    setLiveTranscript("");
    setLiveTransformedText("");
    setLivePipelineData(null);
    setFlowState("IDLE");
    setErrorMessage(null);
    setStatusMessage("Ready when you are. Click record and speak naturally.");
  };

  // Get state badge styling
  const getStateBadge = () => {
    switch (flowState) {
      case "RECORDING":
        return { label: "RECORDING", bg: "#fef2f2", color: "#ef4444", border: "#fecaca" };
      case "TRANSCRIBING":
        return { label: "TRANSCRIBING", bg: "#f3e8ff", color: "#7e14ff", border: "#d8b4fe" };
      case "ANALYZING":
        return { label: "ANALYZING CONTEXT", bg: "#f0f9ff", color: "#0284c7", border: "#bae6fd" };
      case "PROCESSING":
        return { label: "PROCESSING", bg: "#fef3c7", color: "#d97706", border: "#fde68a" };
      case "COMPLETE":
        return { label: "COMPLETE", bg: "#ecfdf5", color: "#059669", border: "#a7f3d0" };
      case "ERROR":
        return { label: "ERROR", bg: "#fef2f2", color: "#dc2626", border: "#fca5a5" };
      case "IDLE":
      default:
        return { label: "IDLE", bg: "#f8fafc", color: "#64748b", border: "#e2e8f0" };
    }
  };

  const badge = getStateBadge();

  return (
    <section id="demo" className="section-spacing" style={{ position: "relative" }}>
      <div className="container">
        {/* Section Header */}
        <div className="section-title-wrap">
          <span className="badge badge-glow">Interactive Product Demo</span>
          <h2>Test the Voice Input Engine</h2>
          <p>
            Try VoxFlow with your microphone or test sample inputs to see how natural speech is transcribed and structured into polished writing.
          </p>
        </div>

        {/* Demo Console Container */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "24px",
            border: "1px solid rgba(126, 20, 255, 0.16)",
            boxShadow:
              "0 20px 50px -15px rgba(126, 20, 255, 0.1), 0 8px 24px rgba(15, 23, 42, 0.04)",
            overflow: "hidden"
          }}
        >
          {/* Top Control Bar */}
          <div
            style={{
              padding: "18px 24px",
              background: "#faf8fe",
              borderBottom: "1px solid #ece5f8",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "14px"
            }}
          >
            {/* Left: Mode Toggle (Live Voice vs Presets) */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <div
                style={{
                  display: "inline-flex",
                  background: "#eeeaf6",
                  padding: "4px",
                  borderRadius: "12px",
                  gap: "4px"
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setInteractionMode("live");
                    handleClear();
                  }}
                  style={{
                    padding: "7px 16px",
                    borderRadius: "9px",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    background: interactionMode === "live" ? "#7e14ff" : "transparent",
                    color: interactionMode === "live" ? "#ffffff" : "#64748b",
                    boxShadow: interactionMode === "live" ? "0 2px 8px rgba(126, 20, 255, 0.3)" : "none"
                  }}
                >
                  🎙 Live Microphone Input
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInteractionMode("preset");
                    recorder.cancelRecording();
                    setFlowState("COMPLETE");
                  }}
                  style={{
                    padding: "7px 16px",
                    borderRadius: "9px",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    background: interactionMode === "preset" ? "#7e14ff" : "transparent",
                    color: interactionMode === "preset" ? "#ffffff" : "#64748b",
                    boxShadow: interactionMode === "preset" ? "0 2px 8px rgba(126, 20, 255, 0.3)" : "none"
                  }}
                >
                  ⚡ Sample Presets
                </button>
              </div>

              {/* Target Language Dropdown */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <label
                  htmlFor="demo-lang-select"
                  style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b" }}
                >
                  Output Language:
                </label>
                <select
                  id="demo-lang-select"
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: "1px solid #dcd5ec",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: "#1e293b",
                    background: "#ffffff",
                    cursor: "pointer"
                  }}
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.id} value={lang.name}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right: State Badge */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                style={{
                  background: badge.bg,
                  color: badge.color,
                  border: `1px solid ${badge.border}`,
                  padding: "4px 10px",
                  borderRadius: "8px",
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                {flowState === "RECORDING" && (
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#ef4444"
                    }}
                    className="pulse-active"
                  />
                )}
                {badge.label}
              </span>
            </div>
          </div>

          {/* Preset Scenario Selectors (if in preset mode) */}
          {interactionMode === "preset" && (
            <div
              style={{
                padding: "12px 24px",
                background: "#fcfaff",
                borderBottom: "1px solid #f1edf8",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap"
              }}
            >
              <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>
                Select Scenario:
              </span>
              {DEMO_SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => {
                    setSelectedScenarioId(sc.id);
                    setTargetLang(sc.targetLang);
                    setFlowState("COMPLETE");
                  }}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "8px",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    background: selectedScenarioId === sc.id ? "#f3e8ff" : "#ffffff",
                    color: selectedScenarioId === sc.id ? "#7e14ff" : "#475569",
                    border:
                      selectedScenarioId === sc.id
                        ? "1px solid #d8b4fe"
                        : "1px solid #e2e8f0"
                  }}
                >
                  {sc.title}
                </button>
              ))}
            </div>
          )}

          {/* Console Body: 2 Columns */}
          <div
            style={{
              padding: "28px",
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "24px"
            }}
            className="demo-grid"
          >
            {/* Left Column: Voice Recording Console & Raw Speech */}
            <div
              style={{
                background: "#faf9fd",
                borderRadius: "18px",
                border: "1px solid #ece7f8",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between"
              }}
            >
              <div>
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "16px"
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "#7e14ff"
                    }}
                  >
                    1. Voice Input Stream
                  </span>

                  {flowState === "RECORDING" && (
                    <span
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        color: "#ef4444",
                        fontFamily: "monospace"
                      }}
                    >
                      Duration: {recorder.durationFormatted}
                    </span>
                  )}
                </div>

                {/* Live Microphone Visualizer / Action Box */}
                {interactionMode === "live" ? (
                  <div
                    style={{
                      background: "#ffffff",
                      borderRadius: "14px",
                      border: "1px solid #e9e4f5",
                      padding: "20px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      gap: "16px",
                      minHeight: "180px"
                    }}
                  >
                    {flowState === "RECORDING" ? (
                      <>
                        {/* Live Audio Visualizer Waveform */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "4px",
                            height: "50px",
                            width: "100%"
                          }}
                        >
                          {recorder.waveform.map((bar, i) => (
                            <div
                              key={i}
                              style={{
                                width: "6px",
                                height: `${Math.max(6, bar * 46)}px`,
                                background: "linear-gradient(180deg, #7e14ff, #38bdf8)",
                                borderRadius: "4px",
                                transition: "height 0.05s ease"
                              }}
                            />
                          ))}
                        </div>

                        <p style={{ fontSize: "0.9rem", color: "#0f172a", fontWeight: 600 }}>
                          Recording live microphone audio ({recorder.durationFormatted})...
                        </p>

                        <div style={{ display: "flex", gap: "10px" }}>
                          <button
                            type="button"
                            onClick={handleStopLiveRecord}
                            style={{
                              background: "#ef4444",
                              color: "white",
                              padding: "10px 22px",
                              borderRadius: "10px",
                              fontWeight: 700,
                              fontSize: "0.9rem",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px"
                            }}
                          >
                            <span>⏹</span>
                            <span>Stop & Transform</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleCancelLiveRecord}
                            className="btn-secondary"
                            style={{ padding: "10px 16px", fontSize: "0.85rem" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : flowState === "TRANSCRIBING" || flowState === "ANALYZING" ? (
                      <div style={{ padding: "20px 0" }}>
                        <div
                          style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "50%",
                            background: "#f3e8ff",
                            color: "#7e14ff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "22px",
                            margin: "0 auto 12px auto"
                          }}
                          className="pulse-active"
                        >
                          ⚡
                        </div>
                        <strong style={{ display: "block", color: "#0f172a", fontSize: "1rem", marginBottom: "4px" }}>
                          {statusMessage}
                        </strong>
                        <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                          Using Groq Whisper and context engine
                        </span>
                      </div>
                    ) : (
                      <>
                        {/* Idle or Completed: Big Record Button */}
                        <button
                          type="button"
                          onClick={handleStartLiveRecord}
                          style={{
                            width: "72px",
                            height: "72px",
                            borderRadius: "50%",
                            background: "linear-gradient(135deg, #7e14ff 0%, #a855f7 100%)",
                            color: "white",
                            fontSize: "30px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 8px 24px rgba(126, 20, 255, 0.35)",
                            border: "none",
                            cursor: "pointer",
                            transition: "transform 0.15s ease"
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.06)")}
                          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                        >
                          🎙
                        </button>

                        <div>
                          <strong style={{ display: "block", fontSize: "1rem", color: "#0f172a", marginBottom: "4px" }}>
                            Click to Record Voice
                          </strong>
                          <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                            Speak naturally in English, Hindi, or mix languages freely
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  /* Preset mode text box */
                  <div
                    style={{
                      background: "#ffffff",
                      borderRadius: "14px",
                      border: "1px solid #e9e4f5",
                      padding: "16px 18px",
                      minHeight: "110px",
                      fontSize: "0.95rem",
                      lineHeight: 1.65,
                      color: "#334155"
                    }}
                  >
                    <p style={{ fontStyle: "italic", margin: 0 }}>
                      "{currentScenario.rawSpeech}"
                    </p>
                  </div>
                )}

                {/* Error Banner */}
                {errorMessage && (
                  <div
                    style={{
                      marginTop: "14px",
                      padding: "12px 16px",
                      borderRadius: "10px",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#b91c1c",
                      fontSize: "0.85rem"
                    }}
                  >
                    <strong>⚠️ Error:</strong> {errorMessage}
                  </div>
                )}

                {/* Raw Transcript Box (if available) */}
                {liveTranscript && (
                  <div
                    style={{
                      marginTop: "16px",
                      background: "#ffffff",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      padding: "14px",
                      fontSize: "0.875rem"
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        fontSize: "0.7rem",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        color: "#94a3b8",
                        marginBottom: "4px"
                      }}
                    >
                      Raw Speech Transcript:
                    </span>
                    <p style={{ margin: 0, color: "#334155", fontStyle: "italic" }}>
                      "{liveTranscript}"
                    </p>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div
                style={{
                  marginTop: "20px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flexWrap: "wrap"
                }}
              >
                {interactionMode === "preset" ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleRunPresetDemo}
                    disabled={flowState === "PROCESSING"}
                    style={{ flex: 1, padding: "11px 18px" }}
                  >
                    Run Transformation
                  </button>
                ) : (
                  flowState === "COMPLETE" && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleStartLiveRecord}
                      style={{ flex: 1, padding: "11px 18px" }}
                    >
                      Record Again 🎙
                    </button>
                  )
                )}

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleClear}
                  style={{ padding: "11px 18px" }}
                >
                  Clear / Reset
                </button>
              </div>
            </div>

            {/* Right Column: 5-Step Pipeline Result & Context Output */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "18px",
                border: "1px solid #ece7f8",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between"
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "14px",
                    flexWrap: "wrap",
                    gap: "8px"
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "#10b981"
                    }}
                  >
                    2. Context-Transformed Text
                  </span>

                  {livePipelineData?.context && (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "#64748b",
                        background: "#f1f5f9",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontWeight: 600
                      }}
                    >
                      {livePipelineData.context.likelyChannel} • {livePipelineData.context.tone}
                    </span>
                  )}
                </div>

                {/* 5-Step Pipeline Breadcrumb */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5, 1fr)",
                    gap: "6px",
                    marginBottom: "16px"
                  }}
                >
                  {pipelineSteps.map((st, i) => {
                    const isDone = flowState === "COMPLETE" || i < activeStepIndex;
                    const isCurrent = (flowState === "TRANSCRIBING" || flowState === "ANALYZING" || flowState === "PROCESSING") && i === activeStepIndex;
                    return (
                      <div
                        key={st.id}
                        style={{
                          textAlign: "center",
                          padding: "6px 2px",
                          borderRadius: "8px",
                          background: isDone
                            ? "#ecfdf5"
                            : isCurrent
                            ? "#f3e8ff"
                            : "#f8fafc",
                          border: isDone
                            ? "1px solid #a7f3d0"
                            : isCurrent
                            ? "1px solid #c084fc"
                            : "1px solid #e2e8f0",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          color: isDone ? "#059669" : isCurrent ? "#7e14ff" : "#94a3b8"
                        }}
                      >
                        <div>{st.icon}</div>
                        <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {st.label.split(" ")[0]}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Final Text Display or Editable Textarea */}
                <div
                  style={{
                    background: "#fbfaff",
                    borderRadius: "14px",
                    border: "1px solid #e6dff3",
                    padding: "18px",
                    minHeight: "140px",
                    fontSize: "0.95rem",
                    lineHeight: 1.65,
                    color: "#0f172a",
                    position: "relative"
                  }}
                >
                  {flowState === "TRANSCRIBING" || flowState === "ANALYZING" || flowState === "PROCESSING" ? (
                    <div style={{ padding: "20px 0", textAlign: "center", color: "#7e14ff" }}>
                      <span className="pulse-active" style={{ fontSize: "24px", display: "inline-block", marginBottom: "8px" }}>
                        ✨
                      </span>
                      <p style={{ margin: 0, fontWeight: 600 }}>{statusMessage}</p>
                    </div>
                  ) : isEditingOutput ? (
                    <textarea
                      value={liveTransformedText}
                      onChange={(e) => setLiveTransformedText(e.target.value)}
                      rows={5}
                      style={{
                        width: "100%",
                        border: "1px solid #a855f7",
                        borderRadius: "8px",
                        padding: "10px",
                        fontSize: "0.95rem",
                        fontFamily: "inherit",
                        lineHeight: 1.6,
                        outline: "none",
                        background: "#ffffff"
                      }}
                    />
                  ) : (
                    <div style={{ whiteSpace: "pre-line" }}>
                      {interactionMode === "live"
                        ? liveTransformedText || (
                            <span style={{ color: "#94a3b8" }}>
                              Record your microphone or click test to transform your speech into polished text.
                            </span>
                          )
                        : currentScenario.pipeline.transformation}
                    </div>
                  )}
                </div>

                {/* Pipeline Metadata Insights Chips */}
                {flowState === "COMPLETE" && (
                  <div style={{ marginTop: "14px", display: "flex", flexWrap: "wrap", gap: "8px", fontSize: "0.75rem" }}>
                    {livePipelineData ? (
                      <>
                        <span style={{ background: "#f3e8ff", color: "#7e14ff", padding: "3px 8px", borderRadius: "6px", fontWeight: 700 }}>
                          Detected: {livePipelineData.language.primaryLanguage} ({livePipelineData.language.languageCode})
                        </span>
                        {livePipelineData.language.mixedLanguage && (
                          <span style={{ background: "#ecfdf5", color: "#059669", padding: "3px 8px", borderRadius: "6px", fontWeight: 700 }}>
                            Mixed Multilingual ✓
                          </span>
                        )}
                        <span style={{ background: "#f0f9ff", color: "#0284c7", padding: "3px 8px", borderRadius: "6px", fontWeight: 700 }}>
                          Audience: {livePipelineData.context.audience}
                        </span>
                        <span style={{ background: "#faf5ff", color: "#9333ea", padding: "3px 8px", borderRadius: "6px", fontWeight: 700 }}>
                          Format: {livePipelineData.transformation.transformation}
                        </span>
                      </>
                    ) : (
                      <>
                        <span style={{ background: "#f3e8ff", color: "#7e14ff", padding: "3px 8px", borderRadius: "6px", fontWeight: 700 }}>
                          Language: {currentScenario.pipeline.detectedLanguage.primary}
                        </span>
                        <span style={{ background: "#f0f9ff", color: "#0284c7", padding: "3px 8px", borderRadius: "6px", fontWeight: 700 }}>
                          Channel: {currentScenario.pipeline.context.channel}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Output Actions Bar: Copy, Edit, Toast */}
              <div
                style={{
                  marginTop: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {flowState === "COMPLETE" && (
                    <button
                      type="button"
                      onClick={() => setIsEditingOutput(!isEditingOutput)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#7e14ff",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        textDecoration: "underline"
                      }}
                    >
                      {isEditingOutput ? "Save Edits ✓" : "✏️ Edit Text"}
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {copiedToast && (
                    <span style={{ fontSize: "0.85rem", color: "#10b981", fontWeight: 700 }}>
                      Copied to clipboard! ✓
                    </span>
                  )}

                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() =>
                      handleCopy(
                        interactionMode === "live"
                          ? liveTransformedText
                          : currentScenario.pipeline.transformation
                      )
                    }
                    disabled={flowState !== "COMPLETE"}
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    <span>Copy Final Text</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 900px) {
          .demo-grid {
            grid-template-columns: 1fr 1.15fr !important;
          }
        }
      `}</style>
    </section>
  );
};
