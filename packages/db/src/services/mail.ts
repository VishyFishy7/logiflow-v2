/**
 * Local mail transport — writes RFC-822-ish .eml files into data/mail/.
 *
 * PRD §9.6: the email channel dispatches through this transport. In
 * development the files land on disk so tests can assert on them;
 * in production a real SMTP adapter would be swapped in here.
 *
 * sendMail() never throws into the caller's transaction: errors are
 * caught and returned as a structured result, so a failed email does
 * not roll back the notification row that triggered it.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ── Types ───────────────────────────────────────────────────────────────────

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface MailResult {
  ok: boolean;
  /** Absolute path to the .eml file written, or undefined on failure. */
  filePath?: string;
  /** Error message when ok=false. */
  error?: string;
}

// ── Transport ───────────────────────────────────────────────────────────────

const here = dirname(fileURLToPath(import.meta.url));
/** data/mail/ relative to the repo root (packages/db → ../../data/mail). */
const MAIL_DIR = resolve(here, "../../../data/mail");

/**
 * Deterministic filename so two sends with the same content produce the
 * same path (overwrites silently — fine for a dev transport).
 */
function mailFilename(msg: MailMessage, now = Date.now()): string {
  const hash = createHash("sha256")
    .update(`${msg.to}\n${msg.subject}\n${msg.text}\n${msg.html ?? ""}`)
    .digest("hex")
    .slice(0, 12);
  const ts = new Date(now).toISOString().replace(/[:.]/g, "-");
  return `${ts}_${hash}.eml`;
}

/**
 * Build a minimal RFC-822 message body. Not a full parser, but
 * readable and close enough for local inspection.
 */
function buildEml(msg: MailMessage, now = Date.now()): string {
  const date = new Date(now).toUTCString();
  const lines = [
    `From: LogiFlow <noreply@logiflow.local>`,
    `To: ${msg.to}`,
    `Date: ${date}`,
    `Subject: ${msg.subject}`,
    `MIME-Version: 1.0`,
  ];

  if (msg.html) {
    const boundary = "----=_LogiFlowBoundary_" + createHash("md5").update(msg.subject).digest("hex").slice(0, 8);
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: text/plain; charset=utf-8`);
    lines.push("");
    lines.push(msg.text);
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: text/html; charset=utf-8`);
    lines.push("");
    lines.push(msg.html);
    lines.push("");
    lines.push(`--${boundary}--`);
  } else {
    lines.push(`Content-Type: text/plain; charset=utf-8`);
    lines.push("");
    lines.push(msg.text);
  }

  lines.push("");
  return lines.join("\r\n");
}

/**
 * Send a mail message by writing it to data/mail/ as an .eml file.
 *
 * Never throws — callers inside a transaction are safe.
 */
export function sendMail(msg: MailMessage, now = Date.now()): MailResult {
  try {
    mkdirSync(MAIL_DIR, { recursive: true });
    const filename = mailFilename(msg, now);
    const filePath = resolve(MAIL_DIR, filename);
    const eml = buildEml(msg, now);
    writeFileSync(filePath, eml, "utf8");
    return { ok: true, filePath };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
