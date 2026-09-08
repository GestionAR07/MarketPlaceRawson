import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertSafeRuntimeEnvironment,
  extractSupabaseProjectRefFromUrl,
  RuntimeEnvironmentError,
  validateRuntimeEnvironment,
  type RuntimeEnvironmentInput,
} from "./runtime-environment";

const DEV_REF = "abcdefghijklmnop";
const PROD_REF = "prodrefvalue1234";
const SECRET = "super-secret-service-key-value";
const DATABASE_URL = `postgresql://postgres.${DEV_REF}:${SECRET}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`;

function production(
  overrides: Partial<RuntimeEnvironmentInput> = {},
): RuntimeEnvironmentInput {
  return {
    marketplaceEnv: "production",
    devProjectRef: DEV_REF,
    prodProjectRef: PROD_REF,
    supabaseUrl: `https://${PROD_REF}.supabase.co`,
    appBaseUrl: "https://pedilo.example",
    ...overrides,
  };
}

function development(
  overrides: Partial<RuntimeEnvironmentInput> = {},
): RuntimeEnvironmentInput {
  return {
    marketplaceEnv: "development",
    devProjectRef: DEV_REF,
    prodProjectRef: PROD_REF,
    supabaseUrl: `https://${DEV_REF}.supabase.co`,
    appBaseUrl: "http://localhost:3001",
    ...overrides,
  };
}

describe("validateRuntimeEnvironment", () => {
  it("accepts production pointed at the PROD ref over HTTPS", () => {
    expect(() => validateRuntimeEnvironment(production())).not.toThrow();
  });

  it("rejects production pointed at the DEV ref", () => {
    expect(() =>
      validateRuntimeEnvironment(
        production({ supabaseUrl: `https://${DEV_REF}.supabase.co` }),
      ),
    ).toThrow(/Production environment points to the DEV Supabase project/);
  });

  it("rejects identical DEV and PROD refs", () => {
    expect(() =>
      validateRuntimeEnvironment(
        production({
          devProjectRef: PROD_REF,
          supabaseUrl: `https://${PROD_REF}.supabase.co`,
        }),
      ),
    ).toThrow(/DEV and PROD Supabase project refs must be different/);
  });

  it("rejects an HTTP APP_BASE_URL in production", () => {
    expect(() =>
      validateRuntimeEnvironment(
        production({ appBaseUrl: "http://pedilo.example" }),
      ),
    ).toThrow(/APP_BASE_URL must use HTTPS in production/);
  });

  it("accepts an HTTPS APP_BASE_URL in production", () => {
    expect(() =>
      validateRuntimeEnvironment(
        production({ appBaseUrl: "https://pedilo.example" }),
      ),
    ).not.toThrow();
  });

  it("requires MARKETPLACE_PROD_PROJECT_REF in production", () => {
    expect(() =>
      validateRuntimeEnvironment(production({ prodProjectRef: "" })),
    ).toThrow(/MARKETPLACE_PROD_PROJECT_REF is required/);
  });

  it("accepts development pointed at the DEV ref", () => {
    expect(() => validateRuntimeEnvironment(development())).not.toThrow();
  });

  it("rejects development pointed at the known PROD ref", () => {
    expect(() =>
      validateRuntimeEnvironment(
        development({ supabaseUrl: `https://${PROD_REF}.supabase.co` }),
      ),
    ).toThrow(/Development environment points to the PROD Supabase project/);
  });

  it("allows development without MARKETPLACE_PROD_PROJECT_REF", () => {
    expect(() =>
      validateRuntimeEnvironment(development({ prodProjectRef: "" })),
    ).not.toThrow();
  });

  it("rejects an invalid Supabase URL without echoing it", () => {
    const leaked = "https://user:leak-token@not-supabase.example/path";
    expect(() =>
      validateRuntimeEnvironment(production({ supabaseUrl: leaked })),
    ).toThrow(RuntimeEnvironmentError);
    try {
      validateRuntimeEnvironment(production({ supabaseUrl: leaked }));
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeEnvironmentError);
      expect(String(error)).not.toContain(leaked);
      expect(String(error)).not.toContain("leak-token");
    }
  });

  it("rejects a production DATABASE_URL that contains the DEV ref", () => {
    expect(() =>
      validateRuntimeEnvironment(production({ databaseUrl: DATABASE_URL })),
    ).toThrow(/Production environment points to the DEV Supabase project/);
  });

  it("never includes the full DATABASE_URL or secrets in the error", () => {
    try {
      validateRuntimeEnvironment(production({ databaseUrl: DATABASE_URL }));
      throw new Error("expected rejection");
    } catch (error) {
      const text = String(error);
      expect(text).not.toContain(DATABASE_URL);
      expect(text).not.toContain(SECRET);
      expect(text).not.toContain("postgresql://");
    }
  });

  it("does not treat NODE_ENV=production as a production deploy", () => {
    expect(() =>
      validateRuntimeEnvironment({
        marketplaceEnv: undefined,
        supabaseUrl: `https://${DEV_REF}.supabase.co`,
        appBaseUrl: "http://localhost:3001",
        databaseUrl: DATABASE_URL,
      }),
    ).not.toThrow();
    expect(() =>
      validateRuntimeEnvironment({
        marketplaceEnv: "test",
        supabaseUrl: "https://not-a-real-host.example",
        appBaseUrl: "http://localhost:3001",
      }),
    ).not.toThrow();
  });
});

