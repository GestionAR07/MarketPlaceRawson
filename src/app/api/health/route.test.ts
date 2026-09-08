import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns 200 JSON liveness without infrastructure", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("stays a public process check with no secrets or dependencies", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/health/route.ts"),
      "utf8",
    );
    expect(source).toContain("export function GET");
    expect(source).toContain('export const dynamic = "force-dynamic"');
    expect(source).not.toContain("process.env");
    expect(source).not.toContain("operationalLog");
    expect(source).not.toContain("supabase");
    expect(source).not.toContain("DATABASE");
    expect(source).not.toContain("getDb");
    expect(source).not.toContain("auth");
    expect(source).not.toMatch(/[a-z0-9]{20}\.supabase\.co/i);
  });
});
