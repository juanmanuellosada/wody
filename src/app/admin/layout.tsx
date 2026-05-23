import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { AdminNav } from "@/components/admin/AdminNav";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await auth();

  if (!session?.user || session.user.role !== "SUPERADMIN") {
    redirect("/");
  }

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      <AdminNav userName={session.user.name ?? "Admin"} onSignOut={handleSignOut} />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {children}
      </main>
    </div>
  );
}
