"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
import { PublicBrandWordmark } from "@/components/storefront/public-brand-wordmark";

const links = [
  { href: "/admin", label: "Inicio", icon: "home" },
  { href: "/admin/merchants", label: "Comercios", icon: "shop" },
  {
    href: "/admin/merchant-applications",
    label: "Solicitudes",
    icon: "file",
  },
  { href: "/admin/geography", label: "Geografía", icon: "pin" },
] as const;

type IconName = (typeof links)[number]["icon"];

function NavIcon({ name }: { name: IconName }) {
  if (name === "home") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          d="M3.5 10.5 12 3l8.5 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-5v-6h-4v6H5a1.5 1.5 0 0 1-1.5-1.5v-9Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (name === "shop") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          d="M4 9.5h16l-1.4-5H5.4L4 9.5Zm1 0v9.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M8.5 20v-6h7v6M3.5 9.5c0 1.5 1.1 2.5 2.5 2.5s2.5-1 2.5-2.5c0 1.5 1.1 2.5 2.5 2.5s2.5-1 2.5-2.5c0 1.5 1.1 2.5 2.5 2.5s2.5-1 2.5-2.5c0 1.5 1.1 2.5 2.5 2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (name === "file") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Zm7 .5v4h4M9 12h6M9 16h6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/admin") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname() ?? "/admin";

  const navItems = links.map((link) => {
    const active = isActivePath(pathname, link.href);
    return (
      <Link
        key={link.href}
        href={link.href}
        aria-current={active ? "page" : undefined}
        className={[
          "flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition",
          active
            ? "bg-[#20aee5] text-white shadow-[0_8px_24px_rgba(32,174,229,0.28)]"
            : "text-white/78 hover:bg-white/8 hover:text-white",
        ].join(" ")}
      >
        <NavIcon name={link.icon} />
        <span>{link.label}</span>
      </Link>
    );
  });

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh flex-col bg-[#083f66] px-4 py-5 text-white lg:flex">
        <Link href="/admin" className="mb-8 flex items-center px-2">
          <PublicBrandWordmark
            size="header"
            surface="dark"
            className="max-w-[9.5rem]"
          />
        </Link>

        <p className="mb-2 px-3 text-[0.68rem] font-bold tracking-[0.16em] text-white/45 uppercase">
          Administración
        </p>
        <nav className="flex flex-col gap-1.5" aria-label="Administración">
          {navItems}
        </nav>

        <div className="mt-auto border-t border-white/12 pt-5">
          <div className="mb-4 flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-sm font-extrabold">
              AD
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Administrador</p>
              <p className="text-xs text-white/55">Panel de gestión</p>
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex min-h-10 w-full items-center rounded-xl px-3 text-sm font-semibold text-white/70 transition hover:bg-white/8 hover:text-white"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <header className="border-b border-sky-100 bg-[#083f66] px-4 py-3 text-white lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <Link href="/admin" className="shrink-0">
            <PublicBrandWordmark size="compact" surface="dark" />
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="text-xs font-semibold text-white/75">
              Salir
            </button>
          </form>
        </div>
        <nav
          className="mt-3 flex gap-2 overflow-x-auto pb-1"
          aria-label="Administración"
        >
          {navItems}
        </nav>
      </header>
    </>
  );
}
