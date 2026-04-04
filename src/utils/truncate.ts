export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, Math.max(0, maxLen - 1)).trimEnd() + "…";
}
