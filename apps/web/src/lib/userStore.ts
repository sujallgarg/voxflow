/**
 * User Store & Session Data Management
 *
 * Ensures each user has an isolated workspace containing only their own records.
 * Default state for new users is empty ([]).
 * No preloaded or hardcoded sample data.
 */

import type { MeetingRecord } from "../data/meetingCompanionData";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  createdAt: string;
}

export interface SavedTranscription {
  id: string;
  title: string;
  transcript: string;
  transformedText?: string;
  language?: string;
  createdAt: string;
}

export interface UserStats {
  totalMeetings: number;
  upcomingMeetings: number;
  completedMeetings: number;
  totalTranscriptions: number;
}

// Default current user profile
const DEFAULT_USER: UserProfile = {
  id: "user_me",
  name: "My Account",
  email: "user@voxflow.ai",
  createdAt: new Date().toISOString()
};

const USER_SESSION_KEY = "voxflow_current_user";

/**
 * Get the active authenticated/session user profile.
 */
export function getCurrentUser(): UserProfile {
  try {
    const raw = localStorage.getItem(USER_SESSION_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Error reading user profile:", e);
  }
  return DEFAULT_USER;
}

/**
 * Switch or update current user profile (useful for testing user data isolation).
 */
export function setCurrentUser(user: UserProfile): void {
  try {
    localStorage.setItem(USER_SESSION_KEY, JSON.stringify(user));
    window.dispatchEvent(new Event("voxflow_user_changed"));
  } catch (e) {
    console.warn("Error saving user profile:", e);
  }
}

import { api } from "./api";

/**
 * Fetch meeting records belonging ONLY to the given user.
 * Returns empty array [] for any new user.
 */
export function getUserMeetings(userId: string): MeetingRecord[] {
  try {
    const key = `voxflow_user_meetings_${userId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn(`Error reading meetings for user ${userId}:`, e);
    return [];
  }
}

/**
 * Asynchronously synchronizes meetings from backend API with local cache.
 */
export async function syncMeetingsFromBackend(userId: string): Promise<MeetingRecord[]> {
  try {
    const { meetings: backendMeetings } = await api.getMeetings(userId);
    if (Array.isArray(backendMeetings)) {
      const localMeetings = getUserMeetings(userId);
      const mergedMap = new Map<string, MeetingRecord>();

      // Put local meetings first
      for (const m of localMeetings) {
        mergedMap.set(m.id, m);
      }
      // Overwrite/merge with backend source-of-truth
      for (const m of backendMeetings) {
        mergedMap.set(m.id, m);
      }

      const mergedList = Array.from(mergedMap.values()).sort((a, b) =>
        (b.date || "").localeCompare(a.date || "")
      );

      localStorage.setItem(`voxflow_user_meetings_${userId}`, JSON.stringify(mergedList));
      window.dispatchEvent(new Event("voxflow_data_changed"));
      return mergedList;
    }
  } catch (e) {
    // Graceful offline fallback
    console.warn("Backend meetings sync notice (using local storage cache):", e);
  }
  return getUserMeetings(userId);
}

/**
 * Save or update a meeting record for the specified user both locally and on backend.
 */
export function saveUserMeeting(userId: string, meeting: MeetingRecord): void {
  try {
    const meetings = getUserMeetings(userId);
    const existingIndex = meetings.findIndex((m) => m.id === meeting.id);
    if (existingIndex >= 0) {
      meetings[existingIndex] = meeting;
    } else {
      meetings.unshift(meeting);
    }
    localStorage.setItem(`voxflow_user_meetings_${userId}`, JSON.stringify(meetings));
    window.dispatchEvent(new Event("voxflow_data_changed"));

    // Async sync to backend
    api.saveMeeting(meeting, userId).catch((err) => {
      console.warn("Notice: could not save meeting to backend, cached locally:", err);
    });
  } catch (e) {
    console.warn(`Error saving meeting for user ${userId}:`, e);
  }
}

/**
 * Delete a meeting record for the specified user both locally and on backend.
 */
export function deleteUserMeeting(userId: string, meetingId: string): void {
  try {
    const meetings = getUserMeetings(userId);
    const filtered = meetings.filter((m) => m.id !== meetingId);
    localStorage.setItem(`voxflow_user_meetings_${userId}`, JSON.stringify(filtered));
    window.dispatchEvent(new Event("voxflow_data_changed"));

    // Async delete from backend
    api.deleteMeeting(meetingId, userId).catch((err) => {
      console.warn("Notice: could not delete meeting from backend:", err);
    });
  } catch (e) {
    console.warn(`Error deleting meeting for user ${userId}:`, e);
  }
}

/**
 * Fetch saved voice transcriptions belonging ONLY to the given user.
 * Returns empty array [] for any new user.
 */
export function getUserTranscriptions(userId: string): SavedTranscription[] {
  try {
    const key = `voxflow_user_transcripts_${userId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn(`Error reading transcriptions for user ${userId}:`, e);
    return [];
  }
}

/**
 * Save a new transcription for the specified user.
 */
export function saveUserTranscription(userId: string, item: SavedTranscription): void {
  try {
    const items = getUserTranscriptions(userId);
    const existingIndex = items.findIndex((t) => t.id === item.id);
    if (existingIndex >= 0) {
      items[existingIndex] = item;
    } else {
      items.unshift(item);
    }
    localStorage.setItem(`voxflow_user_transcripts_${userId}`, JSON.stringify(items));
    window.dispatchEvent(new Event("voxflow_data_changed"));
  } catch (e) {
    console.warn(`Error saving transcription for user ${userId}:`, e);
  }
}

/**
 * Delete a transcription for the specified user.
 */
export function deleteUserTranscription(userId: string, id: string): void {
  try {
    const items = getUserTranscriptions(userId);
    const filtered = items.filter((t) => t.id !== id);
    localStorage.setItem(`voxflow_user_transcripts_${userId}`, JSON.stringify(filtered));
    window.dispatchEvent(new Event("voxflow_data_changed"));
  } catch (e) {
    console.warn(`Error deleting transcription for user ${userId}:`, e);
  }
}

/**
 * Calculate dashboard statistics from actual user-persisted records.
 * Returns exact zero (0) states when no records exist.
 */
export function calculateUserStats(userId: string): UserStats {
  const meetings = getUserMeetings(userId);
  const transcriptions = getUserTranscriptions(userId);

  return {
    totalMeetings: meetings.length,
    upcomingMeetings: meetings.filter((m) => m.status === "upcoming").length,
    completedMeetings: meetings.filter((m) => m.status === "completed").length,
    totalTranscriptions: transcriptions.length
  };
}
