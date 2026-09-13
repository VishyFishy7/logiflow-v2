/**
 * MSW browser service worker setup (PRD §17.2).
 * Used by `apps/web/lib/mock-worker.ts` to activate the mock layer.
 */
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
