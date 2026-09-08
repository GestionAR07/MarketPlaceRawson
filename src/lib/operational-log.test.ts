import { afterEach, describe, expect, it, vi } from "vitest";
import { operationalLog, sanitizeOperationalFields } from "./operational-log";

function parseLogged(spy: { mock: { calls: unknown[][] } }): {
  timestamp: string;
  level: string;
  event: string;
  [key: string]: unknown;
} {
  const line = String(spy.mock.calls[0]?.[0]);
  return JSON.parse(line) as {
    timestamp: string;
    level: string;
    event: string;
  };
}

describe("operationalLog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits a structured info event", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    operationalLog.info("order.place_ok", { stage: "persist" });
    const entry = parseLogged(spy);
    expect(entry.level).toBe("info");
    expect(entry.event).toBe("order.place_ok");
    expect(entry.stage).toBe("persist");
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("emits warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    operationalLog.warn("order.cancel_failed", {
      error_code: "ORDER_NOT_CANCELABLE",
    });
    expect(parseLogged(spy).level).toBe("warn");
  });

  it("emits error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    operationalLog.error("order.place_failed", {
      stage: "persist",
      error_code: "INSUFFICIENT_STOCK",
    });
    const entry = parseLogged(spy);
    expect(entry.level).toBe("error");
    expect(entry.event).toBe("order.place_failed");
    expect(entry.error_code).toBe("INSUFFICIENT_STOCK");
  });

  it("drops email, phone, password, token, cookie and authorization fields", () => {
    expect(
      sanitizeOperationalFields({
        stage: "persist",
        email: "not-a-real-user@example.invalid",
        phone: "2804000000",
        password: "not-a-real-password",
        access_token: "not-a-real-access-token",
        refreshToken: "not-a-real-refresh-token",
        authorization: "Bearer not-a-real-token",
        cookie: "not-a-real-cookie",
        error_code: "UNEXPECTED_ERROR",
      }),
    ).toEqual({
      stage: "persist",
      error_code: "UNEXPECTED_ERROR",
    });
  });

  it("does not serialize a raw Error message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    operationalLog.error("order.place_failed", {
      stage: "persist",
      error_code: "UNEXPECTED_ERROR",
      message: "database password leaked in this sentence",
    });
    const line = String(spy.mock.calls[0]?.[0]);
    expect(line).not.toContain("leaked");
    expect(line).not.toContain("password");
    expect(parseLogged(spy).error_code).toBe("UNEXPECTED_ERROR");
  });

  it("keeps allowed stage and error_code", () => {
    expect(
      sanitizeOperationalFields({
        stage: "oauth_admin_lookup",
        error_code: "oauth_admin_lookup",
        status_from: "PENDING",
        status_to: "ACCEPTED",
        actor_type: "CUSTOMER",
        reason_code: "CUSTOMER_REQUEST",
      }),
    ).toEqual({
      stage: "oauth_admin_lookup",
      error_code: "oauth_admin_lookup",
      status_from: "PENDING",
      status_to: "ACCEPTED",
      actor_type: "CUSTOMER",
      reason_code: "CUSTOMER_REQUEST",
    });
  });

  it("does not throw on unexpected values", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      operationalLog.error("order.place_failed", {
        stage: { nested: true } as unknown as string,
        error_code: "fine",
        extra: "ignored",
      }),
    ).not.toThrow();
    expect(() => operationalLog.error("Not An Event")).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(parseLogged(spy).error_code).toBe("fine");
    expect(String(spy.mock.calls[0]?.[0])).not.toContain("nested");
  });
});
