export const MOON_PHASES = [
  "🌑",
  "🌒",
  "🌓",
  "🌔",
  "🌕",
  "🌖",
  "🌗",
  "🌘",
] as const;

export type MoonState = "success" | "fail" | "active";

export function getMoonPhase(
  state: MoonState,
  now = 0,
  periodMs = 4000,
): string {
  if (state === "success") return "🌕";
  if (state === "fail") return "🌑";
  const idx = Math.floor(((now % periodMs) / periodMs) * 8) % 8;
  return MOON_PHASES[idx];
}
