/**
 * Fail-closed check that DEV and PROD are not pointed at each other.
 * No network and no secret logging.
 *
 * MARKETPLACE_ENV selects the rules. NODE_ENV never chooses a Supabase project.
 * A serving process with NODE_ENV=production must still declare MARKETPLACE_ENV.
 */

export type EnvLike = Readonly<Record<string, string | undefined>>;

export type MarketplaceRuntimeKind = "development" | "test" | "production";

export type RuntimeEnvironmentInput = {
  marketplaceEnv?: string;
  devProjectRef?: string;
  prodProjectRef?: string;
  supabaseUrl?: string;
  appBaseUrl?: string;
  databaseUrl?: string;
};

const PROJECT_REF_PATTERN = /^[a-z0-9]{8,64}$/;
const SUPABASE_API_HOST = /^([a-z0-9]{8,64})\.supabase\.co$/i;

export class RuntimeEnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeEnvironmentError";
  }
}

export function normalizeMarketplaceEnv(
  raw: string | undefined,
): MarketplaceRuntimeKind | null {
  const value = raw?.trim().toLowerCase() ?? "";
  if (!value) {
    return null;
  }
  if (value === "development" || value === "test" || value === "production") {
    return value;
  }
  throw new RuntimeEnvironmentError(
    "MARKETPLACE_ENV must be development, test, or production.",
  );
}

/**
 * Project ref from https://<project-ref>.supabase.co.
 * Invalid URLs fail closed. The URL is never included in the error.
 */
export function extractSupabaseProjectRefFromUrl(supabaseUrl: string): string {
  const trimmed = supabaseUrl.trim();
  if (!trimmed) {
    throw new RuntimeEnvironmentError(
      "NEXT_PUBLIC_SUPABASE_URL is not a valid Supabase project URL.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new RuntimeEnvironmentError(
      "NEXT_PUBLIC_SUPABASE_URL is not a valid Supabase project URL.",
    );
  }

  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new RuntimeEnvironmentError(
      "NEXT_PUBLIC_SUPABASE_URL is not a valid Supabase project URL.",
    );
  }

  const match = SUPABASE_API_HOST.exec(parsed.hostname);
  const ref = match?.[1]?.toLowerCase();
  if (!ref || !PROJECT_REF_PATTERN.test(ref)) {
    throw new RuntimeEnvironmentError(
      "NEXT_PUBLIC_SUPABASE_URL is not a valid Supabase project URL.",
    );
  }

  return ref;
}

function normalizeDeclaredRef(
  raw: string | undefined,
  name: string,
): string | null {
  const trimmed = raw?.trim().toLowerCase() ?? "";
  if (!trimmed) {
    return null;
  }
  if (!PROJECT_REF_PATTERN.test(trimmed)) {
    throw new RuntimeEnvironmentError(`${name} is not a valid project ref.`);
  }
  return trimmed;
}

function assertHttpsAppBase(appBaseUrl: string | undefined): void {
  const raw = appBaseUrl?.trim() ?? "";
  if (!raw) {
    throw new RuntimeEnvironmentError(
      "APP_BASE_URL must use HTTPS in production.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new RuntimeEnvironmentError(
      "APP_BASE_URL must use HTTPS in production.",
    );
  }

  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new RuntimeEnvironmentError(
      "APP_BASE_URL must use HTTPS in production.",
    );
  }
}

function assertDatabaseDoesNotContainDevRef(
  databaseUrl: string | undefined,
  devRef: string,
): void {
  const raw = databaseUrl?.trim() ?? "";
  if (!raw) {
    return;
  }
  if (raw.toLowerCase().includes(devRef)) {
    throw new RuntimeEnvironmentError(
      "Production environment points to the DEV Supabase project.",
    );
  }
}

/**
 * Validates an explicit env snapshot. Does not read process.env itself.
 * `test` and unset MARKETPLACE_ENV skip identity rules so fixtures and
 * `next build` are not treated as a production deploy.
 */
