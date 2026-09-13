/**
 * Masking tests — PRD §8.3.
 *
 * Every mask policy (last2 / first2_last2 / full / none), short-string
 * edge cases, asMaskedValue never emitting raw, REDACTED_LOG_PATHS.
 */
import { describe, it, expect } from "vitest";
import {
  maskSecret,
  maskTrackingId,
  maskCarrierTrackingId,
  asMaskedValue,
  INTERNAL_ID_POLICY,
  CARRIER_ID_POLICY,
  MASK_BULLET,
  REDACTED_LOG_PATHS,
  type MaskPolicy,
} from "../mask.js";

// ── Policy: last2 (default for internal IDs) ────────────────────────────────
describe("maskSecret — last2", () => {
  it("shows prefix + bullets + last 2 chars", () => {
    const masked = maskSecret("5LX-DT58K7", "last2");
    expect(masked).toBe("5LX-••••K7");
  });

  it("carrier ID without prefix gets only body masked", () => {
    // "D1928374650" → body "D1928374650" (11 chars) → last2 → •••••••••50 (9 bullets + 50)
    expect(maskSecret("D1928374650", "last2")).toBe("•••••••••50");
  });

  it("short body (2 chars) gets at least 2 bullets", () => {
    const masked = maskSecret("AB", "last2");
    expect(masked).toBe("••AB");
  });

  it("empty body produces 8 bullets (without prefix)", () => {
    // "5LX-" → prefix "5LX-", body "" → returns just 8 bullets
    const masked = maskSecret("5LX-", "last2");
    expect(masked).toBe("••••••••");
  });
});

// ── Policy: first2_last2 ────────────────────────────────────────────────────
describe("maskSecret — first2_last2", () => {
  it("shows prefix + first 2 + bullets + last 2", () => {
    // body "DT58K7" (6 chars) → head "DT", tail "K7", hidden = max(2, 6-4) = 2
    expect(maskSecret("5LX-DT58K7", "first2_last2")).toBe("5LX-DT••K7");
  });

  it("short body (<=4 chars) → all bullets", () => {
    expect(maskSecret("ABCD", "first2_last2")).toBe("••••");
  });

  it("exactly 4 chars: all bullets", () => {
    expect(maskSecret("1234", "first2_last2")).toBe("••••");
  });

  it("exactly 5 chars: 2 visible + 2 bullets + 1 tail = full masking", () => {
    // body "12345" (5 chars) → head "12", tail "45", hidden = max(2, 5-4) = 2
    expect(maskSecret("12345", "first2_last2")).toBe("12••45");
  });
});

// ── Policy: full ────────────────────────────────────────────────────────────
describe("maskSecret — full", () => {
  it("returns exactly value.length bullets (or 8 minimum)", () => {
    // "5LX-DT58K7" is 10 chars → 10 bullets
    expect(maskSecret("5LX-DT58K7", "full")).toBe("••••••••••");
  });

  it("short value → 8 bullets minimum", () => {
    expect(maskSecret("hi", "full")).toBe("••••••••");
  });
});

// ── Policy: none ────────────────────────────────────────────────────────────
describe("maskSecret — none", () => {
  it("returns the raw value", () => {
    expect(maskSecret("5LX-DT58K7", "none")).toBe("5LX-DT58K7");
  });
});

// ── Convenience wrappers ────────────────────────────────────────────────────
describe("maskTrackingId / maskCarrierTrackingId", () => {
  it("maskTrackingId defaults to last2", () => {
    expect(maskTrackingId("5LX-DT58K7")).toBe(maskSecret("5LX-DT58K7", INTERNAL_ID_POLICY));
  });

  it("maskCarrierTrackingId defaults to first2_last2", () => {
    expect(maskCarrierTrackingId("D1928374650")).toBe(
      maskSecret("D1928374650", CARRIER_ID_POLICY),
    );
  });
});

// ── asMaskedValue ───────────────────────────────────────────────────────────
describe("asMaskedValue", () => {
  it("returns masked form for a real value", () => {
    const mv = asMaskedValue("5LX-DT58K7", "last2");
    expect(mv.value).toBe("5LX-••••K7");
    expect(mv.masked).toBe(true);
    expect(mv.policy).toBe("last2");
    // CRITICAL: raw is never present when policy !== "none"
    expect(mv.raw).toBeUndefined();
  });

  it("returns '—' for null/undefined/empty", () => {
    expect(asMaskedValue(null, "last2").value).toBe("—");
    expect(asMaskedValue(undefined, "full").value).toBe("—");
    expect(asMaskedValue("", "none").value).toBe("—");
  });

  it("policy 'none' → masked=false", () => {
    const mv = asMaskedValue("5LX-DT58K7", "none");
    expect(mv.masked).toBe(false);
    expect(mv.value).toBe("5LX-DT58K7");
    // Even with policy none, raw is NOT set (server only sets it after reveal)
    expect(mv.raw).toBeUndefined();
  });
});

// ── REDACTED_LOG_PATHS ──────────────────────────────────────────────────────
describe("REDACTED_LOG_PATHS", () => {
  it("covers tracking_id variants", () => {
    expect(REDACTED_LOG_PATHS).toContain("tracking_id");
    expect(REDACTED_LOG_PATHS).toContain("trackingId");
  });

  it("covers carrier_tracking_id variants", () => {
    expect(REDACTED_LOG_PATHS).toContain("carrier_tracking_id");
    expect(REDACTED_LOG_PATHS).toContain("carrierTrackingId");
  });

  it("covers password/password_hash/passwordHash", () => {
    expect(REDACTED_LOG_PATHS).toContain("password");
    expect(REDACTED_LOG_PATHS).toContain("password_hash");
    expect(REDACTED_LOG_PATHS).toContain("passwordHash");
  });

  it("covers authorization and cookie", () => {
    expect(REDACTED_LOG_PATHS).toContain("authorization");
    expect(REDACTED_LOG_PATHS).toContain("cookie");
  });

  it("covers req.headers.authorization and req.headers.cookie", () => {
    expect(REDACTED_LOG_PATHS).toContain("req.headers.authorization");
    expect(REDACTED_LOG_PATHS).toContain("req.headers.cookie");
  });
});
