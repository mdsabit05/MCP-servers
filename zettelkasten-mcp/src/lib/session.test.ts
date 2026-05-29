import { describe, it, expect } from "vitest";
import { extractBearerToken } from "./session.js";

describe("extractBearerToken", () => {
  it("extracts token from valid Authorization header", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
  });

  it("returns null for missing header", () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it("returns null for non-Bearer scheme", () => {
    expect(extractBearerToken("Basic abc123")).toBeNull();
  });
});
