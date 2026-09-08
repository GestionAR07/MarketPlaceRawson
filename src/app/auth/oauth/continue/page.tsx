import { redirect } from "next/navigation";
import {
  oauthContinueLoginPath,
  resolveOAuthContinueFlow,
} from "@/application/customer/oauth-continue-flow";
import { ensureUserProfile } from "@/infrastructure/db/repositories/merchant-user-repository";
import {
  canCreateSupabaseAdminClient,
  createSupabaseAdminClient,
} from "@/infrastructure/supabase/admin";
import { findConflictingAuthUserByEmail } from "@/infrastructure/supabase/auth-admin";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { listActiveMerchantMemberships } from "@/server/auth/authorization";

export const dynamic = "force-dynamic";

export default async function OAuthContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: session, error: sessionError } = await supabase.auth.getUser();

  const result = await resolveOAuthContinueFlow({
    requestedNext: params.next,
    sessionError,
    sessionUser: session.user,
    deps: {
      canUseAuthAdmin: canCreateSupabaseAdminClient(),
      findConflictingAuthUserByEmail: async (email, currentUserId) => {
        const other = await findConflictingAuthUserByEmail(
          createSupabaseAdminClient(),
          email,
          currentUserId,
        );
        return other ? { id: other.id } : null;
      },
      listActiveMerchantMemberships,
      ensureUserProfile,
    },
  });

  if (!result.ok) {
    if (result.signOut) {
      await supabase.auth.signOut();
    }
    redirect(oauthContinueLoginPath(result.code));
  }

  redirect(result.destination);
}
