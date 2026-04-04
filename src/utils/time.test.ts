import { describe, it, expect } from "vitest";
import { formatElapsed } from "./time.js";

describe("formatElapsed", () => {
  it("formats zero milliseconds", () => {
    expect(formatElapsed(0)).toBe("00:00:00");
  });

  it("formats seconds only", () => {
    expect(formatElapsed(5_000)).toBe("00:00:05");
    expect(formatElapsed(59_000)).toBe("00:00:59");
  });

  it("formats minutes and seconds", () => {
    expect(formatElapsed(60_000)).toBe("00:01:00");
    expect(formatElapsed(90_000)).toBe("00:01:30");
    expect(formatElapsed(3_599_000)).toBe("00:59:59");
  });

  it("formats hours, minutes, and seconds", () => {
    expect(formatElapsed(3_600_000)).toBe("01:00:00");
    expect(formatElapsed(7_261_000)).toBe("02:01:01");
  });

  it("truncates sub-second precision", () => {
    expect(formatElapsed(1_999)).toBe("00:00:01");
  });
});
