import { describe, expect, it } from "vitest";
import { buildServer } from "./server.js";

describe("VoxFlow API Server Endpoints", () => {
  const app = buildServer();

  it("GET /health should return status ok", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
    expect(body.service).toBe("voxflow-api");
    expect(body.timestamp).toBeDefined();
  });

  describe("POST /detect-language", () => {
    it("should return 400 when transcript is missing or empty", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/detect-language",
        payload: { transcript: "" }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toBeDefined();
    });

    it("should detect language for valid English text", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/detect-language",
        payload: { transcript: "Good morning team, let us review the quarterly release." }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.primaryLanguage.toLowerCase()).toContain("english");
      expect(body.languageCode).toBe("en");
      expect(body.mixedLanguage).toBe(false);
      expect(typeof body.confidence).toBe("number");
    }, 15000);

    it("should detect code-switching in Hinglish text", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/detect-language",
        payload: { transcript: "Arey Rohit kal subah staging environment check kar lena so clients don't face issues." }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.mixedLanguage).toBe(true);
      expect(body.languages.length).toBeGreaterThanOrEqual(2);
    }, 15000);
  });

  describe("POST /understand", () => {
    it("should return 400 when transcript is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/understand",
        payload: {}
      });

      expect(res.statusCode).toBe(400);
    });

    it("should extract intent and meaning from speech", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/understand",
        payload: { transcript: "Send an email to John telling him our budget was approved at fifty thousand dollars." }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.meaning).toBeDefined();
      expect(body.intent).toBeDefined();
      expect(body.importantDetails).toBeDefined();
    }, 15000);
  });

  describe("POST /detect-context", () => {
    it("should return 400 when transcript is empty", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/detect-context",
        payload: { transcript: "   " }
      });

      expect(res.statusCode).toBe(400);
    });

    it("should infer audience, formality, and channel", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/detect-context",
        payload: { transcript: "Hey Marcus, loved the deck, let us sync tomorrow morning regarding slide eight." }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.audience).toBeDefined();
      expect(body.tone).toBeDefined();
      expect(body.likelyChannel).toBeDefined();
    }, 15000);
  });

  describe("POST /transform", () => {
    it("should return 400 when transcript is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/transform",
        payload: {}
      });

      expect(res.statusCode).toBe(400);
    });

    it("should transform spoken thoughts into a polished message", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/transform",
        payload: {
          transcript: "tell sarah thanks for the q3 metrics and can she double check slide eight before morning sync",
          audience: "colleague",
          tone: "professional",
          likelyChannel: "email"
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.finalText).toBeDefined();
      expect(body.finalText.length).toBeGreaterThan(10);
    }, 15000);
  });

  describe("POST /process (Consolidated Pipeline)", () => {
    it("should execute the full 4-stage pipeline in one call", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/process",
        payload: {
          transcript: "Hey team please review the pull request before five pm today",
          targetLanguage: "English"
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.transcript).toBeDefined();
      expect(body.language).toBeDefined();
      expect(body.understanding).toBeDefined();
      expect(body.context).toBeDefined();
      expect(body.transformation?.finalText).toBeDefined();
    }, 25000);
  });

  describe("POST /meeting-notes", () => {
    it("should return 400 when transcript is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/meeting-notes",
        payload: {}
      });

      expect(res.statusCode).toBe(400);
    });

    it("should extract summary, key points, decisions, and action items", async () => {
      const sampleMeetingTranscript = `
        Alex: Marcus, thanks for joining. Q3 retention hit 68%.
        Marcus: The numbers look great. How do you plan to scale non-English users?
        Alex: We support natural code-switching like Hinglish and Spanglish directly.
        Marcus: Makes sense. Let us approve the three enterprise pilots starting November first.
        Priya: I will finalize the master service agreement with the FinTech pilot by Thursday.
        Alex: I will send you the updated latency benchmark numbers by Tuesday.
      `;

      const res = await app.inject({
        method: "POST",
        url: "/meeting-notes",
        payload: {
          transcript: sampleMeetingTranscript,
          title: "Series A Investor Sync"
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.title).toBeDefined();
      expect(body.summary).toBeDefined();
      expect(Array.isArray(body.keyPoints)).toBe(true);
      expect(Array.isArray(body.decisions)).toBe(true);
      expect(Array.isArray(body.actionItems)).toBe(true);
      expect(body.actionItems.length).toBeGreaterThanOrEqual(1);
    }, 25000);
  });

  describe("Meeting Records & User Isolation Endpoints (/meetings)", () => {
    it("should return empty list for a new user with no meetings", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/meetings",
        headers: {
          "x-user-id": "test_user_isolated_brand_new"
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body.meetings)).toBe(true);
      expect(body.meetings.length).toBe(0);
    });

    it("should create, retrieve, update, and isolate meetings per user", async () => {
      const userA = "test_user_alice";
      const userB = "test_user_bob";

      // 1. Create meeting for User A
      const createRes = await app.inject({
        method: "POST",
        url: "/meetings",
        headers: {
          "x-user-id": userA
        },
        payload: {
          id: "meeting_test_101",
          title: "Alice Roadmap Meeting",
          duration: "25 mins",
          status: "completed",
          primaryLanguages: ["English"]
        }
      });

      expect(createRes.statusCode).toBe(201);
      const createdBody = JSON.parse(createRes.body);
      expect(createdBody.success).toBe(true);
      expect(createdBody.meeting.title).toBe("Alice Roadmap Meeting");

      // 2. User A can retrieve it
      const getResA = await app.inject({
        method: "GET",
        url: "/meetings",
        headers: {
          "x-user-id": userA
        }
      });
      const listA = JSON.parse(getResA.body);
      expect(listA.meetings.some((m: any) => m.id === "meeting_test_101")).toBe(true);

      // 3. User B cannot see User A's meeting
      const getResB = await app.inject({
        method: "GET",
        url: "/meetings",
        headers: {
          "x-user-id": userB
        }
      });
      const listB = JSON.parse(getResB.body);
      expect(listB.meetings.some((m: any) => m.id === "meeting_test_101")).toBe(false);

      // 4. User B cannot access meeting 101 directly
      const directGetResB = await app.inject({
        method: "GET",
        url: "/meetings/meeting_test_101",
        headers: {
          "x-user-id": userB
        }
      });
      expect(directGetResB.statusCode).toBe(404);

      // 5. User A can update the meeting notes
      const patchRes = await app.inject({
        method: "PATCH",
        url: "/meetings/meeting_test_101",
        headers: {
          "x-user-id": userA
        },
        payload: {
          initialNotes: "Updated roadmap notes from session."
        }
      });
      expect(patchRes.statusCode).toBe(200);
      const patched = JSON.parse(patchRes.body);
      expect(patched.meeting.initialNotes).toBe("Updated roadmap notes from session.");

      // 6. User A can delete the meeting
      const delRes = await app.inject({
        method: "DELETE",
        url: "/meetings/meeting_test_101",
        headers: {
          "x-user-id": userA
        }
      });
      expect(delRes.statusCode).toBe(200);

      // 7. Meeting is gone for User A
      const finalGetResA = await app.inject({
        method: "GET",
        url: "/meetings/meeting_test_101",
        headers: {
          "x-user-id": userA
        }
      });
      expect(finalGetResA.statusCode).toBe(404);
    });
  });
});