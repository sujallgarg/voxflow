import { describe, expect, it } from "vitest";
import { isTrustedVoxFlowOrigin, isTrustedAuthSender } from "./auth-isolation.js";

describe("VoxFlow Chrome Extension Authentication Security Isolation", () => {
  describe("isTrustedVoxFlowOrigin", () => {
    it("should accept official production web app origins", () => {
      expect(isTrustedVoxFlowOrigin("https://voxflow.com")).toBe(true);
      expect(isTrustedVoxFlowOrigin("https://voxflow.com/#/meetings")).toBe(true);
      expect(isTrustedVoxFlowOrigin("https://www.voxflow.com")).toBe(true);
      expect(isTrustedVoxFlowOrigin("https://app.voxflow.com")).toBe(true);
      expect(isTrustedVoxFlowOrigin("https://voxflow-web.onrender.com")).toBe(true);
      expect(isTrustedVoxFlowOrigin("https://voxflow-one.vercel.app")).toBe(true);
      expect(isTrustedVoxFlowOrigin("https://voxflow-preview-123.vercel.app")).toBe(true);
    });

    it("should accept authorized local development origins", () => {
      expect(isTrustedVoxFlowOrigin("http://localhost:5173")).toBe(true);
      expect(isTrustedVoxFlowOrigin("http://localhost:5173/#/dashboard")).toBe(true);
      expect(isTrustedVoxFlowOrigin("http://127.0.0.1:5173")).toBe(true);
      expect(isTrustedVoxFlowOrigin("http://localhost:3000")).toBe(true);
    });

    it("should reject arbitrary third-party websites", () => {
      expect(isTrustedVoxFlowOrigin("https://google.com")).toBe(false);
      expect(isTrustedVoxFlowOrigin("https://github.com")).toBe(false);
      expect(isTrustedVoxFlowOrigin("https://reddit.com")).toBe(false);
      expect(isTrustedVoxFlowOrigin("https://facebook.com")).toBe(false);
    });

    it("should reject malicious homograph / spoofed domains", () => {
      // Must NOT be fooled by substring matching (e.g. hostname.includes("voxflow"))
      expect(isTrustedVoxFlowOrigin("https://attacker-voxflow.com")).toBe(false);
      expect(isTrustedVoxFlowOrigin("https://voxflow.attacker.com")).toBe(false);
      expect(isTrustedVoxFlowOrigin("https://fakevoxflow.com")).toBe(false);
      expect(isTrustedVoxFlowOrigin("http://attacker.com/voxflow.com")).toBe(false);
    });

    it("should reject insecure HTTP connections in production", () => {
      expect(isTrustedVoxFlowOrigin("http://voxflow.com")).toBe(false);
    });

    it("should reject empty, undefined, or malformed URLs", () => {
      expect(isTrustedVoxFlowOrigin(undefined)).toBe(false);
      expect(isTrustedVoxFlowOrigin("")).toBe(false);
      expect(isTrustedVoxFlowOrigin("not-a-valid-url")).toBe(false);
    });
  });

  describe("isTrustedAuthSender", () => {
    const extId = "abcdefghijklmnopabcdefghijklmnop";

    it("should allow messages from the extension's own pages", () => {
      expect(isTrustedAuthSender({ url: `chrome-extension://${extId}/popup.html`, id: extId }, extId)).toBe(true);
      expect(isTrustedAuthSender({ url: `chrome-extension://${extId}/offscreen.html`, id: extId }, extId)).toBe(true);
      expect(isTrustedAuthSender({ id: extId }, extId)).toBe(true);
    });

    it("should allow messages from verified VoxFlow web tabs", () => {
      expect(isTrustedAuthSender({ tab: { id: 1 }, url: "https://voxflow.com/#/meetings" }, extId)).toBe(true);
      expect(isTrustedAuthSender({ tab: { id: 1 }, url: "http://localhost:5173/#/meetings" }, extId)).toBe(true);
    });

    it("should block messages originating from external non-VoxFlow web tabs", () => {
      expect(isTrustedAuthSender({ tab: { id: 1 }, url: "https://github.com/login" }, extId)).toBe(false);
      expect(isTrustedAuthSender({ tab: { id: 1 }, url: "https://google.com" }, extId)).toBe(false);
      expect(isTrustedAuthSender({ tab: { id: 1 }, url: "https://attacker-voxflow.com" }, extId)).toBe(false);
      expect(isTrustedAuthSender({ tab: { id: 1 } }, extId)).toBe(false); // No URL provided by tab
    });
  });
});
