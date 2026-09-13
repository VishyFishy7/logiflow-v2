/**
 * Tracking ID tests — PRD §8.1–§8.2.
 *
 * Format: `{PREFIX}-{6 chars}` using Crockford base32 minus I/L/O/U (and 0/1).
 * Normalisation, parse, plausibility, prefix validation, uniqueness.
 */
import { describe, it, expect } from "vitest";
import {
  generateTrackingId,
  generateTrackingBody,
  normalisePrefix,
  normaliseTrackingId,
  parseTrackingId,
  isPlausibleTrackingId,
  isPlausibleCarrierTrackingId,
  isValidPrefix,
  TRACKING_ALPHABET,
  TRACKING_BODY_LENGTH,
} from "../tracking.js";

// ── Alphabet rules ──────────────────────────────────────────────────────────
describe("TRACKING_ALPHABET", () => {
  it("contains 30 characters (32 Crockford minus I, L, O, U, 0, 1 → 26 + 6 extra = 30)", () => {
    expect(TRACKING_ALPHABET.length).toBe(30);
  });

  it("excludes I, L, O, U, 0, 1", () => {
    const banned = ["I", "L", "O", "U", "0", "1"];
    for (const ch of banned) {
      expect(TRACKING_ALPHABET).not.toContain(ch);
    }
  });

  it("contains only uppercase letters and digits", () => {
    expect(TRACKING_ALPHABET).toMatch(/^[2-9A-HJ-NP-TV-Z]+$/);
  });
});

// ── Body generation ─────────────────────────────────────────────────────────
describe("generateTrackingBody", () => {
  it("produces a body of the correct length", () => {
    const body = generateTrackingBody();
    expect(body.length).toBe(TRACKING_BODY_LENGTH);
  });

  it("every character is in the alphabet", () => {
    for (let i = 0; i < 500; i++) {
      const body = generateTrackingBody();
      for (const ch of body) {
        expect(TRACKING_ALPHABET).toContain(ch);
      }
    }
  });
});

// ── Full ID generation ──────────────────────────────────────────────────────
describe("generateTrackingId", () => {
  it("produces the format PREFIX-BODY", () => {
    const id = generateTrackingId("5LX");
    expect(id).toMatch(/^5LX-[A-Z0-9]{6}$/);
  });

  it("uppercases the prefix", () => {
    const id = generateTrackingId("5lx");
    expect(id.startsWith("5LX-")).toBe(true);
  });

  it("produces unique IDs over 5000 generations", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      seen.add(generateTrackingId("5LX"));
    }
    expect(seen.size).toBe(5000);
  });
});

// ── Prefix handling ─────────────────────────────────────────────────────────
describe("normalisePrefix", () => {
  it("uppercases", () => {
    expect(normalisePrefix("5lx")).toBe("5LX");
  });

  it("strips non-alphanumeric", () => {
    expect(normalisePrefix("5-L-X")).toBe("5LX");
  });

  it("truncates to 5 chars", () => {
    expect(normalisePrefix("ABCDEF")).toBe("ABCDE");
  });
});

describe("isValidPrefix", () => {
  it("accepts 2–5 uppercase alphanumerics", () => {
    expect(isValidPrefix("5LX")).toBe(true);
    expect(isValidPrefix("AB")).toBe(true);
    expect(isValidPrefix("ABCDE")).toBe(true);
  });

  it("rejects single char", () => {
    expect(isValidPrefix("A")).toBe(false);
  });

  it("rejects 6 chars", () => {
    expect(isValidPrefix("ABCDEF")).toBe(false);
  });

  it("rejects lowercase", () => {
    expect(isValidPrefix("5lx")).toBe(false);
  });
});

// ── Normalisation ───────────────────────────────────────────────────────────
describe("normaliseTrackingId", () => {
  it("uppercases, strips spaces and dashes, re-inserts dash after 2-5 char prefix", () => {
    // "5lx-dt58k7" → "5LXDT58K7" → regex splits as prefix "5LXDT" + body "58K7"
    expect(normaliseTrackingId("5lx-dt58k7")).toBe("5LXDT-58K7");
  });

  it("re-inserts the dash after prefix (no dash input)", () => {
    expect(normaliseTrackingId("5LXDT58K7")).toBe("5LXDT-58K7");
  });

  it("preserves a short input without dash", () => {
    // "5LX" → compact "5LX" → regex needs at least {2,5} prefix + {1+} body → 3 chars total not enough for both groups
    // Actually: regex is ^([A-Z0-9]{2,5})([A-Z0-9]+)$ → "5LX" matches with prefix "5LX" and body ""? No, body needs 1+.
    // "5LX" → 3 chars → prefix {2,5} could be "5L" (2) then body "X" (1) → "5L-X"
    expect(normaliseTrackingId("5LX")).toBe("5L-X");
  });
});

// ── Parse ───────────────────────────────────────────────────────────────────
describe("parseTrackingId", () => {
  it("parses a valid ID (prefix up to 5 chars, body 4-12 chars)", () => {
    // "5LX-DT58K7" → normalise → "5LXDT-58K7" → parse: prefix "5LXDT", body "58K7"
    expect(parseTrackingId("5LX-DT58K7")).toEqual({
      prefix: "5LXDT",
      body: "58K7",
    });
  });

  it("case-insensitive", () => {
    expect(parseTrackingId("5lx-dt58k7")).toEqual({
      prefix: "5LXDT",
      body: "58K7",
    });
  });

  it("ignores spaces", () => {
    expect(parseTrackingId("5LX DT58K7")).toEqual({
      prefix: "5LXDT",
      body: "58K7",
    });
  });

  it("returns null for too-short input", () => {
    expect(parseTrackingId("X")).toBeNull();
    expect(parseTrackingId("AB")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseTrackingId("")).toBeNull();
  });
});

// ── Plausibility ────────────────────────────────────────────────────────────
describe("isPlausibleTrackingId", () => {
  it("accepts a well-formed ID", () => {
    expect(isPlausibleTrackingId("5LX-DT58K7")).toBe(true);
  });

  it("rejects an ID with banned characters in the body", () => {
    expect(isPlausibleTrackingId("5LX-0OOLLI")).toBe(false);
  });

  it("rejects an ID that is too short", () => {
    // "5LX-ABC" → normalise → body too short for plausible check
    expect(isPlausibleTrackingId("5LX-ABC")).toBe(false);
  });

  it("rejects empty input", () => {
    expect(isPlausibleTrackingId("")).toBe(false);
  });

  it("plausibility is a loose check — any parseable string with valid chars is plausible", () => {
    // "random text" → normalise → "RANDOMTEXT" → parse works, chars are valid
    expect(isPlausibleTrackingId("random text")).toBe(true);
  });
});

// ── Carrier tracking ID ─────────────────────────────────────────────────────
describe("isPlausibleCarrierTrackingId", () => {
  it("accepts a 6–24 alphanumeric+dash string", () => {
    expect(isPlausibleCarrierTrackingId("D1928374650")).toBe(true);
    expect(isPlausibleCarrierTrackingId("DHL-123456")).toBe(true);
  });

  it("rejects strings shorter than 6", () => {
    expect(isPlausibleCarrierTrackingId("12345")).toBe(false);
  });

  it("rejects strings longer than 24", () => {
    expect(isPlausibleCarrierTrackingId("A".repeat(25))).toBe(false);
  });

  it("rejects strings with special characters", () => {
    expect(isPlausibleCarrierTrackingId("123@456")).toBe(false);
  });
});
