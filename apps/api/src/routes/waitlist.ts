import type { FastifyPluginAsync } from "fastify";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../data");
const WAITLIST_FILE = path.join(DATA_DIR, "waitlist.json");

interface WaitlistEntry {
  email: string;
  source: string;
  marketingConsent?: boolean;
  createdAt: string;
}

function loadWaitlist(): WaitlistEntry[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(WAITLIST_FILE)) {
      const raw = fs.readFileSync(WAITLIST_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn("Could not read waitlist file:", err);
  }
  return [];
}

function saveWaitlist(entries: WaitlistEntry[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${WAITLIST_FILE}.${Date.now()}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(entries, null, 2), "utf-8");
    fs.renameSync(tempFile, WAITLIST_FILE);
  } catch (err) {
    console.error("Could not write waitlist file:", err);
  }
}

const waitlistRoute: FastifyPluginAsync = async (app) => {
  app.post("/waitlist", async (request, reply) => {
    const body = request.body as {
      email?: string;
      source?: string;
      marketingConsent?: boolean;
    } | undefined;
    const email = body?.email?.trim().toLowerCase();

    if (!email) {
      return reply.code(400).send({
        error: "Email is required.",
        code: "MISSING_EMAIL"
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return reply.code(400).send({
        error: "Invalid email address format.",
        code: "INVALID_EMAIL"
      });
    }

    const entries = loadWaitlist();
    const existing = entries.find((e) => e.email === email);

    if (!existing) {
      entries.push({
        email,
        source: body?.source || "website_modal",
        marketingConsent: Boolean(body?.marketingConsent),
        createdAt: new Date().toISOString()
      });
      saveWaitlist(entries);
    }

    return reply.code(201).send({
      success: true,
      message: "Successfully registered for VoxFlow private beta waitlist.",
      email
    });
  });

  app.get("/waitlist/count", async () => {
    const entries = loadWaitlist();
    return { count: entries.length };
  });
};

export default waitlistRoute;
