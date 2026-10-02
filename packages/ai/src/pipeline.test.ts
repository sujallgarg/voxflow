import { describe, expect, it } from "vitest";
import { processVoxFlowInput } from "./pipeline";

describe("VoxFlow AI Pipeline", () => {
  it("should return the transcript", async () => {
    const result = await processVoxFlowInput({
      transcript: "Hello from VoxFlow"
    });

    expect(result.text).toBe("Hello from VoxFlow");
  });
});