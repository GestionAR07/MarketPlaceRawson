"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { approveMerchantApplicationAction } from "./actions";
import type { ApproveMerchantApplicationActionState } from "../action-state";

type ApplicationApproveFormProps = {
  applicationId: string;
  defaultSlug: string;
};

const initial: ApproveMerchantApplicationActionState = {
  error: null,
  success: null,
};

export function ApplicationApproveForm({
  applicationId,
  defaultSlug,
}: ApplicationApproveFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    approveMerchantApplicationAction,
    initial,
  );

  useEffect(() => {
    if (state.merchantId) {
      router.push(`/admin/merchants/${state.merchantId}`);
      router.refresh();
    }
  }, [state.merchantId, router]);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="applicationId" value={applicationId} />

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-bold text-[#083f66]">Identificador público</span>
        <input
          name="slug"
          required
          defaultValue={defaultSlug}
          placeholder="mi-comercio"
          className="min-h-11 rounded-xl border border-sky-100 bg-white px-3.5 text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-[#20aee5] focus:ring-2 focus:ring-sky-100"
        />
      </label>

      <div className="grid gap-2 rounded-2xl bg-slate-50 p-3.5">
        <label className="flex items-center gap-3 text-sm font-semibold text-slate-600">
          <input
            type="checkbox"
            name="pickupEnabled"
            defaultChecked
            className="h-4 w-4 accent-[#20aee5]"
          />
          <span>Habilitar retiro en el comercio</span>
        </label>

        <label className="flex items-center gap-3 text-sm font-semibold text-slate-600">
          <input
            type="checkbox"
            name="merchantDeliveryEnabled"
            className="h-4 w-4 accent-[#20aee5]"
          />
          <span>Habilitar delivery propio</span>
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-bold text-[#083f66]">
          Preparación estimada
        </span>
        <div className="relative">
          <input
            type="number"
            name="preparationMinutes"
            min={0}
            max={1440}
            defaultValue={30}
            required
            className="min-h-11 w-full rounded-xl border border-sky-100 bg-white px-3.5 pr-20 text-slate-700 outline-none transition focus:border-[#20aee5] focus:ring-2 focus:ring-sky-100"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold text-slate-400">
            minutos
          </span>
        </div>
      </label>

      {state.error ? (
        <p
          className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#20aee5] px-4 text-sm font-extrabold text-white shadow-[0_8px_22px_rgba(32,174,229,0.2)] transition hover:bg-[#159ed4] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Aprobando…" : "Aprobar y crear comercio"}
      </button>
    </form>
  );
}
