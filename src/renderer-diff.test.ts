import { describe, it, expect } from "vitest";
import {
  makeCell,
  textToCells,
  emptyCells,
  rowToString,
  diffFrames,
  emitDiff,
  type Cell,
} from "./renderer-diff.js";

describe("makeCell", () => {
  it("creates a normal-width cell for ASCII", () => {
    const cell = makeCell("a", "normal");
    expect(cell).toEqual({ char: "a", style: "normal", width: 1 });
  });

  it("creates a wide cell for emoji", () => {
    const cell = makeCell("🌕", "normal");
    expect(cell).toEqual({ char: "🌕", style: "normal", width: 2 });
  });

  it("preserves style", () => {
    expect(makeCell("x", "bold").style).toBe("bold");
    expect(makeCell("x", "dim").style).toBe("dim");
  });
});

describe("textToCells", () => {
  it("converts plain text to cells", () => {
    const cells = textToCells("hi", "bold");
    expect(cells).toEqual([
      { char: "h", style: "bold", width: 1 },
      { char: "i", style: "bold", width: 1 },
    ]);
  });

  it("inserts continuation cells for wide characters", () => {
    const cells = textToCells("🌕x", "normal");
    expect(cells).toHaveLength(3);
    expect(cells[0]).toEqual({ char: "🌕", style: "normal", width: 2 });
    expect(cells[1]).toEqual({ char: "", style: "normal", width: 0 });
    expect(cells[2]).toEqual({ char: "x", style: "normal", width: 1 });
  });

  it("handles empty string", () => {
    expect(textToCells("", "normal")).toEqual([]);
  });
});

describe("emptyCells", () => {
  it("creates n space cells", () => {
    const cells = emptyCells(3);
    expect(cells).toHaveLength(3);
    for (const c of cells) {
      expect(c).toEqual({ char: " ", style: "normal", width: 1 });
    }
  });

  it("returns empty array for 0", () => {
    expect(emptyCells(0)).toEqual([]);
  });
});

describe("rowToString", () => {
  it("converts unstyled cells to plain text", () => {
    const cells = textToCells("hello", "normal");
    expect(rowToString(cells)).toBe("hello");
  });

  it("wraps bold cells in ANSI escapes", () => {
    const cells = textToCells("hi", "bold");
    expect(rowToString(cells)).toBe("\x1b[1mhi\x1b[0m");
  });

  it("wraps dim cells in ANSI escapes", () => {
    const cells = textToCells("hi", "dim");
    expect(rowToString(cells)).toBe("\x1b[2mhi\x1b[0m");
  });

  it("handles style transitions", () => {
    const cells: Cell[] = [
      { char: "a", style: "bold", width: 1 },
      { char: "b", style: "normal", width: 1 },
      { char: "c", style: "dim", width: 1 },
    ];
    expect(rowToString(cells)).toBe("\x1b[1ma\x1b[0mb\x1b[2mc\x1b[0m");
  });

  it("skips continuation cells", () => {
    const cells: Cell[] = [
      { char: "🌕", style: "normal", width: 2 },
      { char: "", style: "normal", width: 0 },
      { char: "x", style: "normal", width: 1 },
    ];
    expect(rowToString(cells)).toBe("🌕x");
  });

  it("handles empty row", () => {
    expect(rowToString([])).toBe("");
  });
});

describe("diffFrames", () => {
  it("returns empty for identical frames", () => {
    const frame: Cell[][] = [
      textToCells("hello", "normal"),
      textToCells("world", "normal"),
    ];
    expect(diffFrames(frame, frame)).toEqual([]);
  });

  it("detects character changes", () => {
    const prev: Cell[][] = [textToCells("abc", "normal")];
    const next: Cell[][] = [textToCells("axc", "normal")];
    const changes = diffFrames(prev, next);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      row: 0,
      col: 1,
      cell: { char: "x", style: "normal", width: 1 },
    });
  });

  it("detects style changes", () => {
    const prev: Cell[][] = [textToCells("a", "normal")];
    const next: Cell[][] = [textToCells("a", "bold")];
    const changes = diffFrames(prev, next);
    expect(changes).toHaveLength(1);
    expect(changes[0].cell.style).toBe("bold");
  });

  it("skips continuation cells", () => {
    const prev: Cell[][] = [textToCells("🌕", "normal")];
    const next: Cell[][] = [textToCells("🌑", "normal")];
    const changes = diffFrames(prev, next);
    // Only the primary cell changes, not the continuation
    expect(changes).toHaveLength(1);
    expect(changes[0].col).toBe(0);
    expect(changes[0].cell.char).toBe("🌑");
  });

  it("detects changes across multiple rows", () => {
    const prev: Cell[][] = [
      textToCells("aa", "normal"),
      textToCells("bb", "normal"),
    ];
    const next: Cell[][] = [
      textToCells("ax", "normal"),
      textToCells("by", "normal"),
    ];
    const changes = diffFrames(prev, next);
    expect(changes).toHaveLength(2);
    expect(changes[0].row).toBe(0);
    expect(changes[1].row).toBe(1);
  });
});

describe("emitDiff", () => {
  it("returns empty string for no changes", () => {
    expect(emitDiff([])).toBe("");
  });

  it("emits cursor position and character", () => {
    const result = emitDiff([
      { row: 0, col: 5, cell: { char: "x", style: "normal", width: 1 } },
    ]);
    // Row 1, col 6 (1-indexed), reset for safety, char
    expect(result).toContain("\x1b[1;6H");
    expect(result).toContain("x");
  });

  it("emits style codes for styled cells", () => {
    const result = emitDiff([
      { row: 0, col: 0, cell: { char: "b", style: "bold", width: 1 } },
    ]);
    expect(result).toContain("\x1b[1m");
    expect(result).toContain("b");
  });

  it("skips cursor move for consecutive cells on same row", () => {
    const result = emitDiff([
      { row: 0, col: 0, cell: { char: "a", style: "normal", width: 1 } },
      { row: 0, col: 1, cell: { char: "b", style: "normal", width: 1 } },
    ]);
    // Should have one cursor move for the first cell, then "ab" consecutive
    // eslint-disable-next-line no-control-regex
    const moves = result.match(/\x1b\[\d+;\d+H/g) ?? [];
    expect(moves).toHaveLength(1);
  });

  it("accounts for wide character width in cursor tracking", () => {
    const result = emitDiff([
      { row: 0, col: 0, cell: { char: "🌕", style: "normal", width: 2 } },
      { row: 0, col: 2, cell: { char: "x", style: "normal", width: 1 } },
    ]);
    // After writing 🌕 (width 2) at col 0, cursor is at col 2 — no extra move needed
    // eslint-disable-next-line no-control-regex
    const moves = result.match(/\x1b\[\d+;\d+H/g) ?? [];
    expect(moves).toHaveLength(1);
  });

  it("ends with reset", () => {
    const result = emitDiff([
      { row: 0, col: 0, cell: { char: "x", style: "bold", width: 1 } },
    ]);
    expect(result.endsWith("\x1b[0m")).toBe(true);
  });
});
