/**
 * DEV-only E2E orphan residue cleanup (dry-run by default).
 *
 * PowerShell (from repo root):
 *   $env:E2E_ALLOW_WRITES="I_ACCEPT_E2E_DEV_WRITES"; npm run e2e:orphan-cleanup
 *   $env:E2E_ALLOW_WRITES="I_ACCEPT_E2E_DEV_WRITES"; npm run e2e:orphan-cleanup -- --execute
 *
 * The write sentinel must come from the operator shell — never from .env.local.
 * Never logs DATABASE_URL, secrets, tokens, or project refs.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import {
  assertE2eDevWriteAllowed,
  E2E_WRITE_DEV_MODE,
} from "./dev-write-guard";
import { sweepE2eOrphanResidues } from "./e2e-orphan-cleanup-db";

function loadEnvLocalFile(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const eq = line.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function printPlan(
  label: string,
  report: Awaited<ReturnType<typeof sweepE2eOrphanResidues>>,
): void {
  console.log(`[e2e-orphan-cleanup] ${label}`);
  console.log(`  dryRun=${report.dryRun}`);
  console.log(`  products=${report.plan.products.length}`);
  for (const product of report.plan.products) {
    console.log(`    - product name=${JSON.stringify(product.name)}`);
  }
  console.log(`  orders=${report.plan.orders.length}`);
  for (const order of report.plan.orders) {
    console.log(`    - order reason=${order.reason}`);
  }
  console.log(`  authUsers=${report.plan.authUsers.length}`);
  for (const user of report.plan.authUsers) {
    console.log(`    - auth email=${user.email}`);
  }
  if (report.plan.skippedOrders.length > 0) {
    console.log(`  skippedOrders=${report.plan.skippedOrders.length}`);
    for (const skipped of report.plan.skippedOrders) {
      console.log(`    - skipped reason=${skipped.reason}`);
    }
  }
  if (!report.dryRun) {
    console.log(
      `  deleted products=${report.deleted.products} orders=${report.deleted.orders} authUsers=${report.deleted.authUsers}`,
    );
  }
}

async function main(): Promise<void> {
  // Capture operator confirmation before .env.local can override it.
  const explicitWriteConfirmation = process.env.E2E_ALLOW_WRITES;
  loadEnvLocalFile();
  if (explicitWriteConfirmation === undefined) {
    delete process.env.E2E_ALLOW_WRITES;
  } else {
    process.env.E2E_ALLOW_WRITES = explicitWriteConfirmation;
  }
  process.env.E2E_MODE = E2E_WRITE_DEV_MODE;

  const execute = process.argv.includes("--execute");
  const appBaseUrl =
    process.env.APP_BASE_URL?.trim() || "http://127.0.0.1:3001";

  assertE2eDevWriteAllowed({ env: process.env, appBaseUrl });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("E2E orphan cleanup: DATABASE_URL is required.");
  }

  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    const dryReport = await sweepE2eOrphanResidues({ sql, dryRun: true });
    printPlan("DRY-RUN", dryReport);

    if (!execute) {
      console.log(
        "[e2e-orphan-cleanup] Re-run with --execute to delete the listed E2E residues.",
      );
      return;
    }

    if (
      dryReport.plan.products.length === 0 &&
      dryReport.plan.orders.length === 0 &&
      dryReport.plan.authUsers.length === 0
    ) {
      console.log("[e2e-orphan-cleanup] Nothing to delete.");
      return;
    }

    if (dryReport.plan.skippedOrders.length > 0) {
      throw new Error(
        "E2E orphan cleanup: refusing --execute while mixed/unmarked orders are skipped.",
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!supabaseUrl || !secret) {
      throw new Error(
        "E2E orphan cleanup: Supabase Admin env is required for auth user delete.",
      );
    }
    const admin = createClient(supabaseUrl, secret, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const execReport = await sweepE2eOrphanResidues({
      sql,
      dryRun: false,
      deleteAuthUser: async (userId) => {
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error) {
          throw new Error(`Auth delete failed: ${error.message}`);
        }
      },
    });
    printPlan("EXECUTED", execReport);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(`[e2e-orphan-cleanup] ${message}`);
  process.exitCode = 1;
});
