import { moneyCents } from "@/domain/money/money-cents";
import { operationalLog } from "@/lib/operational-log";
import { parseIdempotencyKey } from "@/domain/order/idempotency";
import type { FulfillmentMethod } from "@/domain/order/enums";
import { err, ok, type Result } from "@/domain/shared/result";
import {
  checkoutError,
  CHECKOUT_ERROR_CODES,
  type CheckoutApplicationError,
} from "./errors";
import {
  canonicalIntentFromPersisted,
  canonicalIntentFromRequest,
} from "./intent-fingerprint";
import { prepareOrder } from "./prepare-order";
import { buildQuoteFingerprint, toCheckoutReview } from "./checkout-review";
import type {
  PersistedCheckoutOrder,
  PersistPreparedOrderResult,
  PlacedOrderResult,
  PreparedOrder,
  PrepareOrderDeps,
  PrepareOrderInput,
} from "./types";

export type PlaceOrderDeps = PrepareOrderDeps & {
  findOrderByIdempotencyKey: (
    key: string,
  ) => Promise<PersistedCheckoutOrder | null>;
  persistPreparedOrder: (
    prepared: PreparedOrder,
  ) => Promise<PersistPreparedOrderResult>;
};

export type PlaceOrderContext = {
  /** Verified on the server; never read from the checkout payload. */
  customerUserId?: string | null;
};

function fail(
  code: (typeof CHECKOUT_ERROR_CODES)[keyof typeof CHECKOUT_ERROR_CODES],
  message: string,
  review?: ReturnType<typeof toCheckoutReview>,
  stage = "validate",
): Result<PlacedOrderResult, CheckoutApplicationError> {
  operationalLog.error("order.place_failed", {
    stage,
    error_code: code,
  });
  return err(checkoutError(code, message, review));
}

function replayOrConflict(
  existing: PersistedCheckoutOrder,
  input: PrepareOrderInput,
  context: PlaceOrderContext,
): Result<PlacedOrderResult, CheckoutApplicationError> {
  const requestedCustomerUserId = context.customerUserId ?? null;
  if ((existing.customerUserId ?? null) !== requestedCustomerUserId) {
    return fail(
      CHECKOUT_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      "Ya existe un pedido con esta clave de idempotencia y otra cuenta.",
      undefined,
      "idempotency",
    );
  }

  const requestIntent = canonicalIntentFromRequest(input);
  const persistedIntent = canonicalIntentFromPersisted(existing);
  if (!requestIntent.ok || requestIntent.value !== persistedIntent) {
    return fail(
      CHECKOUT_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      "Ya existe un pedido con esta clave de idempotencia y otra intención.",
      undefined,
      "idempotency",
    );
  }

  return ok({
    orderId: existing.orderId,
    status: "PENDING",
    merchantId: existing.merchantId,
    totalCents: moneyCents(existing.totalCents),
    fulfillmentMethod: existing.fulfillmentMethod as FulfillmentMethod,
    replayed: true,
  });
}

/**
 * Idempotency-first order placement.
 *
 * Lookup by idempotency_key happens BEFORE prepareOrder so a lost-response
 * retry does not fail after the first attempt already decremented stock.
 *
 * TRACKED stock is decremented when the PENDING order is created.
 * Cancel restores TRACKED stock exactly once (see cancelOrder).
 */
export async function placeOrder(
  input: PrepareOrderInput,
  deps: PlaceOrderDeps,
  context: PlaceOrderContext = {},
): Promise<Result<PlacedOrderResult, CheckoutApplicationError>> {
  const keyResult = parseIdempotencyKey(input.idempotencyKey ?? "");
  if (!keyResult.ok) {
    return fail(
      CHECKOUT_ERROR_CODES.IDEMPOTENCY_KEY_INVALID,
      "La clave de idempotencia no es válida.",
      undefined,
      "idempotency",
    );
  }

  const existing = await deps.findOrderByIdempotencyKey(keyResult.value);
  if (existing) {
    return finishReplay(replayOrConflict(existing, input, context), existing);
  }

  const prepared = await prepareOrder(input, deps);
  if (!prepared.ok) {
    operationalLog.error("order.place_failed", {
      stage: "prepare",
      error_code: prepared.error.code,
    });
    return prepared;
  }

  const expected = input.expectedQuoteFingerprint?.trim() ?? "";
  if (expected) {
    const current = buildQuoteFingerprint(prepared.value);
    if (current !== expected) {
      return fail(
        CHECKOUT_ERROR_CODES.CHECKOUT_REVIEW_REQUIRED,
        "El pedido cambió desde la última revisión. Revisá los datos actualizados antes de confirmar.",
        toCheckoutReview(prepared.value),
        "review",
      );
    }
  }

  const trustedPrepared: PreparedOrder = {
    ...prepared.value,
    customerUserId: context.customerUserId ?? null,
  };
  const persisted = await deps.persistPreparedOrder(trustedPrepared);
  if (persisted.status === "created") {
    operationalLog.info("order.place_ok", {
      stage: "persist",
      delivery_type: persisted.order.fulfillmentMethod,
    });
    return ok({
      ...persisted.order,
      replayed: false,
    });
  }
  if (persisted.status === "rejected") {
    operationalLog.error("order.place_failed", {
      stage: "persist",
      error_code: persisted.error.code,
    });
    return err(persisted.error);
  }

  const winner = await deps.findOrderByIdempotencyKey(keyResult.value);
  if (!winner) {
    return fail(
      CHECKOUT_ERROR_CODES.ORDER_PERSISTENCE_FAILED,
      "No se pudo confirmar el pedido.",
      undefined,
      "persist",
    );
  }
  return finishReplay(replayOrConflict(winner, input, context), winner);
}

function finishReplay(
  result: Result<PlacedOrderResult, CheckoutApplicationError>,
  existing: PersistedCheckoutOrder,
): Result<PlacedOrderResult, CheckoutApplicationError> {
  if (result.ok) {
    operationalLog.info("order.place_ok", {
      stage: "replay",
      delivery_type: existing.fulfillmentMethod,
    });
  }
  return result;
}
