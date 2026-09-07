/**
 * Guarded DEV orphan sweep for interrupted WRITE_DEV Playwright runs.
 *
 * In-test cleanup remains exact-ID + finally (see fixtures). This module only
 * deletes rows that carry unambiguous E2E markers — never commercial data.
 *
 * Safe markers:
 * - product name starts with `[E2E:` (from e2eRunMarker)
 * - auth email `e2e-*@example.invalid`
 */

export const E2E_MARKER_NAME_PREFIX = "[E2E:";
export const E2E_BUYER_FLOW_PRODUCT_DESCRIPTION =
  "Run-scoped Playwright buyer-flow product.";
export const E2E_SYNTHETIC_EMAIL_SUFFIX = "@example.invalid";

const E2E_MARKER_NAME_PATTERN = /^\[E2E:[a-zA-Z0-9_-]{8,80}\]/;

export function isE2eMarkedProductName(name: string): boolean {
  return E2E_MARKER_NAME_PATTERN.test(name.trim());
}

export function isE2eSyntheticEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  const normalized = email.trim().toLowerCase();
  return (
    normalized.startsWith("e2e-") &&
    normalized.endsWith(E2E_SYNTHETIC_EMAIL_SUFFIX)
  );
}

export type E2eOrphanProductRow = {
  id: string;
  name: string;
  description: string | null;
};

export type E2eOrphanOrderRow = {
  id: string;
  customerEmail: string | null;
  productNames: readonly string[];
};

export type E2eOrphanAuthUserRow = {
  id: string;
  email: string | null;
};

export type E2eOrphanCleanupPlan = {
  products: readonly { id: string; name: string }[];
  orders: readonly { id: string; reason: "e2e_email" | "e2e_products_only" }[];
  authUsers: readonly { id: string; email: string }[];
  skippedOrders: readonly { id: string; reason: string }[];
};

/**
 * Pure planner — used by tests and by the DEV SQL adapter.
 * Never deletes by generic substrings like "Buyer" or "pickup".
 */
export function planE2eOrphanCleanup(input: {
  products: readonly E2eOrphanProductRow[];
  orders: readonly E2eOrphanOrderRow[];
  authUsers: readonly E2eOrphanAuthUserRow[];
}): E2eOrphanCleanupPlan {
  const products = input.products
    .filter((product) => isE2eMarkedProductName(product.name))
    .map((product) => ({ id: product.id, name: product.name }));

  const orders: { id: string; reason: "e2e_email" | "e2e_products_only" }[] =
    [];
  const skippedOrders: { id: string; reason: string }[] = [];

  for (const order of input.orders) {
    if (isE2eSyntheticEmail(order.customerEmail)) {
      orders.push({ id: order.id, reason: "e2e_email" });
      continue;
    }
    const touchesE2eProduct = order.productNames.some(isE2eMarkedProductName);
    if (!touchesE2eProduct) {
      continue;
    }
    if (
      order.productNames.length > 0 &&
      order.productNames.every(isE2eMarkedProductName)
    ) {
      orders.push({ id: order.id, reason: "e2e_products_only" });
      continue;
    }
    skippedOrders.push({
      id: order.id,
      reason: "mixed_or_unmarked_products",
    });
  }

  const authUsers = input.authUsers
    .filter((user) => isE2eSyntheticEmail(user.email))
    .map((user) => ({
      id: user.id,
      email: user.email!.trim().toLowerCase(),
    }));

  return { products, orders, authUsers, skippedOrders };
}

/**
 * Idempotent in-memory cleanup of a resource registry: clearing an already
 * removed id is a no-op; repeating clear + assert succeeds.
 */
export function clearRegisteredResourcesIdempotent(
  clearRegistered: (resource: { kind: string; id: string }) => void,
  resources: readonly { kind: string; id: string }[],
): void {
  for (const resource of resources) {
    clearRegistered(resource);
    clearRegistered(resource);
  }
}
