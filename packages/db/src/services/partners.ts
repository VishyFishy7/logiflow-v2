/**
 * Partners (clients/carriers) — pure business rules, no SQL.
 * Additional validation beyond the zod schemas in contracts/src/inputs.ts.
 */
import { ApiError } from "../errors.js";

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PINCODE_REGEX = /^\d{6}$/;
const MAX_CREDIT_TERMS = 365;
const MIN_CREDIT_TERMS = 0;

/**
 * Validate GSTIN format (PRD §6.1). The regex enforces the 15-character
 * structure; this function additionally checks the state code range.
 */
export function validateGstin(gstin: string | null | undefined): void {
  if (!gstin) return;
  if (!GSTIN_REGEX.test(gstin)) {
    throw new ApiError("VALIDATION_FAILED", "Invalid GSTIN format", {
      fieldErrors: {
        gstin:
          "GSTIN must be 15 characters: 2 digits, 5 letters, 4 digits, 1 letter, 1 alphanum, Z, 1 alphanum",
      },
    });
  }
  // State code: first 2 digits must be 01–37 or 97 (for foreign), per GST rules
  const stateCode = parseInt(gstin.substring(0, 2), 10);
  if ((stateCode < 1 || stateCode > 37) && stateCode !== 97) {
    throw new ApiError("VALIDATION_FAILED", "Invalid GSTIN state code", {
      fieldErrors: { gstin: "GSTIN state code must be between 01 and 37 (or 97 for foreign)" },
    });
  }
}

/** Validate Indian pincode (exactly 6 digits). */
export function validatePincode(pincode: string | null | undefined): void {
  if (!pincode) return;
  if (!PINCODE_REGEX.test(pincode)) {
    throw new ApiError("VALIDATION_FAILED", "Invalid pincode format", {
      fieldErrors: { pincode: "Pincode must be exactly 6 digits" },
    });
  }
}

/** Validate credit terms bounds. */
export function validateCreditTerms(days: number | null | undefined): void {
  if (days === null || days === undefined) return;
  if (!Number.isInteger(days) || days < MIN_CREDIT_TERMS || days > MAX_CREDIT_TERMS) {
    throw new ApiError("VALIDATION_FAILED", "Credit terms must be between 0 and 365 days", {
      fieldErrors: { creditTermsDays: `Must be between ${MIN_CREDIT_TERMS} and ${MAX_CREDIT_TERMS}` },
    });
  }
}

/** Run all client field validations beyond zod. */
export function validateClientFields(input: {
  gstin?: string | null;
  pincode?: string | null;
  creditTermsDays?: number | null;
}): void {
  validateGstin(input.gstin);
  validatePincode(input.pincode);
  validateCreditTerms(input.creditTermsDays);
}

/** Run carrier field validations beyond zod. */
export function validateCarrierFields(input: {
  code?: string;
  name?: string;
}): void {
  if (input.code !== undefined && input.code.length > 20) {
    throw new ApiError("VALIDATION_FAILED", "Carrier code must be 20 characters or less", {
      fieldErrors: { code: "Maximum 20 characters" },
    });
  }
}