export function validateRuntimeEnvironment(
  input: RuntimeEnvironmentInput,
): void {
  const kind = normalizeMarketplaceEnv(input.marketplaceEnv);
  if (kind === null || kind === "test") {
    return;
  }

  const devRef = normalizeDeclaredRef(
    input.devProjectRef,
    "MARKETPLACE_DEV_PROJECT_REF",
  );
  const prodRef = normalizeDeclaredRef(
    input.prodProjectRef,
    "MARKETPLACE_PROD_PROJECT_REF",
  );

  if (devRef && prodRef && devRef === prodRef) {
    throw new RuntimeEnvironmentError(
      "DEV and PROD Supabase project refs must be different.",
    );
  }

  if (kind === "production") {
    if (!prodRef) {
      throw new RuntimeEnvironmentError(
        "MARKETPLACE_PROD_PROJECT_REF is required when MARKETPLACE_ENV=production.",
      );
    }

    const urlRef = extractSupabaseProjectRefFromUrl(input.supabaseUrl ?? "");
    if (urlRef !== prodRef) {
      if (devRef && urlRef === devRef) {
        throw new RuntimeEnvironmentError(
          "Production environment points to the DEV Supabase project.",
        );
      }
      throw new RuntimeEnvironmentError(
        "NEXT_PUBLIC_SUPABASE_URL does not match MARKETPLACE_PROD_PROJECT_REF.",
      );
    }

    assertHttpsAppBase(input.appBaseUrl);
    if (devRef) {
      assertDatabaseDoesNotContainDevRef(input.databaseUrl, devRef);
    }
    return;
  }

  if (!devRef && !prodRef) {
    return;
  }

  if (!input.supabaseUrl?.trim()) {
    if (devRef) {
      throw new RuntimeEnvironmentError(
        "NEXT_PUBLIC_SUPABASE_URL does not match MARKETPLACE_DEV_PROJECT_REF.",
      );
    }
    return;
  }

  const urlRef = extractSupabaseProjectRefFromUrl(input.supabaseUrl);
  if (devRef && urlRef !== devRef) {
    if (prodRef && urlRef === prodRef) {
      throw new RuntimeEnvironmentError(
        "Development environment points to the PROD Supabase project.",
      );
    }
    throw new RuntimeEnvironmentError(
      "NEXT_PUBLIC_SUPABASE_URL does not match MARKETPLACE_DEV_PROJECT_REF.",
    );
  }

  if (prodRef && urlRef === prodRef) {
    throw new RuntimeEnvironmentError(
      "Development environment points to the PROD Supabase project.",
    );
  }
}

/**
 * Next sets this only while compiling (`next build` / CI build).
 * It distinguishes that compilation from a serving production process.
 * It must not select DEV, PROD, a Supabase project, or MARKETPLACE_ENV.
 */
const NEXT_PRODUCTION_BUILD_PHASE = "phase-production-build";

const MISSING_MARKETPLACE_ENV_MESSAGE =
  "MARKETPLACE_ENV must be explicitly set for a production runtime.";

function isServingProductionProcess(env: EnvLike): boolean {
  return (
    env.NODE_ENV === "production" &&
    env.NEXT_PHASE !== NEXT_PRODUCTION_BUILD_PHASE
  );
}

export function assertSafeRuntimeEnvironment(env: EnvLike = process.env): void {
  const marketplaceEnv = env.MARKETPLACE_ENV?.trim() ?? "";
  if (!marketplaceEnv && isServingProductionProcess(env)) {
    throw new RuntimeEnvironmentError(MISSING_MARKETPLACE_ENV_MESSAGE);
  }

  validateRuntimeEnvironment({
    marketplaceEnv: env.MARKETPLACE_ENV,
    devProjectRef: env.MARKETPLACE_DEV_PROJECT_REF,
    prodProjectRef: env.MARKETPLACE_PROD_PROJECT_REF,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    appBaseUrl: env.APP_BASE_URL,
    databaseUrl: env.DATABASE_URL,
  });
}
