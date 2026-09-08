/**
 * Server operational log. Structured, allowlisted, never throws into callers.
 *
 * Not a tracing platform. No files, no database, no third-party sink.
 */

export type OperationalLogLevel = "info" | "warn" | "error";

export type OperationalLogFields = Readonly<Record<string, unknown>>;

const ALLOWED_FIELDS = new Set([
  "stage",
  "error_code",
  "operation",
  "status_from",
  "status_to",
  "actor_type",
  "delivery_type",
  "storage_bucket",
  "provider",
  "reason_code",
]);

const BLOCKED_KEY_FRAGMENTS = [
  "password",
  "token",
  "authorization",
  "cookie",
  "secret",
  "servicerole",
  "email",
  "phone",
  "telephone",
  "address",
  "name",
] as const;

const EVENT_PATTERN = /^[a-z][a-z0-9_.]{1,80}$/;
const VALUE_PATTERN = /^[A-Za-z0-9_.:-]{1,64}$/;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isBlockedKey(key: string): boolean {
  const normalized = normalizeKey(key);
  if (!normalized) {
    return true;
  }
  return BLOCKED_KEY_FRAGMENTS.some((fragment) =>
    normalized.includes(fragment),
  );
}

function isSafeValue(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (!VALUE_PATTERN.test(trimmed)) {
    return false;
  }
  if (trimmed.includes("@")) {
    return false;
  }
  return true;
}

export function sanitizeOperationalFields(
  fields: OperationalLogFields | undefined,
): Record<string, string> {
  if (!fields || typeof fields !== "object") {
    return {};
  }
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!ALLOWED_FIELDS.has(key) || isBlockedKey(key)) {
      continue;
    }
    if (!isSafeValue(value)) {
      continue;
    }
    safe[key] = value.trim();
  }
  return safe;
}

function emit(
  level: OperationalLogLevel,
  event: string,
  fields?: OperationalLogFields,
): void {
  try {
    if (!EVENT_PATTERN.test(event)) {
      return;
    }
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      ...sanitizeOperationalFields(fields),
    };
    const line = JSON.stringify(entry);
    if (level === "error") {
      console.error(line);
      return;
    }
    if (level === "warn") {
      console.warn(line);
      return;
    }
    console.info(line);
  } catch {
    // Logging must never break place/cancel/transition/OAuth.
  }
}

export const operationalLog = {
  info(event: string, fields?: OperationalLogFields): void {
    emit("info", event, fields);
  },
  warn(event: string, fields?: OperationalLogFields): void {
    emit("warn", event, fields);
  },
  error(event: string, fields?: OperationalLogFields): void {
    emit("error", event, fields);
  },
};
