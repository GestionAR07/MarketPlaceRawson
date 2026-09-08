import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("safe App Router error boundaries", () => {
  const errorPage = read("src/app/error.tsx");
  const globalError = read("src/app/global-error.tsx");
  const notFound = read("src/app/not-found.tsx");

  it("provides route, global and not-found fallbacks", () => {
    expect(errorPage).toContain('"use client"');
    expect(globalError).toContain('"use client"');
    expect(notFound).not.toContain('"use client"');
  });

  it("keeps global-error self-contained with html and body", () => {
    expect(globalError).toContain("<html");
    expect(globalError).toContain("<body");
    expect(globalError).not.toContain("@/components");
    expect(globalError).not.toContain("@/styles");
  });

  it("offers reset and a safe home link without rendering error details", () => {
    expect(errorPage).toContain("reset()");
    expect(globalError).toContain("reset()");
    for (const source of [errorPage, globalError, notFound]) {
      expect(source).toContain('href="/"');
      expect(source).not.toContain("error.message");
      expect(source).not.toContain("error.stack");
      expect(source).not.toContain("error.digest");
      expect(source).not.toContain("error.cause");
      expect(source).not.toContain("console.error");
      expect(source).not.toContain("operationalLog");
      expect(source).not.toContain("SUPABASE");
      expect(source).not.toContain("DATABASE");
      expect(source).not.toContain("createSupabase");
    }
  });

  it("does not query Auth or the database from not-found", () => {
    expect(notFound).not.toContain("requireActiveUser");
    expect(notFound).not.toContain("getDb");
    expect(notFound).not.toContain("auth.");
  });
});
