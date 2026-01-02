// app/admin/layout.tsx
import AdminGuard from "./_components/AdminGuard";
import AdminNav from "./_components/AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 text-white">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Admin CMS</h1>
          <AdminNav />
        </div>
        {children}
      </div>
    </AdminGuard>
  );
}
