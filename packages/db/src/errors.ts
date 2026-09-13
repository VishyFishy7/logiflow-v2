import { ERROR_STATUS, type ApiErrorCode } from "@logiflow/contracts";

/**
 * One error class for the whole server. Repositories throw it, route handlers
 * catch it, and the status code comes from the single `ERROR_STATUS` table so a
 * `SHIPMENT_NOT_FOUND` can never be answered with a 500 (PRD §4.5).
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly fieldErrors?: Record<string, string>;
  readonly detail?: Record<string, unknown>;

  constructor(
    code: ApiErrorCode,
    message: string,
    options: { fieldErrors?: Record<string, string>; detail?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.fieldErrors = options.fieldErrors;
    this.detail = options.detail;
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }

  toBody(requestId?: string) {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fieldErrors ? { fieldErrors: this.fieldErrors } : {}),
        ...(requestId ? { requestId } : {}),
      },
    };
  }
}

export const notFound = (code: ApiErrorCode, message: string) => new ApiError(code, message);
export const validationFailed = (message: string, fieldErrors?: Record<string, string>) =>
  new ApiError("VALIDATION_FAILED", message, { fieldErrors });
