import { describe, expect, it, vi } from "vitest";
import {
  clearRegisteredResourcesIdempotent,
  E2E_BUYER_FLOW_PRODUCT_DESCRIPTION,
  isE2eMarkedProductName,
  isE2eSyntheticEmail,
  planE2eOrphanCleanup,
} from "./e2e-orphan-cleanup";
import { E2eCreatedResourceRegistry } from "./e2e-run-scope";

describe("E2E orphan cleanup planner", () => {
  it("matches only [E2E:runId] product names and synthetic e2e emails", () => {
    expect(isE2eMarkedProductName("[E2E:abcdef12] Buyer pickup product")).toBe(
      true,
    );
    expect(isE2eMarkedProductName("Buyer pickup product")).toBe(false);
    expect(isE2eMarkedProductName("[E2E:x] short")).toBe(false);
    expect(isE2eMarkedProductName("Comercio Prueba Empanada")).toBe(false);

    expect(isE2eSyntheticEmail("e2e-buyer-abcdef12@example.invalid")).toBe(
      true,
    );
    expect(isE2eSyntheticEmail("eliasrawson@gmail.com")).toBe(false);
    expect(isE2eSyntheticEmail("buyer@example.com")).toBe(false);
  });

  it("plans deletes for E2E products and refuses mixed commercial orders", () => {
    const plan = planE2eOrphanCleanup({
      products: [
        {
          id: "p-e2e",
          name: "[E2E:run12345678] Buyer pickup product",
          description: E2E_BUYER_FLOW_PRODUCT_DESCRIPTION,
        },
        {
          id: "p-real",
          name: "Empanada de carne",
          description: "Real catalog product",
        },
      ],
      orders: [
        {
          id: "o-e2e",
          customerEmail: "e2e-buyer-run12345678@example.invalid",
          productNames: ["[E2E:run12345678] Buyer pickup product"],
        },
        {
          id: "o-mixed",
          customerEmail: "cliente@real.test",
          productNames: [
            "[E2E:run12345678] Buyer pickup product",
            "Empanada de carne",
          ],
        },
        {
          id: "o-real",
          customerEmail: "cliente@real.test",
          productNames: ["Empanada de carne"],
        },
      ],
      authUsers: [
        {
          id: "u-e2e",
          email: "e2e-buyer-run12345678@example.invalid",
        },
        { id: "u-real", email: "owner@example.com" },
      ],
    });

    expect(plan.products).toEqual([
      {
        id: "p-e2e",
        name: "[E2E:run12345678] Buyer pickup product",
      },
    ]);
    expect(plan.orders).toEqual([{ id: "o-e2e", reason: "e2e_email" }]);
    expect(plan.skippedOrders).toEqual([
      { id: "o-mixed", reason: "mixed_or_unmarked_products" },
    ]);
    expect(plan.authUsers).toEqual([
      {
        id: "u-e2e",
        email: "e2e-buyer-run12345678@example.invalid",
      },
    ]);
  });

  it("is idempotent when the fixture registry is already partially clear", () => {
    const registry = new E2eCreatedResourceRegistry("run12345678");
    registry.register({ kind: "product", id: "product-1" });
    registry.register({ kind: "order", id: "order-1" });

    clearRegisteredResourcesIdempotent(
      (resource) =>
        registry.clearRegistered({
          kind: resource.kind as "product" | "order",
          id: resource.id,
        }),
      [
        { kind: "product", id: "product-1" },
        { kind: "order", id: "order-1" },
        { kind: "product", id: "product-1" },
      ],
    );

    expect(() => registry.assertCleanupComplete()).not.toThrow();

    // Second cleanup pass must not throw.
    clearRegisteredResourcesIdempotent(
      (resource) =>
        registry.clearRegistered({
          kind: resource.kind as "product" | "order",
          id: resource.id,
        }),
      [
        { kind: "product", id: "product-1" },
        { kind: "order", id: "order-1" },
      ],
    );
    expect(() => registry.assertCleanupComplete()).not.toThrow();
  });

  it("does not plan commercial products even if description mentions Playwright", () => {
    const plan = planE2eOrphanCleanup({
      products: [
        {
          id: "p-fake",
          name: "Run-scoped Playwright buyer-flow product.",
          description: E2E_BUYER_FLOW_PRODUCT_DESCRIPTION,
        },
      ],
      orders: [],
      authUsers: [],
    });
    expect(plan.products).toEqual([]);
  });

  it("plans e2e-product-only orders without synthetic email", () => {
    const plan = planE2eOrphanCleanup({
      products: [
        {
          id: "p1",
          name: "[E2E:run12345678] Buyer product",
          description: null,
        },
      ],
      orders: [
        {
          id: "o1",
          customerEmail: null,
          productNames: ["[E2E:run12345678] Buyer product"],
        },
      ],
      authUsers: [],
    });
    expect(plan.orders).toEqual([{ id: "o1", reason: "e2e_products_only" }]);
  });
});

describe("E2E orphan cleanup DB adapter contract", () => {
  it("exports a dry-run friendly sweep entrypoint", async () => {
    const { sweepE2eOrphanResidues } = await import("./e2e-orphan-cleanup-db");
    const sql = Object.assign(
      vi.fn(async (strings: TemplateStringsArray) => {
        const query = strings.join("?");
        if (query.includes("from products")) {
          return [
            {
              id: "p-e2e",
              name: "[E2E:run12345678] Buyer pickup product",
              description: E2E_BUYER_FLOW_PRODUCT_DESCRIPTION,
            },
            {
              id: "p-real",
              name: "Empanada de carne",
              description: "keep",
            },
          ];
        }
        if (query.includes("from auth.users")) {
          return [];
        }
        if (query.includes("from orders")) {
          return [];
        }
        return [];
      }),
      { end: vi.fn() },
    );

    const report = await sweepE2eOrphanResidues({
      sql: sql as never,
      dryRun: true,
    });

    expect(report.dryRun).toBe(true);
    expect(report.plan.products).toEqual([
      {
        id: "p-e2e",
        name: "[E2E:run12345678] Buyer pickup product",
      },
    ]);
    expect(report.deleted.products).toBe(0);

    const second = await sweepE2eOrphanResidues({
      sql: sql as never,
      dryRun: true,
    });
    expect(second.plan.products).toHaveLength(1);
  });
});
