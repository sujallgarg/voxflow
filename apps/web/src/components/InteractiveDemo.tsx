import React, { useState } from "react";
import { DEMO_SCENARIOS } from "../data/demoScenarios";
import { SUPPORTED_LANGUAGES } from "../data/languages";
import { useRecorder } from "../hooks/useRecorder";
import { api, type ProcessPipelineResult } from "../lib/api";

export type FlowState = "IDLE" | "RECORDING" | "PROCESSING" | "TRANSCRIBING" | "ANALYZING" | "COMPLETE" | "ERROR";

export const InteractiveDemo: React.FC = () => {
  const [interactionMode, setInteractionMode] = useState<"live" | "preset">("live");
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("email-reply");
  const [targetLang, setTargetLang] = useState<string>("English");

  const [flowState, setFlowState] = useState<FlowState>("IDLE");
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>("Click record and speak naturally.");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [liveTransformedText, setLiveTransformedText] = useState<string>("");
  const [isEditingOutput, setIsEditingOutput] = useState<boolean>(false);
  const [livePipelineData, setLivePipelineData] = useState<ProcessPipelineResult | null>(null);
  const [copiedToast, setCopiedToast] = useState<boolean>(false);

  const recorder = useRecorder();
  const currentScenario = DEMO_SCENARIOS.find((s) => s.id === selectedScenarioId) || DEMO_SCENARIOS[0];

  const pipelineSteps = [
    {
      id: "transcribe",
      label: "Transcribing Speech",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      )
    },
    {
      id: "detect-lang",
      label: "Detecting Language",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      )
    },
    {
      id: "understand",
      label: "Understanding Intent",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2a8 8 0 0 0-8 8c0 3 1.5 5.5 4 7v3h8v-3c2.5-1.5 4-4 4-7a8 8 0 0 0-8-8Z" />
        </svg>
      )
    },
    {
      id: "detect-context",
      label: "Detecting Context",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1" />
        </svg>
      )
    },
    {
      id: "transform",
      label: "Transforming Text",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      )
    }
  ];

  const runLiveAudioPipeline = async (blob: Blob) => {
    try {
      setFlowState("TRANSCRIBING");
      setActiveStepIndex(0);
      setStatusMessage("Transcribing speech...");
      setErrorMessage(null);

      const { text } = await api.transcribeAudio(blob);
      if (!text || !text.trim()) {
        throw new Error("No spoken words detected in this recording. Please speak louder or closer to the microphone.");
      }

      setLiveTranscript(text);
      setFlowState("ANALYZING");
      setActiveStepIndex(2);
      setStatusMessage("Analyzing context and intent...");

      const pipelineResult = await api.processVoice(text, targetLang);
      setLivePipelineData(pipelineResult);
      setLiveTransformedText(pipelineResult.transformation.finalText);
      setFlowState("COMPLETE");
      setActiveStepIndex(4);
      setStatusMessage("Transformation complete.");
    } catch (err: any) {
      console.error("Live pipeline error:", err);
      setFlowState("ERROR");
      setErrorMessage(err?.message || "Failed to process audio. Please ensure backend is available.");
    }
  };

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
        setStatusMessage("Preset transformed successfully.");
      }
    }, 400);
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
      setStatusMessage("Recording audio... Speak naturally.");
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
    setStatusMessage("Click record and speak naturally.");
  };

  const getStateBadge = () => {
    switch (flowState) {
      case "RECORDING":
        return { label: "RECORDING", bg: "#111111", color: "#ffffff", border: "#111111" };
      case "TRANSCRIBING":
      case "ANALYZING":
      case "PROCESSING":
        return { label: flowState, bg: "#f5f5f5", color: "#111111", border: "#e5e5e5" };
      case "COMPLETE":
        return { label: "COMPLETE", bg: "#111111", color: "#ffffff", border: "#111111" };
      case "ERROR":
        return { label: "ERROR", bg: "#f5f5f5", color: "#111111", border: "#e5e5e5" };
      case "IDLE":
      default:
        return { label: "READY", bg: "#f5f5f5", color: "#666666", border: "#e5e5e5" };
    }
  };

  const badge = getStateBadge();

  return (
    <section id="demo" className="section-spacing" style={{ position: "relative", background: "#ffffff" }}>
      <div className="container">
        {/* Section Header */}
        <div className="section-title-wrap">
          <span className="badge">Interactive Demo</span>
          <h2>Test the Voice Input Engine</h2>
          <p>
            Experience how spoken audio is transcribed, contextualized, and transformed into polished text.
          </p>
        </div>

        {/* Demo Console Container */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "8px",
            border: "1px solid #e5e5e5",
            overflow: "hidden"
          }}
        >
          {/* Top Control Bar */}
          <div
            style={{
              padding: "16px 20px",
              background: "#fafafa",
              borderBottom: "1px solid #e5e5e5",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "14px"
            }}
          >
            {/* Left: Mode Toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <div
                style={{
                  display: "inline-flex",
                  background: "#f5f5f5",
                  padding: "3px",
                  borderRadius: "6px",
                  gap: "4px",
                  border: "1px solid #e5e5e5"
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setInteractionMode("live");
                    handleClear();
                  }}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "4px",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    background: interactionMode === "live" ? "#111111" : "transparent",
                    color: interactionMode === "live" ? "#ffffff" : "#666666",
                    border: "none",
                    cursor: "pointer"
                  }}
                >
                  Microphone Input
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInteractionMode("preset");
                    recorder.cancelRecording();
                    setFlowState("COMPLETE");
                  }}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "4px",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    background: interactionMode === "preset" ? "#111111" : "transparent",
                    color: interactionMode === "preset" ? "#ffffff" : "#666666",
                    border: "none",
                    cursor: "pointer"
                  }}
                >
                  Sample Presets
                </button>
              </div>

              {/* Target Language Dropdown */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <label
                  htmlFor="demo-lang-select"
                  style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#666666" }}
                >
                  Target Language:
                </label>
                <select
                  id="demo-lang-select"
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "6px",
                    border: "1px solid #e5e5e5",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    color: "#111111",
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
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                {badge.label}
              </span>
            </div>
          </div>

          {/* Preset Scenario Selectors (if in preset mode) */}
          {interactionMode === "preset" && (
            <div
              style={{
                padding: "12px 20px",
                background: "#ffffff",
                borderBottom: "1px solid #e5e5e5",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap"
              }}
            >
              <span style={{ fontSize: "0.8125rem", color: "#666666", fontWeight: 500 }}>
                Preset:
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
                    borderRadius: "6px",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    background: selectedScenarioId === sc.id ? "#111111" : "#ffffff",
                    color: selectedScenarioId === sc.id ? "#ffffff" : "#666666",
                    border: selectedScenarioId === sc.id ? "1px solid #111111" : "1px solid #e5e5e5",
                    cursor: "pointer"
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
              padding: "24px",
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "20px"
            }}
            className="demo-grid"
          >
            {/* Left Column: Voice Recording Console */}
            <div
              style={{
                background: "#fafafa",
                borderRadius: "8px",
                border: "1px solid #e5e5e5",
                padding: "20px",
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
                    marginBottom: "14px"
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "#666666"
                    }}
                  >
                    1. Voice Input
                  </span>

                  {flowState === "RECORDING" && (
                    <span
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "#111111",
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
                      borderRadius: "6px",
                      border: "1px solid #e5e5e5",
                      padding: "20px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      gap: "16px",
                      minHeight: "170px"
                    }}
                  >
                    {flowState === "RECORDING" ? (
                      <>
                        {/* Audio Waveform */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "4px",
                            height: "44px",
                            width: "100%"
                          }}
                        >
                          {recorder.waveform.map((bar, i) => (
                            <div
                              key={i}
                              style={{
                                width: "4px",
                                height: `${Math.max(4, bar * 40)}px`,
                                background: "#111111",
                                borderRadius: "2px",
                                transition: "height 0.05s ease"
                              }}
                            />
                          ))}
                        </div>

                        <p style={{ fontSize: "0.875rem", color: "#111111", fontWeight: 500, margin: 0 }}>
                          Recording microphone audio ({recorder.durationFormatted})...
                        </p>

                        <div style={{ display: "flex", gap: "10px" }}>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={handleStopLiveRecord}
                            style={{ padding: "8px 18px", fontSize: "0.875rem" }}
                          >
                            Stop & Process
                          </button>

                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={handleCancelLiveRecord}
                            style={{ padding: "8px 14px", fontSize: "0.875rem" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : flowState === "TRANSCRIBING" || flowState === "ANALYZING" ? (
                      <div style={{ padding: "16px 0" }}>
                        <div
                          style={{
                            width: "36px",
                            height: "36px",
                            border: "3px solid #e5e5e5",
                            borderTopColor: "#111111",
                            borderRadius: "50%",
                            animation: "spin 0.8s linear infinite",
                            margin: "0 auto 12px auto"
                          }}
                        />
                        <strong style={{ display: "block", color: "#111111", fontSize: "0.9375rem", marginBottom: "4px" }}>
                          {statusMessage}
                        </strong>
                        <span style={{ fontSize: "0.75rem", color: "#666666" }}>
                          Running speech-to-text and contextual parsing
                        </span>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleStartLiveRecord}
                          style={{
                            width: "56px",
                            height: "56px",
                            borderRadius: "50%",
                            background: "#111111",
                            color: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "none",
                            cursor: "pointer",
                            transition: "opacity 0.15s ease"
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                          aria-label="Start recording"
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="22" />
                          </svg>
                        </button>

                        <div>
                          <strong style={{ display: "block", fontSize: "0.9375rem", color: "#111111", marginBottom: "4px" }}>
                            Click to Record
                          </strong>
                          <span style={{ fontSize: "0.8125rem", color: "#666666" }}>
                            Speak in English, Hindi, or mixed conversational languages
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      background: "#ffffff",
                      borderRadius: "6px",
                      border: "1px solid #e5e5e5",
                      padding: "16px",
                      minHeight: "100px",
                      fontSize: "0.9375rem",
                      lineHeight: 1.6,
                      color: "#111111"
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
                      marginTop: "12px",
                      padding: "10px 14px",
                      borderRadius: "6px",
                      background: "#ffffff",
                      border: "1px solid #111111",
                      color: "#111111",
                      fontSize: "0.8125rem"
                    }}
                  >
                    <strong>Error:</strong> {errorMessage}
                  </div>
                )}

                {/* Raw Transcript Box */}
                {liveTranscript && (
                  <div
                    style={{
                      marginTop: "14px",
                      background: "#ffffff",
                      borderRadius: "6px",
                      border: "1px solid #e5e5e5",
                      padding: "12px",
                      fontSize: "0.875rem"
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        color: "#666666",
                        marginBottom: "4px"
                      }}
                    >
                      Raw Speech:
                    </span>
                    <p style={{ margin: 0, color: "#111111", fontStyle: "italic" }}>
                      "{liveTranscript}"
                    </p>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div
                style={{
                  marginTop: "16px",
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
                    style={{ flex: 1, padding: "10px 16px", fontSize: "0.875rem" }}
                  >
                    Run Transformation
                  </button>
                ) : (
                  flowState === "COMPLETE" && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleStartLiveRecord}
                      style={{ flex: 1, padding: "10px 16px", fontSize: "0.875rem" }}
                    >
                      Record Again
                    </button>
                  )
                )}

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleClear}
                  style={{ padding: "10px 16px", fontSize: "0.875rem" }}
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Right Column: Output & Pipeline Steps */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "8px",
                border: "1px solid #e5e5e5",
                padding: "20px",
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
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "#111111"
                    }}
                  >
                    2. Context-Transformed Text
                  </span>

                  {livePipelineData?.context && (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "#666666",
                        background: "#fafafa",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        border: "1px solid #e5e5e5",
                        fontWeight: 500
                      }}
                    >
                      {livePipelineData.context.likelyChannel} • {livePipelineData.context.tone}
                    </span>
                  )}
                </div>

                {/* Pipeline Steps Tracker */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5, 1fr)",
                    gap: "6px",
                    marginBottom: "14px"
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
                          borderRadius: "4px",
                          background: isDone
                            ? "#111111"
                            : isCurrent
                            ? "#f5f5f5"
                            : "#ffffff",
                          border: isDone
                            ? "1px solid #111111"
                            : isCurrent
                            ? "1px solid #111111"
                            : "1px solid #e5e5e5",
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          color: isDone ? "#ffffff" : isCurrent ? "#111111" : "#666666"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "center" }}>{st.icon}</div>
                        <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "2px" }}>
                          {st.label.split(" ")[0]}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Final Text Display or Editable Textarea */}
                <div
                  style={{
                    background: "#fafafa",
                    borderRadius: "6px",
                    border: "1px solid #e5e5e5",
                    padding: "16px",
                    minHeight: "130px",
                    fontSize: "0.9375rem",
                    lineHeight: 1.6,
                    color: "#111111",
                    position: "relative"
                  }}
                >
                  {flowState === "TRANSCRIBING" || flowState === "ANALYZING" || flowState === "PROCESSING" ? (
                    <div style={{ padding: "20px 0", textAlign: "center", color: "#666666" }}>
                      <p style={{ margin: 0, fontWeight: 500 }}>{statusMessage}</p>
                    </div>
                  ) : isEditingOutput ? (
                    <textarea
                      value={liveTransformedText}
                      onChange={(e) => setLiveTransformedText(e.target.value)}
                      rows={5}
                      style={{
                        width: "100%",
                        border: "1px solid #111111",
                        borderRadius: "6px",
                        padding: "10px",
                        fontSize: "0.9375rem",
                        fontFamily: "inherit",
                        lineHeight: 1.6,
                        outline: "none",
                        background: "#ffffff",
                        color: "#111111"
                      }}
                    />
                  ) : (
                    <div style={{ whiteSpace: "pre-line" }}>
                      {interactionMode === "live"
                        ? liveTransformedText || (
                            <span style={{ color: "#666666" }}>
                              Speak into your microphone or run a preset to view transformed writing.
                            </span>
                          )
                        : currentScenario.pipeline.transformation}
                    </div>
                  )}
                </div>

                {/* Pipeline Metadata Insights */}
                {flowState === "COMPLETE" && (
                  <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "6px", fontSize: "0.75rem" }}>
                    {livePipelineData ? (
                      <>
                        <span style={{ background: "#f5f5f5", color: "#111111", border: "1px solid #e5e5e5", padding: "2px 8px", borderRadius: "4px", fontWeight: 500 }}>
                          Language: {livePipelineData.language.primaryLanguage} ({livePipelineData.language.languageCode})
                        </span>
                        {livePipelineData.language.mixedLanguage && (
                          <span style={{ background: "#f5f5f5", color: "#111111", border: "1px solid #e5e5e5", padding: "2px 8px", borderRadius: "4px", fontWeight: 500 }}>
                            Mixed Multilingual ✓
                          </span>
                        )}
                        <span style={{ background: "#f5f5f5", color: "#666666", border: "1px solid #e5e5e5", padding: "2px 8px", borderRadius: "4px", fontWeight: 500 }}>
                          Audience: {livePipelineData.context.audience}
                        </span>
                        <span style={{ background: "#f5f5f5", color: "#666666", border: "1px solid #e5e5e5", padding: "2px 8px", borderRadius: "4px", fontWeight: 500 }}>
                          Format: {livePipelineData.transformation.transformation}
                        </span>
                      </>
                    ) : (
                      <>
                        <span style={{ background: "#f5f5f5", color: "#111111", border: "1px solid #e5e5e5", padding: "2px 8px", borderRadius: "4px", fontWeight: 500 }}>
                          Language: {currentScenario.pipeline.detectedLanguage.primary}
                        </span>
                        <span style={{ background: "#f5f5f5", color: "#666666", border: "1px solid #e5e5e5", padding: "2px 8px", borderRadius: "4px", fontWeight: 500 }}>
                          Channel: {currentScenario.pipeline.context.channel}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Output Actions Bar: Copy, Edit */}
              <div
                style={{
                  marginTop: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px"
                }}
              >
                <div>
                  {flowState === "COMPLETE" && (
                    <button
                      type="button"
                      onClick={() => setIsEditingOutput(!isEditingOutput)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#111111",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        textDecoration: "underline",
                        padding: 0
                      }}
                    >
                      {isEditingOutput ? "Save Edits" : "Edit Text"}
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {copiedToast && (
                    <span style={{ fontSize: "0.8125rem", color: "#111111", fontWeight: 600 }}>
                      Copied to clipboard ✓
                    </span>
                  )}

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      handleCopy(
                        interactionMode === "live"
                          ? liveTransformedText
                          : currentScenario.pipeline.transformation
                      )
                    }
                    disabled={flowState !== "COMPLETE"}
                    style={{ padding: "8px 14px", fontSize: "0.8125rem" }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    <span>Copy Text</span>
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
