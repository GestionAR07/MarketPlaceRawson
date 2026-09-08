import { NextResponse } from "next/server";

/**
 * Liveness only: the Next.js process can answer HTTP.
 * Does not check Postgres, Auth, or Storage.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { status: "ok" },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
