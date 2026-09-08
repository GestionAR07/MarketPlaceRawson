import type postgres from "postgres";
import {
  isE2eMarkedProductName,
  isE2eSyntheticEmail,
  planE2eOrphanCleanup,
  type E2eOrphanCleanupPlan,
} from "./e2e-orphan-cleanup";

type Sql = postgres.Sql;

async function deleteOrderByExactId(sql: Sql, orderId: string): Promise<void> {
  const items = await sql<{ id: string }[]>`
    select id
    from order_items
    where order_id = ${orderId}
  `;
  const itemIds = items.map((item) => item.id);

  await sql`delete from deliveries where order_id = ${orderId}`;
  if (itemIds.length > 0) {
    await sql`
      delete from order_item_options
      where order_item_id = any(${itemIds}::uuid[])
    `;
  }
  await sql`delete from order_items where order_id = ${orderId}`;
  await sql`delete from order_events where order_id = ${orderId}`;
  await sql`delete from orders where id = ${orderId}`;
}

export type E2eOrphanSweepReport = {
  dryRun: boolean;
  plan: E2eOrphanCleanupPlan;
  deleted: {
    products: number;
    orders: number;
    authUsers: number;
  };
};

/**
 * Discover E2E-marked residues and optionally delete them.
 * Caller must already pass WRITE_DEV identity guards.
 */
export async function sweepE2eOrphanResidues(input: {
  sql: Sql;
  dryRun: boolean;
  deleteAuthUser?: (userId: string) => Promise<void>;
}): Promise<E2eOrphanSweepReport> {
  const productRows = await input.sql<
    { id: string; name: string; description: string | null }[]
  >`
    select id, name, description
    from products
    where name like ${"[E2E:%"}
    order by created_at, id
  `;

  const e2eProducts = productRows.filter((row) =>
    isE2eMarkedProductName(row.name),
  );
  const e2eProductIds = e2eProducts.map((row) => row.id);

  const orderRowsRaw =
    e2eProductIds.length === 0
      ? []
      : await input.sql<
          {
            id: string;
            customer_email: string | null;
            product_names: string[] | null;
          }[]
        >`
          select
            o.id,
            au.email as customer_email,
            array_agg(distinct coalesce(p.name, '')) as product_names
          from orders o
          left join auth.users au on au.id = o.customer_user_id
          join order_items oi on oi.order_id = o.id
          left join products p on p.id = oi.product_id
          where oi.product_id = any(${e2eProductIds}::uuid[])
             or (
               au.email is not null
               and au.email ilike 'e2e-%@example.invalid'
             )
          group by o.id, au.email
          order by o.created_at, o.id
        `;

  // Also pick up e2e-email orders that no longer reference e2e products.
  const emailOnlyOrders = await input.sql<
    {
      id: string;
      customer_email: string | null;
      product_names: string[] | null;
    }[]
  >`
    select
      o.id,
      au.email as customer_email,
      coalesce(
        (
          select array_agg(distinct coalesce(p.name, ''))
          from order_items oi
          left join products p on p.id = oi.product_id
          where oi.order_id = o.id
        ),
        '{}'::text[]
      ) as product_names
    from orders o
    join auth.users au on au.id = o.customer_user_id
    where au.email ilike 'e2e-%@example.invalid'
    order by o.created_at, o.id
  `;

  const orderMap = new Map<
    string,
    { id: string; customerEmail: string | null; productNames: string[] }
  >();
  for (const row of [...orderRowsRaw, ...emailOnlyOrders]) {
    orderMap.set(row.id, {
      id: row.id,
      customerEmail: row.customer_email,
      productNames: (row.product_names ?? []).filter(Boolean),
    });
  }

  const authUsers = await input.sql<{ id: string; email: string | null }[]>`
    select id, email
    from auth.users
    where email ilike 'e2e-%@example.invalid'
    order by created_at, id
  `;

  const plan = planE2eOrphanCleanup({
    products: e2eProducts,
    orders: [...orderMap.values()],
    authUsers,
  });

  const deleted = { products: 0, orders: 0, authUsers: 0 };
  if (input.dryRun) {
    return { dryRun: true, plan, deleted };
  }

  for (const order of plan.orders) {
    await deleteOrderByExactId(input.sql, order.id);
    deleted.orders += 1;
  }

  for (const product of plan.products) {
    await input.sql`delete from products where id = ${product.id}`;
    deleted.products += 1;
  }

  if (input.deleteAuthUser) {
    for (const user of plan.authUsers) {
      if (!isE2eSyntheticEmail(user.email)) {
        continue;
      }
      await input.deleteAuthUser(user.id);
      deleted.authUsers += 1;
    }
  }

  return { dryRun: false, plan, deleted };
}
