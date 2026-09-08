import {
  gateOAuthEmail,
  isConflictingAuthIdentity,
  isOAuthEmailVerified,
  oauthDisplayNameFromMetadata,
  type OAuthEmailClaims,
} from "@/application/customer/oauth-identity";
import {
  resolveOAuthContinueRedirect,
  resolveOAuthDestination,
} from "@/application/customer/oauth-continuation";
import type { CustomerContactProfile } from "@/application/customer/profile";
import { normalizeEmail } from "@/lib/email";
import { AuthzError, isAuthzError } from "@/server/auth/errors";
import type { PlatformRole } from "@/server/auth/types";

/**
 * Login `error=` query values for OAuth continue failures.
 * Public UI may collapse several oauth_* codes into one message; the URL
 * keeps the stage distinct for support without PII.
 */
export type OAuthContinueErrorCode =
  | "oauth_no_session"
  | "oauth_email_missing"
  | "oauth_email_unverified"
  | "oauth_admin_lookup"
  | "oauth_profile"
  | "oauth_authorization"
  | "account_exists"
  | "forbidden";

export type OAuthContinueResult =
  | { ok: true; destination: string }
  | { ok: false; code: OAuthContinueErrorCode; signOut: boolean };

export type OAuthContinueMembershipContext = {
  profile: CustomerContactProfile & { platformRole: PlatformRole };
  memberships: readonly { merchantId: string }[];
};

export type OAuthContinueDependencies = {
  findConflictingAuthUserByEmail: (
    normalizedEmail: string,
    currentUserId: string,
  ) => Promise<{ id: string } | null>;
  listActiveMerchantMemberships: () => Promise<OAuthContinueMembershipContext>;
  ensureUserProfile: (input: {
    userId: string;
    displayName?: string | null;
  }) => Promise<void>;
  canUseAuthAdmin: boolean;
};

/** Failures only — never logs email, UUID, tokens, or free-form Admin payloads. */
export function logOAuthContinueStage(stage: OAuthContinueErrorCode): void {
  console.error(`[oauth-continue] stage=${stage}`);
}

export function oauthContinueLoginPath(code: OAuthContinueErrorCode): string {
  return `/login?error=${code}`;
}

function authzFailureCode(error: AuthzError): OAuthContinueErrorCode {
  if (error.code === "USER_SUSPENDED") {
    return "forbidden";
  }
  if (error.code === "PROFILE_MISSING") {
    return "oauth_profile";
  }
  return "oauth_authorization";
}

/**
 * Post-PKCE identity gates and destination resolution.
 * Never merges Auth users or rewrites memberships across UUIDs.
 */
export async function resolveOAuthContinueFlow(input: {
  requestedNext?: string | null;
  sessionError: unknown;
  sessionUser: (OAuthEmailClaims & { id: string }) | null;
  deps: OAuthContinueDependencies;
}): Promise<OAuthContinueResult> {
  if (input.sessionError || !input.sessionUser) {
    logOAuthContinueStage("oauth_no_session");
    return { ok: false, code: "oauth_no_session", signOut: false };
  }

  const user = input.sessionUser;
  const emailGate = gateOAuthEmail({
    email: user.email ?? null,
    emailVerified: isOAuthEmailVerified(user),
  });
  if (!emailGate.ok) {
    const code =
      emailGate.reason === "missing_email"
        ? "oauth_email_missing"
        : "oauth_email_unverified";
    logOAuthContinueStage(code);
    return { ok: false, code, signOut: true };
  }

  if (input.deps.canUseAuthAdmin) {
    let otherUserId: string | null = null;
    try {
      const other = await input.deps.findConflictingAuthUserByEmail(
        normalizeEmail(emailGate.email),
        user.id,
      );
      otherUserId = other?.id ?? null;
    } catch {
      logOAuthContinueStage("oauth_admin_lookup");
      return { ok: false, code: "oauth_admin_lookup", signOut: true };
    }
    if (
      isConflictingAuthIdentity({
        sessionUserId: user.id,
        otherUserIdWithSameEmail: otherUserId,
      })
    ) {
      logOAuthContinueStage("account_exists");
      return { ok: false, code: "account_exists", signOut: true };
    }
  }

  try {
    let context: OAuthContinueMembershipContext;
    try {
      context = await input.deps.listActiveMerchantMemberships();
    } catch (error) {
      if (!isAuthzError(error) || error.code !== "PROFILE_MISSING") {
        throw error;
      }
      await input.deps.ensureUserProfile({
        userId: user.id,
        displayName: oauthDisplayNameFromMetadata(user.user_metadata),
      });
      context = await input.deps.listActiveMerchantMemberships();
    }

    const destination = resolveOAuthDestination({
      requestedNext: input.requestedNext,
      platformRole: context.profile.platformRole,
      memberships: context.memberships,
    });
    return {
      ok: true,
      destination: resolveOAuthContinueRedirect({
        destination,
        profile: context.profile,
      }),
    };
  } catch (error) {
    if (isAuthzError(error)) {
      const code = authzFailureCode(error);
      logOAuthContinueStage(code);
      return {
        ok: false,
        code,
        signOut: code === "forbidden",
      };
    }
    throw error;
  }
}
