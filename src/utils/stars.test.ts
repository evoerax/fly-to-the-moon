import { describe, it, expect } from "vitest";
import { generateStarField, getStarState } from "./stars.js";

describe("generateStarField", () => {
  it("returns an empty array for zero density", () => {
    const stars = generateStarField(80, 10, 0, 42);
    expect(stars).toEqual([]);
  });

  it("generates stars within bounds", () => {
    const width = 40;
    const height = 5;
    const stars = generateStarField(width, height, 0.1, 42);
    expect(stars.length).toBeGreaterThan(0);
    for (const star of stars) {
      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.x).toBeLessThan(width);
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThan(height);
    }
  });

  it("assigns valid star characters", () => {
    const validChars = ["·", "✧", "⋆", "°"];
    const stars = generateStarField(80, 10, 0.05, 42);
    for (const star of stars) {
      expect(validChars).toContain(star.char);
    }
  });

  it("assigns phase in [0, 2π) and period in [10000, 25000)", () => {
    const stars = generateStarField(80, 10, 0.05, 42);
    for (const star of stars) {
      expect(star.phase).toBeGreaterThanOrEqual(0);
      expect(star.phase).toBeLessThan(Math.PI * 2);
      expect(star.period).toBeGreaterThanOrEqual(10_000);
      expect(star.period).toBeLessThan(25_000);
    }
  });

  it("is deterministic for the same seed", () => {
    const a = generateStarField(40, 5, 0.05, 99);
    const b = generateStarField(40, 5, 0.05, 99);
    expect(a).toEqual(b);
  });

  it("produces different fields for different seeds", () => {
    const a = generateStarField(40, 5, 0.05, 1);
    const b = generateStarField(40, 5, 0.05, 2);
    expect(a).not.toEqual(b);
  });
});

describe("getStarState", () => {
  const bright = {
    x: 0,
    y: 0,
    char: "·",
    phase: 0,
    period: 10_000,
    rest: "bright" as const,
  };

  it("returns rest state for most of the cycle", () => {
    expect(getStarState(bright, 5000)).toBe("bright");
    const dimStar = { ...bright, rest: "dim" as const };
    expect(getStarState(dimStar, 5000)).toBe("dim");
    const hiddenStar = { ...bright, rest: "hidden" as const };
    expect(getStarState(hiddenStar, 5000)).toBe("hidden");
  });

  it("bright star blinks to hidden during blink window", () => {
    // t = 250/10000 = 0.025, in hidden band (0.0175..0.0325)
    expect(getStarState(bright, 250)).toBe("hidden");
  });

  it("hidden star blinks to bright during blink window", () => {
    const hidden = { ...bright, rest: "hidden" as const };
    // t = 0.025, in bright band (0.0175..0.0325)
    expect(getStarState(hidden, 250)).toBe("bright");
  });

  it("dim star blinks to bright during blink window", () => {
    const dimStar = { ...bright, rest: "dim" as const };
    // t = 350/10000 = 0.035, in bright band (0.025..0.05)
    expect(getStarState(dimStar, 350)).toBe("bright");
  });

  it("respects the phase offset", () => {
    const shifted = { ...bright, phase: Math.PI };
    expect(getStarState(shifted, 5000)).toBe("dim");
  });
});
