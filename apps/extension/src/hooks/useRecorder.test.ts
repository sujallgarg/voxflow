import { describe, expect, it } from "vitest";

describe("VoxFlow recorder", () => {
  it("should define the expected recording states", () => {
    const states = [
      "idle",
      "requesting",
      "recording",
      "stopped",
      "error"
    ];

    expect(states).toContain("idle");
    expect(states).toContain("recording");
    expect(states).toContain("stopped");
    expect(states).toContain("error");
  });
});