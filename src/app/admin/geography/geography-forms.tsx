"use client";

import { useActionState } from "react";
import {
  createCityAction,
  createProvinceAction,
  createZoneAction,
} from "../actions";
import { initialActionState } from "../action-state";

type ProvinceOption = { id: string; name: string; code: string };
type CityOption = { id: string; name: string; provinceId: string };

type GeographyFormsProps = {
  provinces: ProvinceOption[];
  cities: CityOption[];
};

const inputClass =
  "min-h-11 rounded-xl border border-sky-100 bg-white px-3.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-[#20aee5] focus:ring-2 focus:ring-[#20aee5]/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

function Feedback({
  error,
  success,
}: {
  error: string | null;
  success: string | null;
}) {
  if (error) {
    return (
      <p
        className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700"
        role="alert"
      >
        {error}
      </p>
    );
  }
  if (success) {
    return (
      <p
        className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"
        role="status"
      >
        {success}
      </p>
    );
  }
  return null;
}

function FormHeading({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sm font-extrabold text-[#1498cf]">
        {step}
      </div>
      <div>
        <h2 className="text-lg font-extrabold text-[#083f66]">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

export function GeographyForms({ provinces, cities }: GeographyFormsProps) {
  const [provinceState, provinceAction, provincePending] = useActionState(
    createProvinceAction,
    initialActionState,
  );
  const [cityState, cityAction, cityPending] = useActionState(
    createCityAction,
    initialActionState,
  );
  const [zoneState, zoneAction, zonePending] = useActionState(
    createZoneAction,
    initialActionState,
  );

  return (
    <div className="grid min-w-0 gap-5">
      <section className="rounded-2xl border border-sky-100/80 bg-white p-5 shadow-[0_8px_30px_rgba(8,63,102,0.05)] sm:p-6">
        <FormHeading
          step="1"
          title="Nueva provincia"
          description="Creá la provincia base que contendrá las ciudades y zonas de operación."
        />
        <form action={provinceAction} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-bold text-slate-600">Nombre</span>
            <input
              name="name"
              required
              placeholder="Ej. Chubut"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-bold text-slate-600">Código</span>
            <input
              name="code"
              required
              placeholder="AR-U"
              className={inputClass}
            />
          </label>
          <div className="sm:col-span-2">
            <Feedback
              error={provinceState.error}
              success={provinceState.success}
            />
          </div>
          <button
            type="submit"
            disabled={provincePending}
            className="min-h-11 rounded-xl bg-[#20aee5] px-4 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(32,174,229,0.18)] transition hover:bg-[#159ed4] disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
          >
            {provincePending ? "Guardando…" : "Crear provincia"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-sky-100/80 bg-white p-5 shadow-[0_8px_30px_rgba(8,63,102,0.05)] sm:p-6">
        <FormHeading
          step="2"
          title="Nueva ciudad"
          description="Agregá una ciudad dentro de una provincia ya configurada."
        />
        <form action={cityAction} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="font-bold text-slate-600">Provincia</span>
            <select
              name="provinceId"
              required
              disabled={provinces.length === 0}
              className={inputClass}
            >
              {provinces.length === 0 ? (
                <option value="">Creá una provincia primero</option>
              ) : (
                provinces.map((province) => (
                  <option key={province.id} value={province.id}>
                    {province.name} ({province.code})
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-bold text-slate-600">Nombre</span>
            <input
              name="name"
              required
              placeholder="Ej. Rawson"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-bold text-slate-600">Identificador</span>
            <input
              name="slug"
              required
              placeholder="rawson"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="font-bold text-slate-600">Zona horaria</span>
            <input
              name="timezone"
              required
              placeholder="America/Argentina/Catamarca"
              defaultValue="America/Argentina/Catamarca"
              className={inputClass}
            />
            <span className="text-xs text-slate-400">
              Se usa para horarios de apertura y operación de los comercios.
            </span>
          </label>
          <div className="sm:col-span-2">
            <Feedback error={cityState.error} success={cityState.success} />
          </div>
          <button
            type="submit"
            disabled={cityPending || provinces.length === 0}
            className="min-h-11 rounded-xl bg-[#20aee5] px-4 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(32,174,229,0.18)] transition hover:bg-[#159ed4] disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
          >
            {cityPending ? "Guardando…" : "Crear ciudad"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-sky-100/80 bg-white p-5 shadow-[0_8px_30px_rgba(8,63,102,0.05)] sm:p-6">
        <FormHeading
          step="3"
          title="Nueva zona"
          description="Definí el área concreta que podrán seleccionar comercios y clientes."
        />
        <form action={zoneAction} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="font-bold text-slate-600">Ciudad</span>
            <select
              name="cityId"
              required
              disabled={cities.length === 0}
              className={inputClass}
            >
              {cities.length === 0 ? (
                <option value="">Creá una ciudad primero</option>
              ) : (
                cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-bold text-slate-600">Nombre</span>
            <input
              name="name"
              required
              placeholder="Ej. Playa Unión"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-bold text-slate-600">Identificador</span>
            <input
              name="slug"
              required
              placeholder="playa-union"
              className={inputClass}
            />
          </label>
          <div className="sm:col-span-2">
            <Feedback error={zoneState.error} success={zoneState.success} />
          </div>
          <button
            type="submit"
            disabled={zonePending || cities.length === 0}
            className="min-h-11 rounded-xl bg-[#20aee5] px-4 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(32,174,229,0.18)] transition hover:bg-[#159ed4] disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
          >
            {zonePending ? "Guardando…" : "Crear zona"}
          </button>
        </form>
      </section>
    </div>
  );
}
