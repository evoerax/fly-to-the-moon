import { describe, it, expect } from "vitest";
import { truncate } from "./truncate.js";

describe("truncate", () => {
  it("returns the string unchanged if within limit", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("returns the string unchanged if exactly at limit", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("truncates and adds ellipsis when over limit", () => {
    expect(truncate("hello world", 8)).toBe("hello w…");
  });

  it("handles limit of 1", () => {
    expect(truncate("hello", 1)).toBe("…");
  });

  it("returns empty string for empty input", () => {
    expect(truncate("", 10)).toBe("");
  });
});
