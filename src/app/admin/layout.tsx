import { AdminNav } from "./_components/admin-nav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[#f4f8fb] text-[#12324a] lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <AdminNav />
      <div className="min-w-0 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8 xl:px-10">
        {children}
      </div>
    </div>
  );
}