describe("assertSafeRuntimeEnvironment presence", () => {
  const leak = {
    DATABASE_URL: DATABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: `https://${DEV_REF}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key-value",
    SUPABASE_SECRET_KEY: SECRET,
  };

  it("rejects a serving production process with MARKETPLACE_ENV missing", () => {
    expect(() =>
      assertSafeRuntimeEnvironment({
        NODE_ENV: "production",
        ...leak,
      }),
    ).toThrow(
      /MARKETPLACE_ENV must be explicitly set for a production runtime/,
    );
  });

  it("allows next build to compile with MARKETPLACE_ENV missing", () => {
    expect(() =>
      assertSafeRuntimeEnvironment({
        NODE_ENV: "production",
        NEXT_PHASE: "phase-production-build",
        ...leak,
      }),
    ).not.toThrow();
  });

  it("accepts an explicit production selection with a matching PROD config", () => {
    expect(() =>
      assertSafeRuntimeEnvironment({
        NODE_ENV: "production",
        MARKETPLACE_ENV: "production",
        MARKETPLACE_DEV_PROJECT_REF: DEV_REF,
        MARKETPLACE_PROD_PROJECT_REF: PROD_REF,
        NEXT_PUBLIC_SUPABASE_URL: `https://${PROD_REF}.supabase.co`,
        APP_BASE_URL: "https://pedilo.example",
      }),
    ).not.toThrow();
  });

  it("allows local development without MARKETPLACE_ENV", () => {
    expect(() =>
      assertSafeRuntimeEnvironment({
        NODE_ENV: "development",
        ...leak,
      }),
    ).not.toThrow();
  });

  it("allows MARKETPLACE_ENV=test", () => {
    expect(() =>
      assertSafeRuntimeEnvironment({
        NODE_ENV: "production",
        MARKETPLACE_ENV: "test",
        ...leak,
      }),
    ).not.toThrow();
  });

  it("does not leak secrets when MARKETPLACE_ENV is missing", () => {
    try {
      assertSafeRuntimeEnvironment({
        NODE_ENV: "production",
        ...leak,
      });
      throw new Error("expected rejection");
    } catch (error) {
      const text = String(error);
      expect(text).toContain(
        "MARKETPLACE_ENV must be explicitly set for a production runtime",
      );
      expect(text).not.toContain(DATABASE_URL);
      expect(text).not.toContain(SECRET);
      expect(text).not.toContain("publishable-key-value");
      expect(text).not.toContain(DEV_REF);
      expect(text).not.toContain("supabase.co");
    }
  });

  it("does not treat NODE_ENV=production as a PROD Supabase selection", () => {
    expect(() =>
      assertSafeRuntimeEnvironment({
        NODE_ENV: "production",
        MARKETPLACE_ENV: "development",
        MARKETPLACE_DEV_PROJECT_REF: DEV_REF,
        NEXT_PUBLIC_SUPABASE_URL: `https://${DEV_REF}.supabase.co`,
        APP_BASE_URL: "http://localhost:3001",
      }),
    ).not.toThrow();
  });
});

describe("runtime environment guard wiring", () => {
  it("keeps the browser client out and uses NODE_ENV only as a presence gate", () => {
    const guard = fs.readFileSync(
      path.join(process.cwd(), "src/config/runtime-environment.ts"),
      "utf8",
    );
    const browser = fs.readFileSync(
      path.join(process.cwd(), "src/infrastructure/supabase/browser.ts"),
      "utf8",
    );
    expect(guard).not.toContain("process.env.NODE_ENV");
    expect(guard).toContain("phase-production-build");
    expect(guard).toContain(
      "must not select DEV, PROD, a Supabase project, or MARKETPLACE_ENV",
    );
    expect(browser).not.toContain("runtime-environment");
    expect(browser).not.toContain("assertSafeRuntimeEnvironment");
  });
});

describe("extractSupabaseProjectRefFromUrl", () => {
  it("reads the project ref and rejects malformed URLs", () => {
    expect(
      extractSupabaseProjectRefFromUrl(`https://${DEV_REF}.supabase.co`),
    ).toBe(DEV_REF);
    expect(() => extractSupabaseProjectRefFromUrl("not a url")).toThrow(
      /not a valid Supabase project URL/,
    );
  });
});
