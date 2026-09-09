import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("trigger function execute grants", () => {
  it("keeps trigger-only SECURITY DEFINER functions unavailable as client RPCs", () => {
    const migration = read("drizzle/0009_harden_trigger_function_execute.sql");

    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.broadcast_merchant_order_inserted() FROM PUBLIC, anon, authenticated;",
    );
    expect(migration).not.toContain("FROM service_role");
  });
});
