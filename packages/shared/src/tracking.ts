/**
 * Internal tracking IDs — ours. See PRD §8.
 *
 * Format: `{TENANT_PREFIX}-{6 chars}` e.g. `5LX-DT58K7`.
 * Alphabet is Crockford base32 with every look-alike removed: no I, L, O, U
 * (Crockford's own exclusions) and additionally no 0 or 1, so a human reading
 * an ID off a phone screen can never confuse a digit with a letter.
 */

export const TRACKING_BODY_LENGTH = 6;
export const TRACKING_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

const ALPHABET_SET = new Set(TRACKING_ALPHABET.split(""));

/** Random index generator; uses the platform CSPRNG when one exists. */
function randomIndex(bound: number): number {
  const globalCrypto = globalThis.crypto;
  if (globalCrypto && typeof globalCrypto.getRandomValues === "function") {
    // Rejection sampling keeps the distribution flat.
    const limit = Math.floor(256 / bound) * bound;
    const buf = new Uint8Array(1);
    for (;;) {
      globalCrypto.getRandomValues(buf);
      const byte = buf[0] as number;
      if (byte < limit) return byte % bound;
    }
  }
  return Math.floor(Math.random() * bound);
}

export function generateTrackingBody(length = TRACKING_BODY_LENGTH): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += TRACKING_ALPHABET[randomIndex(TRACKING_ALPHABET.length)] as string;
  }
  return out;
}

/** `generateTrackingId("5lx")` → `"5LX-DT58K7"`. */
export function generateTrackingId(prefix: string): string {
  return `${normalisePrefix(prefix)}-${generateTrackingBody()}`;
}

/** 2–5 uppercase alphanumerics, per the tenant schema constraint. */
export function normalisePrefix(prefix: string): string {
  return prefix.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 5);
}

export function isValidPrefix(prefix: string): boolean {
  return /^[A-Z0-9]{2,5}$/.test(prefix);
}

/** Case-insensitive, ignores spaces and dashes a human may have typed. */
export function normaliseTrackingId(input: string): string {
  const cleaned = input.trim().toUpperCase().replace(/[\s_]/g, "");
  const compact = cleaned.replace(/-/g, "");
  if (compact.length < 3) return cleaned;
  const match = /^([A-Z0-9]{2,5})([A-Z0-9]+)$/.exec(compact);
  if (!match) return cleaned;
  return `${match[1]}-${match[2]}`;
}

export function parseTrackingId(id: string): { prefix: string; body: string } | null {
  const normalised = normaliseTrackingId(id);
  const match = /^([A-Z0-9]{2,5})-([A-Z0-9]{4,12})$/.exec(normalised);
  if (!match) return null;
  return { prefix: match[1] as string, body: match[2] as string };
}

/**
 * Cheap plausibility check used before hitting the public endpoint, so an
 * obviously wrong string never consumes a rate-limit token (§14.12).
 */
export function isPlausibleTrackingId(id: string): boolean {
  const parsed = parseTrackingId(id);
  if (!parsed) return false;
  if (parsed.body.length < 4 || parsed.body.length > 12) return false;
  return parsed.body.split("").every((char) => ALPHABET_SET.has(char));
}

/** A carrier's own docket/AWB number: free text, 6–24 chars, carrier-defined. */
export function isPlausibleCarrierTrackingId(id: string): boolean {
  const trimmed = id.trim();
  return /^[A-Za-z0-9-]{6,24}$/.test(trimmed);
}

export function normaliseCarrierTrackingId(id: string): string {
  return id.trim().toUpperCase().replace(/\s/g, "");
}
