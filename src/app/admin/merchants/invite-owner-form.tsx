"use client";

import { useActionState } from "react";
import { inviteOwnerAction } from "../actions";
import { initialActionState } from "../action-state";

type InviteOwnerFormProps = {
  merchantId: string;
};

export function InviteOwnerForm({ merchantId }: InviteOwnerFormProps) {
  const [state, formAction, pending] = useActionState(
    inviteOwnerAction,
    initialActionState,
  );

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="merchantId" value={merchantId} />
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-bold text-[#083f66]">Email del propietario</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="nombre@correo.com"
          className="min-h-11 rounded-xl border border-sky-100 bg-white px-3.5 text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-[#20aee5] focus:ring-2 focus:ring-sky-100"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-bold text-[#083f66]">
          Nombre para mostrar
          <span className="ml-1 font-medium text-slate-400">(opcional)</span>
        </span>
        <input
          name="displayName"
          placeholder="Ej. María Pérez"
          className="min-h-11 rounded-xl border border-sky-100 bg-white px-3.5 text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-[#20aee5] focus:ring-2 focus:ring-sky-100"
        />
      </label>
      {state.error ? (
        <p
          className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 sm:col-span-2"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p
          className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 sm:col-span-2"
          role="status"
        >
          {state.success}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#20aee5] px-4 text-sm font-extrabold text-white shadow-[0_8px_22px_rgba(32,174,229,0.2)] transition hover:bg-[#159ed4] disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2 sm:justify-self-start"
      >
        {pending ? "Invitando…" : "Invitar propietario"}
      </button>
    </form>
  );
}
