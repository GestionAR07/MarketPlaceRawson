-- Trigger-only SECURITY DEFINER functions must not be exposed as client-callable RPCs.
-- Supabase grants EXECUTE on new public functions to anon/authenticated via
-- default privileges, so revoking from PUBLIC alone is not sufficient.

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.broadcast_merchant_order_inserted() FROM PUBLIC, anon, authenticated;
