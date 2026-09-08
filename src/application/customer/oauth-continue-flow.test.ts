import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthzError } from "@/server/auth/errors";
import {
  logOAuthContinueStage,
  oauthContinueLoginPath,
  resolveOAuthContinueFlow,
  type OAuthContinueDependencies,
} from "./oauth-continue-flow";

function deps(
  overrides: Partial<OAuthContinueDependencies> = {},
): OAuthContinueDependencies {
  return {
    canUseAuthAdmin: true,
    findConflictingAuthUserByEmail: vi.fn().mockResolvedValue(null),
    listActiveMerchantMemberships: vi.fn().mockResolvedValue({
      profile: {
        displayName: "Admin",
        phone: null,
        platformRole: "ADMIN",
      },
      memberships: [],
    }),
    ensureUserProfile: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("OAuth continue diagnostic stages", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("maps no session to oauth_no_session", async () => {
    const result = await resolveOAuthContinueFlow({
      sessionError: new Error("session missing"),
      sessionUser: null,
      deps: deps(),
    });
    expect(result).toEqual({
      ok: false,
      code: "oauth_no_session",
      signOut: false,
    });
    expect(oauthContinueLoginPath("oauth_no_session")).toBe(
      "/login?error=oauth_no_session",
    );
  });

  it("maps missing email to oauth_email_missing", async () => {
    const result = await resolveOAuthContinueFlow({
      sessionError: null,
      sessionUser: {
        id: "user-1",
        email: null,
        email_confirmed_at: "2026-01-01T00:00:00Z",
      },
      deps: deps(),
    });
    expect(result).toEqual({
      ok: false,
      code: "oauth_email_missing",
      signOut: true,
    });
  });

  it("maps unverified email to oauth_email_unverified", async () => {
    const result = await resolveOAuthContinueFlow({
      sessionError: null,
      sessionUser: { id: "user-1", email: "owner@example.com" },
      deps: deps(),
    });
    expect(result).toEqual({
      ok: false,
      code: "oauth_email_unverified",
      signOut: true,
    });
  });

  it("maps Admin lookup failure to oauth_admin_lookup without payload detail", async () => {
    const errorSpy = vi.mocked(console.error);
    const result = await resolveOAuthContinueFlow({
      sessionError: null,
      sessionUser: {
        id: "user-1",
        email: "owner@example.com",
        email_confirmed_at: "2026-01-01T00:00:00Z",
      },
      deps: deps({
        findConflictingAuthUserByEmail: vi
          .fn()
          .mockRejectedValue(
            new Error("Auth Admin listUsers failed: Invalid API key"),
          ),
      }),
    });
    expect(result).toEqual({
      ok: false,
      code: "oauth_admin_lookup",
      signOut: true,
    });
    expect(errorSpy).toHaveBeenCalledWith(
      "[oauth-continue] stage=oauth_admin_lookup",
    );
    expect(String(errorSpy.mock.calls[0]?.[0])).not.toContain("API key");
  });

  it("maps a conflicting different UUID to account_exists", async () => {
    const result = await resolveOAuthContinueFlow({
      sessionError: null,
      sessionUser: {
        id: "google-new",
        email: "owner@example.com",
        email_confirmed_at: "2026-01-01T00:00:00Z",
      },
      deps: deps({
        findConflictingAuthUserByEmail: vi
          .fn()
          .mockResolvedValue({ id: "owner-existing" }),
      }),
    });
    expect(result).toEqual({
      ok: false,
      code: "account_exists",
      signOut: true,
    });
  });

  it("maps USER_SUSPENDED to forbidden", async () => {
    const result = await resolveOAuthContinueFlow({
      sessionError: null,
      sessionUser: {
        id: "user-1",
        email: "owner@example.com",
        email_confirmed_at: "2026-01-01T00:00:00Z",
      },
      deps: deps({
        listActiveMerchantMemberships: vi
          .fn()
          .mockRejectedValue(new AuthzError("USER_SUSPENDED", "suspended")),
      }),
    });
    expect(result).toEqual({
      ok: false,
      code: "forbidden",
      signOut: true,
    });
  });

  it("maps unrecovered PROFILE_MISSING to oauth_profile", async () => {
    const result = await resolveOAuthContinueFlow({
      sessionError: null,
      sessionUser: {
        id: "user-1",
        email: "owner@example.com",
        email_confirmed_at: "2026-01-01T00:00:00Z",
      },
      deps: deps({
        listActiveMerchantMemberships: vi
          .fn()
          .mockRejectedValue(new AuthzError("PROFILE_MISSING", "missing")),
        ensureUserProfile: vi.fn().mockResolvedValue(undefined),
      }),
    });
    expect(result).toEqual({
      ok: false,
      code: "oauth_profile",
      signOut: false,
    });
  });

  it("maps other AuthzError codes to oauth_authorization", async () => {
    const result = await resolveOAuthContinueFlow({
      sessionError: null,
      sessionUser: {
        id: "user-1",
        email: "owner@example.com",
        email_confirmed_at: "2026-01-01T00:00:00Z",
      },
      deps: deps({
        listActiveMerchantMemberships: vi
          .fn()
          .mockRejectedValue(new AuthzError("CONFIG_MISSING", "config")),
      }),
    });
    expect(result).toEqual({
      ok: false,
      code: "oauth_authorization",
      signOut: false,
    });
  });

  it("logs only the stage code on failure", () => {
    const errorSpy = vi.mocked(console.error);
    logOAuthContinueStage("account_exists");
    expect(errorSpy).toHaveBeenCalledWith(
      "[oauth-continue] stage=account_exists",
    );
  });
});
