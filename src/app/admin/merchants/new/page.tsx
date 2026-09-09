import Link from "next/link";
import { loadAdminContext } from "../../_lib/load-admin";
import {
  listCities,
  listZones,
} from "@/infrastructure/db/repositories/geography-repository";
import { MerchantCreateForm } from "../merchant-create-form";

export const dynamic = "force-dynamic";

export default async function NewMerchantPage() {
  await loadAdminContext("/admin/merchants/new");
  const [cities, zones] = await Promise.all([listCities(), listZones()]);

  if (cities.length === 0 || zones.length === 0) {
    return (
      <main className="mx-auto w-full max-w-[94rem] space-y-6">
        <header>
          <Link
            href="/admin/merchants"
            className="inline-flex items-center gap-1 text-sm font-bold text-[#1498cf] transition hover:text-[#083f66]"
          >
            ← Volver a comercios
          </Link>
          <div className="mt-4">
            <p className="mb-1 text-xs font-extrabold tracking-[0.14em] text-[#20aee5] uppercase">
              Incorporación de comercio
            </p>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-[#083f66]">
              Nuevo comercio
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
              Para crear un comercio primero necesitás tener una ciudad y una
              zona operativa configuradas.
            </p>
          </div>
        </header>

        <section className="max-w-2xl rounded-2xl border border-amber-100 bg-white p-6 shadow-[0_8px_30px_rgba(8,63,102,0.05)]">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-lg font-extrabold text-amber-700">
              !
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#083f66]">
                Falta configurar cobertura
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Completá la estructura geográfica y después volvé a este paso.
              </p>
              <Link
                href="/admin/geography"
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#20aee5] px-4 text-sm font-extrabold text-white shadow-[0_8px_22px_rgba(32,174,229,0.2)] transition hover:bg-[#159ed4]"
              >
                Configurar geografía
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[94rem] space-y-6">
      <header>
        <Link
          href="/admin/merchants"
          className="inline-flex items-center gap-1 text-sm font-bold text-[#1498cf] transition hover:text-[#083f66]"
        >
          ← Volver a comercios
        </Link>
        <div className="mt-4">
          <p className="mb-1 text-xs font-extrabold tracking-[0.14em] text-[#20aee5] uppercase">
            Incorporación de comercio
          </p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-[#083f66]">
            Nuevo comercio
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
            Cargá los datos operativos iniciales. El comercio se crea en
            borrador y después podés completar responsables, catálogo y medios
            de pago antes de activarlo.
          </p>
        </div>
      </header>

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.72fr)]">
        <article className="rounded-2xl border border-sky-100/80 bg-white shadow-[0_8px_30px_rgba(8,63,102,0.05)]">
          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <h2 className="text-lg font-extrabold text-[#083f66]">
              Datos iniciales
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Información comercial, ubicación y modalidad de atención.
            </p>
          </div>
          <div className="px-5 py-5 sm:px-6">
            <MerchantCreateForm
              cities={cities.map((city) => ({ id: city.id, name: city.name }))}
              zones={zones.map((zone) => ({
                id: zone.id,
                cityId: zone.cityId,
                name: zone.name,
              }))}
            />
          </div>
        </article>

        <aside className="rounded-2xl border border-sky-100/80 bg-white p-5 shadow-[0_8px_30px_rgba(8,63,102,0.05)] xl:sticky xl:top-6">
          <p className="text-xs font-extrabold tracking-[0.14em] text-[#20aee5] uppercase">
            Próximos pasos
          </p>
          <h2 className="mt-1 text-lg font-extrabold text-[#083f66]">
            Después de crear el comercio
          </h2>
          <ol className="mt-4 grid gap-3">
            {[
              "Invitar al propietario o responsable.",
              "Configurar medios de pago y delivery.",
              "Publicar al menos un producto disponible.",
              "Revisar requisitos y activar el comercio.",
            ].map((step, index) => (
              <li
                key={step}
                className="flex gap-3 rounded-xl bg-slate-50 p-3.5"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-extrabold text-[#1498cf]">
                  {index + 1}
                </span>
                <span className="text-sm font-semibold leading-5 text-slate-600">
                  {step}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs leading-5 text-slate-400">
            El comercio no aparecerá públicamente hasta completar los requisitos
            de activación.
          </p>
        </aside>
      </section>
    </main>
  );
}
