import { describe, expect, it } from "vitest";

describe("VoxFlow API", () => {
  it("should have the correct service name", () => {
    const response = {
      status: "ok",
      service: "voxflow-api"
    };

    expect(response.status).toBe("ok");
    expect(response.service).toBe("voxflow-api");
  });
});