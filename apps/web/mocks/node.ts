/**
 * MSW Node.js server setup for vitest (PRD §17.2).
 */
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
