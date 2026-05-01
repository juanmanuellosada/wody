import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";

export default async function AdminPlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.isPlatformAdmin) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-edge px-6 py-4 flex items-center gap-6">
        <span className="font-heading font-bold uppercase tracking-[0.15em] text-brand-red text-sm">
          Admin de plataforma
        </span>
        <nav className="flex gap-4">
          <Link
            href="/admin/personal-whitelist"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Whitelist personal
          </Link>
        </nav>
      </header>
      <main className="px-6 py-8 max-w-5xl mx-auto">{children}</main>
    </div>
  );
}
