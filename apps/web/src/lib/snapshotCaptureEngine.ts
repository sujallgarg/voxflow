import type { MeetingSnapshot, SnapshotCategory } from "../data/meetingCompanionData";
import { api } from "./api";

export interface FrameEvaluationResult {
  shouldCapture: boolean;
  isBlank: boolean;
  isUnchanged: boolean;
  diffRatio: number;
  reason: string;
}

/**
 * Lightweight client-side frame analyzer using a 32x32 downsampled buffer
 * Prevents unnecessary API calls for blank, repeated, or unchanged frames.
 */
export class FrameDiffAnalyzer {
  private lastBuffer: Uint8ClampedArray | null = null;
  private canvas32: HTMLCanvasElement;
  private ctx32: CanvasRenderingContext2D;
  private minDiffThreshold = 0.08; // 8% difference required to count as a slide/content change

  constructor(threshold = 0.08) {
    this.minDiffThreshold = threshold;
    this.canvas32 = document.createElement("canvas");
    this.canvas32.width = 32;
    this.canvas32.height = 32;
    const ctx = this.canvas32.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Could not create 2D canvas context");
    this.ctx32 = ctx;
  }

  public reset(): void {
    this.lastBuffer = null;
  }

  /**
   * Evaluates if a video element or source canvas has meaningful new visual content
   */
  public evaluateFrame(source: HTMLVideoElement | HTMLCanvasElement): FrameEvaluationResult {
    this.ctx32.drawImage(source, 0, 0, 32, 32);
    const imgData = this.ctx32.getImageData(0, 0, 32, 32);
    const data = imgData.data;

    let sum = 0;
    let sumSq = 0;
    const totalPixels = 32 * 32;

    // 1. Calculate luminance and variance across pixels
    for (let i = 0; i < data.length; i += 4) {
      // Relative luminance
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += lum;
      sumSq += lum * lum;
    }

    const mean = sum / totalPixels;
    const variance = sumSq / totalPixels - mean * mean;

    // Black screen or webcam blackout (mean < 12)
    if (mean < 12) {
      return {
        shouldCapture: false,
        isBlank: true,
        isUnchanged: false,
        diffRatio: 0,
        reason: "Frame is too dark or blank"
      };
    }

    // Completely uniform / solid monochrome loading screen (variance < 6)
    if (variance < 6) {
      return {
        shouldCapture: false,
        isBlank: true,
        isUnchanged: false,
        diffRatio: 0,
        reason: "Solid uniform loading or blank screen"
      };
    }

    // 2. Compare with previous frame buffer
    if (!this.lastBuffer) {
      // First valid frame of meeting: accept it
      this.lastBuffer = new Uint8ClampedArray(data);
      return {
        shouldCapture: true,
        isBlank: false,
        isUnchanged: false,
        diffRatio: 1.0,
        reason: "Initial meeting frame"
      };
    }

    let diffSum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const lum1 = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const lum2 = 0.299 * this.lastBuffer[i] + 0.587 * this.lastBuffer[i + 1] + 0.114 * this.lastBuffer[i + 2];
      diffSum += Math.abs(lum1 - lum2);
    }

    const diffRatio = diffSum / (totalPixels * 255);

    if (diffRatio < this.minDiffThreshold) {
      return {
        shouldCapture: false,
        isBlank: false,
        isUnchanged: true,
        diffRatio,
        reason: `Screen unchanged (${(diffRatio * 100).toFixed(1)}% difference)`
      };
    }

    // Visual change detected! Update buffer
    this.lastBuffer.set(data);

    return {
      shouldCapture: true,
      isBlank: false,
      isUnchanged: false,
      diffRatio,
      reason: `Significant screen change detected (${(diffRatio * 100).toFixed(1)}%)`
    };
  }
}

/**
 * Captures high-resolution frame from a video element to JPEG Data URL
 */
