import "server-only";
import { randomUUID } from "node:crypto";

/** Request-scoped diagnostics. Never pass request bodies or credentials to log(). */
export class BookingDiagnostics {
  readonly requestId = randomUUID();
  private readonly startedAt = Date.now();
  private stage = "request";
  private writeState: "not_started" | "attempted" | "confirmed" = "not_started";
  private readonly sensitive = new Set<string>();

  constructor() {
    for (const [key, value] of Object.entries(process.env)) {
      if (/TOKEN|SECRET|PASSWORD|KEY|EMAIL/i.test(key) && value) this.protect(value);
    }
  }

  protect(...values: string[]): void {
    for (const value of values) {
      if (value) {
        this.sensitive.add(value);
        this.sensitive.add(encodeURIComponent(value));
        this.sensitive.add(JSON.stringify(value).slice(1, -1));
      }
    }
  }

  private redact(text: string): string {
    let safe = text;
    for (const value of [...this.sensitive].sort((a, b) => b.length - a.length)) {
      safe = safe.split(value).join("[REDACTED]");
    }
    return safe
      .replace(/https?:\/\/[^\s"'<>]+/gi, "[URL REDACTED]")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL REDACTED]")
      .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
      // JSON parse/provider errors may quote guest records from other reservations.
      .replace(/"[^"\n]*"|'[^'\n]*'/g, "[QUOTED VALUE REDACTED]")
      .slice(0, 8000);
  }

  private errorDetails(error: unknown, depth = 0): unknown {
    if (depth > 3) return "[cause depth limit]";
    if (typeof error !== "object" || error === null) {
      return { message: this.redact(String(error)) };
    }
    const source = error as Record<string, unknown>;
    const details: Record<string, unknown> = {};
    for (const key of ["name", "message", "stack", "code", "status", "statusCode"]) {
      const value = source[key];
      if (typeof value === "string") details[key] = this.redact(value);
      else if (typeof value === "number") details[key] = value;
    }
    if (source.cause !== undefined) details.cause = this.errorDetails(source.cause, depth + 1);
    return details;
  }

  step(stage: string): void {
    this.stage = stage;
    this.log("info", "stage_started");
  }

  writeAttempted(): void {
    this.writeState = "attempted";
    this.step("blob_write");
  }

  writeConfirmed(): void {
    this.writeState = "confirmed";
    this.log("info", "blob_write_confirmed");
  }

  log(level: "info" | "warn" | "error", event: string, error?: unknown, status?: number): void {
    const entry = {
      event: `booking.${event}`,
      requestId: this.requestId,
      stage: this.stage,
      writeState: this.writeState,
      elapsedMs: Date.now() - this.startedAt,
      status,
      error: error === undefined ? undefined : this.errorDetails(error),
    };
    console[level](JSON.stringify(entry));
  }
}
