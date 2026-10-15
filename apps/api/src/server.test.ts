import { describe, expect, it, beforeEach } from "vitest";
import { buildServer } from "./server.js";
import { generateAuthToken, verifyAuthToken, setSupabaseClientForTesting } from "./services/auth.service.js";
import { resetRateLimits } from "./middleware/rate-limiter.js";

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

    it("should reject non-multipart requests to /meetings/process-recording", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/meetings/process-recording",
        headers: {
          "content-type": "application/json",
          "x-user-id": "test_user_alice"
        },
        payload: { title: "Test" }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.code).toBe("NOT_MULTIPART");
    });

    it("should preserve full meeting structure for web workspace direct navigation", async () => {
      const user = "test_user_workspace_nav";
      const meetingId = `direct_nav_${Date.now()}`;

      const createRes = await app.inject({
        method: "POST",
        url: "/meetings",
        headers: { "x-user-id": user },
        payload: {
          id: meetingId,
          title: "Sprint Review Direct Navigation",
          fullSummary: "Discussed frontend release and extension stabilization.",
          summaryPreview: "Discussed frontend release...",
          initialNotes: "Key Discussion Points:\n• Release on schedule",
          actionItems: [
            { id: "act_1", task: "Deploy staging build", assignee: "Dev", dueDate: "Friday", completed: false }
          ],
          decisions: [
            { id: "dec_1", decision: "Proceed with controlled beta", context: "All tests passing" }
          ],
          topics: [
            { id: "top_1", title: "Release Plan", timeRange: "Session", summary: "Beta roadmap" }
          ],
          transcript: [
            {
              id: "utt_1",
              speakerId: "spk_1",
              speakerName: "Alex",
              speakerRole: "Host",
              isCurrentUser: true,
              timestamp: "00:00",
              originalLanguage: "English",
              originalText: "Welcome to sprint review."
            }
          ]
        }
      });

      expect(createRes.statusCode).toBe(201);

      const getRes = await app.inject({
        method: "GET",
        url: `/meetings/${meetingId}`,
        headers: { "x-user-id": user }
      });

      expect(getRes.statusCode).toBe(200);
      const data = JSON.parse(getRes.body);
      expect(data.meeting.id).toBe(meetingId);
      expect(data.meeting.title).toBe("Sprint Review Direct Navigation");
      expect(data.meeting.fullSummary).toContain("Discussed frontend release");
      expect(data.meeting.actionItems.length).toBe(1);
      expect(data.meeting.decisions.length).toBe(1);
      expect(data.meeting.topics.length).toBe(1);
      expect(data.meeting.transcript.length).toBe(1);
    });
  });

  describe("Authentication, Cryptographic Signing & Anti-Impersonation", () => {
    it("should generate and verify valid cryptographic tokens", () => {
      const token = generateAuthToken("user_alice_test");
      expect(typeof token).toBe("string");
      const verified = verifyAuthToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.id).toBe("user_alice_test");
    });

    it("should reject tampered or forged tokens", () => {
      const token = generateAuthToken("user_alice_test");
      const parts = token.split(".");
      // Tamper with payload
      const tampered = `user_hacker.${parts[1]}.${parts[2]}`;
      expect(verifyAuthToken(tampered)).toBeNull();
      expect(verifyAuthToken("malformed-token-string")).toBeNull();
    });

    it("should reject impersonation when client-supplied x-user-id mismatches authenticated token", async () => {
      const aliceToken = generateAuthToken("user_alice_verified");

      const res = await app.inject({
        method: "GET",
        url: "/meetings",
        headers: {
          authorization: `Bearer ${aliceToken}`,
          "x-user-id": "user_bob_target" // Attacker trying to spoof Bob
        }
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.code).toBe("IMPERSONATION_FORBIDDEN");
    });

    it("should accept valid authenticated token matching x-user-id or standalone token", async () => {
      const aliceToken = generateAuthToken("user_alice_verified");

      const res = await app.inject({
        method: "GET",
        url: "/meetings",
        headers: {
          authorization: `Bearer ${aliceToken}`
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body.meetings)).toBe(true);
    });
  });

  describe("Waitlist API (/waitlist)", () => {
    it("should reject submission without email", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/waitlist",
        payload: {}
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.code).toBe("MISSING_EMAIL");
    });

    it("should reject invalid email format", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/waitlist",
        payload: { email: "not-an-email" }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.code).toBe("INVALID_EMAIL");
    });

    it("should accept valid email and register for private beta", async () => {
      const uniqueEmail = `beta_tester_${Date.now()}@example.com`;
      const res = await app.inject({
        method: "POST",
        url: "/waitlist",
        payload: { email: uniqueEmail, source: "website_modal_test", marketingConsent: true }
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.email).toBe(uniqueEmail.toLowerCase());
    });

    it("should sanitize and never leak environment secrets in error responses", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/meetings",
        headers: { "x-user-id": "test_leak_check" },
        payload: { invalid: "schema_payload_triggering_validation" }
      });

      const bodyStr = res.body;
      expect(bodyStr).not.toContain(process.env.AUTH_SECRET || "default_auth_secret_never_leak");
      expect(bodyStr).not.toContain(process.env.GEMINI_API_KEY || "never_leak_gemini_key");
      expect(bodyStr).not.toContain(process.env.GROQ_API_KEY || "never_leak_groq_key");
    });
  });

  describe("API Rate Limiting Protection", () => {
    beforeEach(() => {
      resetRateLimits();
    });

    it("should include x-ratelimit headers on responses", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/waitlist/count"
      });

      expect(res.headers["x-ratelimit-limit"]).toBeDefined();
      expect(res.headers["x-ratelimit-remaining"]).toBeDefined();
    });

    it("should return 429 when client exceeds request limit", async () => {
      const spammerUser = "user_spammer_test_999";

      // Send 125 requests in rapid sequence to trigger the 120 limit
      let lastRes;
      for (let i = 0; i < 125; i++) {
        lastRes = await app.inject({
          method: "GET",
          url: "/waitlist/count",
          headers: { "x-user-id": spammerUser }
        });
        if (lastRes.statusCode === 429) {
          break;
        }
      }

      expect(lastRes?.statusCode).toBe(429);
      const body = JSON.parse(lastRes?.body || "{}");
      expect(body.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(lastRes?.headers["retry-after"]).toBeDefined();
    });
  });

  describe("Authentication, Authorization & Data Isolation", () => {
    const userA = "user_auth_a_123";
    const userB = "user_auth_b_456";
    const tokenA = generateAuthToken(userA);
    const tokenB = generateAuthToken(userB);

    it("should reject requests with invalid or malformed bearer tokens", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/meetings",
        headers: {
          authorization: "Bearer invalid.malformed.token.xyz"
        }
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code).toBe("INVALID_AUTH_TOKEN");
    });

    it("should reject requests attempting to spoof x-user-id that does not match authenticated token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/meetings",
        headers: {
          authorization: `Bearer ${tokenA}`,
          "x-user-id": userB // Client attempting to impersonate userB while presenting userA's token
        }
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.code).toBe("IMPERSONATION_FORBIDDEN");
    });

    it("should enforce cross-user meeting isolation (User B cannot access or delete User A's meeting)", async () => {
      const meetingId = `meeting_isolation_${Date.now()}`;

      // 1. User A creates a meeting
      const createRes = await app.inject({
        method: "POST",
        url: "/meetings",
        headers: {
          authorization: `Bearer ${tokenA}`
        },
        payload: {
          id: meetingId,
          title: "Confidential Strategy Session",
          duration: "30m"
        }
      });

      expect(createRes.statusCode).toBe(201);

      // 2. User A can retrieve it
      const getResA = await app.inject({
        method: "GET",
        url: `/meetings/${meetingId}`,
        headers: {
          authorization: `Bearer ${tokenA}`
        }
      });
      expect(getResA.statusCode).toBe(200);

      // 3. User B cannot retrieve it (returns 404)
      const getResB = await app.inject({
        method: "GET",
        url: `/meetings/${meetingId}`,
        headers: {
          authorization: `Bearer ${tokenB}`
        }
      });
      expect(getResB.statusCode).toBe(404);
      const bodyB = JSON.parse(getResB.body);
      expect(bodyB.code).toBe("MEETING_NOT_FOUND");

      // 4. User B cannot delete it (returns 404)
      const deleteResB = await app.inject({
        method: "DELETE",
        url: `/meetings/${meetingId}`,
        headers: {
          authorization: `Bearer ${tokenB}`
        }
      });
      expect(deleteResB.statusCode).toBe(404);

      // 5. User A can delete their own meeting
      const deleteResA = await app.inject({
        method: "DELETE",
        url: `/meetings/${meetingId}`,
        headers: {
          authorization: `Bearer ${tokenA}`
        }
      });
      expect(deleteResA.statusCode).toBe(200);
    });

    it("should authenticate Supabase JWT tokens via Supabase Auth client", async () => {
      const mockSupabaseUserId = "550e8400-e29b-41d4-a716-446655440000";

      // Mock Supabase client returning valid user for mock token
      const mockSupabase = {
        auth: {
          getUser: async (jwt: string) => {
            if (jwt === "valid-supabase-jwt") {
              return {
                data: {
                  user: {
                    id: mockSupabaseUserId,
                    email: "testuser@voxflow.ai",
                    role: "authenticated"
                  }
                },
                error: null
              };
            }
            return {
              data: { user: null },
              error: new Error("Invalid JWT")
            };
          }
        }
      } as any;

      setSupabaseClientForTesting(mockSupabase);

      try {
        // Successful verification with valid Supabase JWT
        const resValid = await app.inject({
          method: "GET",
          url: "/meetings",
          headers: {
            authorization: "Bearer valid-supabase-jwt"
          }
        });
        expect(resValid.statusCode).toBe(200);

        // Rejection with invalid Supabase JWT
        const resInvalid = await app.inject({
          method: "GET",
          url: "/meetings",
          headers: {
            authorization: "Bearer invalid-supabase-jwt"
          }
        });
        expect(resInvalid.statusCode).toBe(401);
      } finally {
        setSupabaseClientForTesting(null);
      }
    });
  });
});