export function captureHighResFrame(
  video: HTMLVideoElement,
  maxWidth = 1280,
  maxHeight = 720,
  quality = 0.85
): string {
  const canvas = document.createElement("canvas");
  const origW = video.videoWidth || 1280;
  const origH = video.videoHeight || 720;

  let targetW = origW;
  let targetH = origH;

  if (targetW > maxWidth || targetH > maxHeight) {
    const ratio = Math.min(maxWidth / targetW, maxHeight / targetH);
    targetW = Math.round(targetW * ratio);
    targetH = Math.round(targetH * ratio);
  }

  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.drawImage(video, 0, 0, targetW, targetH);
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Smart Meeting Snapshot Manager
 * Manages periodic frame analysis and AI categorization during online meetings
 */
export class SmartMeetingSnapshotManager {
  private videoEl: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private analyzer = new FrameDiffAnalyzer(0.08);
  private checkIntervalTimer: any = null;
  private isCapturing = false;
  private isPaused = false;
  private meetingTitle = "";
  private meetingId = "";
  private onSnapshotCallback?: (snapshot: MeetingSnapshot) => void;
  private onStatusChangeCallback?: (status: { isActive: boolean; isPaused: boolean; count: number }) => void;
  private snapshotCount = 0;
  private lastCapturedTimestamp = 0;
  private minIntervalBetweenAutoSnapsMs = 8000; // at most 1 auto-snapshot every 8s

  constructor(meetingId?: string, meetingTitle?: string) {
    this.meetingId = meetingId || `meeting_${Date.now()}`;
    this.meetingTitle = meetingTitle || "Online Meeting";
  }

  public setMeetingContext(id: string, title: string): void {
    this.meetingId = id;
    this.meetingTitle = title;
  }

  public onSnapshot(cb: (snapshot: MeetingSnapshot) => void): void {
    this.onSnapshotCallback = cb;
  }

  public onStatusChange(cb: (status: { isActive: boolean; isPaused: boolean; count: number }) => void): void {
    this.onStatusChangeCallback = cb;
  }

  private notifyStatus(): void {
    this.onStatusChangeCallback?.({
      isActive: this.isCapturing,
      isPaused: this.isPaused,
      count: this.snapshotCount
    });
  }

  /**
   * Attach to an existing or new MediaStream containing video tracks (e.g. from getDisplayMedia)
   */
  public attachStream(stream: MediaStream): boolean {
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) {
      console.warn("[SmartMeetingSnapshotManager] Stream has no video tracks");
      return false;
    }

    this.stream = stream;

    if (!this.videoEl) {
      this.videoEl = document.createElement("video");
      this.videoEl.autoplay = true;
      this.videoEl.muted = true;
      this.videoEl.playsInline = true;
      this.videoEl.style.display = "none";
      document.body.appendChild(this.videoEl);
    }

    this.videoEl.srcObject = stream;
    this.videoEl.play().catch(() => {});

    // Listen for track ended (e.g. user stops sharing in Chrome's native bar)
    videoTracks[0].addEventListener("ended", () => {
      this.stop();
    });

    return true;
  }

  /**
   * Request display media from the user specifically for smart snapshot capture
   */
  public async requestMeetingTabMedia(): Promise<boolean> {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error("Display capture is not supported in this browser. Please use Chrome or Edge.");
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: "browser",
        frameRate: { max: 15 }
      },
      audio: false
    });

    return this.attachStream(stream);
  }

  /**
   * Start periodic smart frame evaluation
   */
  public start(sampleIntervalMs = 3500): void {
    if (this.isCapturing && !this.isPaused) return;

    this.isCapturing = true;
    this.isPaused = false;
    this.analyzer.reset();
    this.notifyStatus();

    if (this.checkIntervalTimer) clearInterval(this.checkIntervalTimer);
    this.checkIntervalTimer = setInterval(() => {
      this.checkAndProcessFrame(false);
    }, sampleIntervalMs);

    // Initial check after video stream stabilizes
    setTimeout(() => {
      this.checkAndProcessFrame(false);
    }, 1200);
  }

  public pause(): void {
    this.isPaused = true;
    this.notifyStatus();
  }

  public resume(): void {
    if (!this.isCapturing) {
      this.start();
      return;
    }
    this.isPaused = false;
    this.notifyStatus();
  }

  public stop(): void {
    this.isCapturing = false;
    this.isPaused = false;
    if (this.checkIntervalTimer) {
      clearInterval(this.checkIntervalTimer);
      this.checkIntervalTimer = null;
    }

    if (this.videoEl) {
      try {
        this.videoEl.pause();
        this.videoEl.srcObject = null;
        this.videoEl.remove();
      } catch {}
      this.videoEl = null;
    }

    if (this.stream) {
      try {
        this.stream.getTracks().forEach((t) => t.stop());
      } catch {}
      this.stream = null;
    }

    this.notifyStatus();
  }

  /**
   * Manually snap the current frame immediately
   */
  public async snapManual(): Promise<MeetingSnapshot | null> {
    if (!this.videoEl || this.videoEl.readyState < 2) {
      return null;
    }
    return await this.checkAndProcessFrame(true);
  }

  private async checkAndProcessFrame(isManual = false): Promise<MeetingSnapshot | null> {
    if (!this.videoEl || this.videoEl.readyState < 2) return null;
    if (!isManual && this.isPaused) return null;

    const now = Date.now();
    if (!isManual && now - this.lastCapturedTimestamp < this.minIntervalBetweenAutoSnapsMs) {
      return null;
    }

    // Run client-side frame-diff evaluation
    const evalResult = this.analyzer.evaluateFrame(this.videoEl);

    if (!isManual && !evalResult.shouldCapture) {
      return null;
    }

    this.lastCapturedTimestamp = now;

    // Capture high-res frame
    const imageUrl = captureHighResFrame(this.videoEl, 1280, 720, 0.85);
    if (!imageUrl) return null;

    const timeString = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

    // Call backend vision evaluation (or fallback gracefully)
    let category: SnapshotCategory = "Slide";
    let description = isManual
      ? `Manual snapshot taken during ${this.meetingTitle}`
      : `Shared presentation slide captured during ${this.meetingTitle}`;

    try {
      const res = await api.analyzeMeetingSnapshot(imageUrl, {
        meetingTitle: this.meetingTitle,
        manual: isManual,
        timestamp: timeString,
        meetingId: this.meetingId
      });

      if (res && res.success) {
        if (!isManual && !res.isUseful) {
          // AI classified frame as non-informative (e.g. webcam-only or transition blur)
          return null;
        }
        category = (res.category as SnapshotCategory) || "Slide";
        description = res.description || description;
      }
    } catch (err) {
      console.warn("[SmartMeetingSnapshotManager] Backend vision notice, using heuristic descriptor:", err);
    }

    const snapshot: MeetingSnapshot = {
      id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      meetingId: this.meetingId,
      timestamp: timeString,
      capturedAt: now,
      imageUrl,
      title: `${category} Snapshot (${timeString})`,
      description,
      category,
      manual: isManual
    };

    this.snapshotCount++;
    this.notifyStatus();
    this.onSnapshotCallback?.(snapshot);

    return snapshot;
  }

  public getStatus(): { isActive: boolean; isPaused: boolean; hasStream: boolean; count: number } {
    return {
      isActive: this.isCapturing,
      isPaused: this.isPaused,
      hasStream: Boolean(this.stream && this.stream.active),
      count: this.snapshotCount
    };
  }
}
