import { describe, it, expect } from "vitest";
import { MOON_PHASES, getMoonPhase } from "./moon.js";

describe("MOON_PHASES", () => {
  it("has 8 phases", () => {
    expect(MOON_PHASES).toHaveLength(8);
  });

  it("starts with new moon and includes full moon", () => {
    expect(MOON_PHASES[0]).toBe("🌑");
    expect(MOON_PHASES[4]).toBe("🌕");
  });
});

describe("getMoonPhase", () => {
  it("returns full moon for success", () => {
    expect(getMoonPhase("success")).toBe("🌕");
  });

  it("returns new moon for fail", () => {
    expect(getMoonPhase("fail")).toBe("🌑");
  });

  it("cycles through phases for in-progress based on timestamp", () => {
    const periodMs = 4000;
    const results = new Set<string>();
    // Sample at 8 evenly spaced points across one cycle
    for (let i = 0; i < 8; i++) {
      const now = (i / 8) * periodMs;
      results.add(getMoonPhase("active", now, periodMs));
    }
    // Should hit multiple distinct phases
    expect(results.size).toBeGreaterThanOrEqual(4);
  });

  it("all active phases are valid moon emojis", () => {
    const periodMs = 4000;
    for (let i = 0; i < 8; i++) {
      const now = (i / 8) * periodMs;
      const phase = getMoonPhase("active", now, periodMs);
      expect(MOON_PHASES).toContain(phase);
    }
  });
});
