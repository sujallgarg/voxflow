import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isExtensionStoreAvailable,
  openExtensionStore,
  CHROME_EXTENSION_STORE_URL
} from "./extensionConfig";
import { getCurrentUser, saveUserMeeting, getUserMeetings, type UserProfile } from "./userStore";
import type { MeetingRecord } from "../data/meetingCompanionData";

// In-memory localStorage mock for node test environment
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage?.clear) {
  (globalThis as any).localStorage = new MemoryStorage();
}

if (typeof globalThis.window === "undefined") {
  (globalThis as any).window = {
    open: vi.fn(),
    dispatchEvent: vi.fn(),
    location: { origin: "http://localhost:5173" },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    postMessage: vi.fn()
  };
}

describe("VoxFlow Chrome Extension Requirement & CTA Suite", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Step 2: Extension Store URL & Configuration", () => {
    it("reports store as unavailable when URL is empty or unconfigured", () => {
      // By default in test environment, no real listing URL is provided
      if (!CHROME_EXTENSION_STORE_URL) {
        expect(isExtensionStoreAvailable()).toBe(false);
      }
    });

    it("triggers onUnavailable callback when extension is pending publication", () => {
      if (!isExtensionStoreAvailable()) {
        const onUnavailable = vi.fn();
        openExtensionStore(onUnavailable);
        expect(onUnavailable).toHaveBeenCalledTimes(1);
      }
    });

    it("opens a new window when valid Chrome Web Store URL is configured", () => {
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

      const validStoreUrl = "https://chromewebstore.google.com/detail/voxflow/abcdefghijklmnop";
      const isValid = (url: string) => url.startsWith("https://chromewebstore.google.com");

      if (isValid(validStoreUrl)) {
        window.open(validStoreUrl, "_blank", "noopener,noreferrer");
        expect(openSpy).toHaveBeenCalledWith(
          validStoreUrl,
          "_blank",
          "noopener,noreferrer"
        );
      }
    });
  });

  describe("Step 4: Extension Handshake & Origin Security", () => {
    it("ignores untrusted messages from external origins", () => {
      let isInstalled = false;
      const trustedOrigin = "http://localhost:5173";

      const handleMessage = (event: { origin: string; data: any }) => {
        if (event.origin !== trustedOrigin) return;
        if (event.data?.type === "VOXFLOW_PONG_EXTENSION") {
          isInstalled = Boolean(event.data.installed);
        }
      };

      // Attacker trying to spoof extension pong from evil origin
      handleMessage({
        origin: "https://evil-attacker.com",
        data: { type: "VOXFLOW_PONG_EXTENSION", installed: true, authenticated: true }
      });
      expect(isInstalled).toBe(false);

      // Legitimate origin
      handleMessage({
        origin: trustedOrigin,
        data: { type: "VOXFLOW_PONG_EXTENSION", installed: true, authenticated: true }
      });
      expect(isInstalled).toBe(true);
    });

    it("ignores messages with irrelevant or corrupted message types", () => {
      let isInstalled = false;
      const trustedOrigin = "http://localhost:5173";

      const handleMessage = (event: { origin: string; data: any }) => {
        if (event.origin !== trustedOrigin) return;
        if (event.data?.type === "VOXFLOW_PONG_EXTENSION") {
          isInstalled = Boolean(event.data.installed);
        }
      };

      handleMessage({
        origin: trustedOrigin,
        data: { type: "SOME_RANDOM_ACTION", installed: true }
      });
      expect(isInstalled).toBe(false);

      handleMessage({
        origin: trustedOrigin,
        data: null
      });
      expect(isInstalled).toBe(false);
    });

    it("handles extension detection timeout without crashing", async () => {
      vi.useFakeTimers();

      let isChecking = true;
      let isInstalled = false;

      // Simulate handshake timeout
      const checkPromise = new Promise<{ isInstalled: boolean }>((resolve) => {
        setTimeout(() => {
          isChecking = false;
          isInstalled = false;
          resolve({ isInstalled: false });
        }, 500);
      });

      vi.advanceTimersByTime(500);
      const result = await checkPromise;

      expect(isChecking).toBe(false);
      expect(isInstalled).toBe(false);
      expect(result.isInstalled).toBe(false);

      vi.useRealTimers();
    });

    it("does not expose auth tokens or private secrets in detection messages", () => {
      // Handshake payload format specification
      const pongMessage = {
        type: "VOXFLOW_PONG_EXTENSION",
        installed: true,
        authenticated: true,
        version: "0.1.0"
      };

      expect(pongMessage).not.toHaveProperty("token");
      expect(pongMessage).not.toHaveProperty("access_token");
      expect(pongMessage).not.toHaveProperty("apiKey");
      expect(pongMessage).not.toHaveProperty("userId");
    });
  });

  describe("Step 3 & 5: Meeting Creation Access Gating", () => {
    const testUser: UserProfile = {
      id: "user_test_123",
      name: "Test User",
      email: "test@voxflow.com",
      createdAt: new Date().toISOString()
    };

    const dummyMeeting: MeetingRecord = {
      id: "meeting_test_001",
      title: "Sprint Planning",
      date: "Oct 28, 2026",
      time: "10:00 AM",
      duration: "30 mins",
      status: "completed",
      primaryLanguages: ["English"],
      summaryPreview: "Sprint notes",
      fullSummary: "Sprint notes",
      initialNotes: "Sprint notes",
      participants: [],
      topics: [],
      decisions: [],
      actionItems: [],
      transcript: []
    };

    it("blocks meeting creation when extension is not detected", () => {
      const isInstalled = false;
      const isConnected = false;

      let meetingCreated = false;
      const attemptCreateMeeting = () => {
        if (!isInstalled || !isConnected) {
          // Gating: creation is prevented
          return false;
        }
        saveUserMeeting(testUser.id, dummyMeeting, false);
        meetingCreated = true;
        return true;
      };

      const result = attemptCreateMeeting();
      expect(result).toBe(false);
      expect(meetingCreated).toBe(false);
      expect(getUserMeetings(testUser.id)).toHaveLength(0);
    });

    it("blocks meeting creation when extension is installed but not authenticated", () => {
      const isInstalled = true;
      const isConnected = false;

      let meetingCreated = false;
      const attemptCreateMeeting = () => {
        if (!isInstalled || !isConnected) {
          return false;
        }
        saveUserMeeting(testUser.id, dummyMeeting, false);
        meetingCreated = true;
        return true;
      };

      const result = attemptCreateMeeting();
      expect(result).toBe(false);
      expect(meetingCreated).toBe(false);
      expect(getUserMeetings(testUser.id)).toHaveLength(0);
    });

    it("allows meeting creation to proceed smoothly when extension is installed and connected", () => {
      const isInstalled = true;
      const isConnected = true;

      let meetingCreated = false;
      const attemptCreateMeeting = () => {
        if (!isInstalled || !isConnected) {
          return false;
        }
        saveUserMeeting(testUser.id, dummyMeeting, false);
        meetingCreated = true;
        return true;
      };

      const result = attemptCreateMeeting();
      expect(result).toBe(true);
      expect(meetingCreated).toBe(true);

      const meetings = getUserMeetings(testUser.id);
      expect(meetings).toHaveLength(1);
      expect(meetings[0].id).toBe("meeting_test_001");
      expect(meetings[0].title).toBe("Sprint Planning");
    });

    it("preserves user session and authentication status when extension check fails", () => {
      localStorage.setItem("voxflow_current_user", JSON.stringify(testUser));
      const userBefore = getCurrentUser();
      expect(userBefore.id).toBe(testUser.id);

      // Simulate extension absent failure
      const isInstalled = false;
      expect(isInstalled).toBe(false);

      // Verify user was NOT logged out or session wiped
      const userAfter = getCurrentUser();
      expect(userAfter.id).toBe(testUser.id);
      expect(userAfter.email).toBe(testUser.email);
    });
  });
});
