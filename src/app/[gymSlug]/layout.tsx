import { notFound } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/layout/Navbar";
import { InstallPwaButton } from "@/components/InstallPwaButton";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { gymPath } from "@/lib/gym";

interface GymLayoutProps {
  children: React.ReactNode;
  params: Promise<{ gymSlug: string }>;
}

export default async function GymLayout({ children, params }: GymLayoutProps) {
  const { gymSlug } = await params;

  const gym = await prisma.gym.findUnique({ where: { slug: gymSlug } });
  if (!gym) notFound();

  const session = await auth();

  // Not authenticated — render children bare (login page, gym landing handle their own layout)
  if (!session?.user) {
    return <>{children}</>;
  }

  const { name, role, studentType } = session.user;

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: gymPath(gymSlug, "/login") });
  }

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <Navbar
        userName={name ?? "Usuario"}
        role={role}
        studentType={studentType}
        gymSlug={gymSlug}
        onSignOut={handleSignOut}
      />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
        <InstallPwaButton />
        {children}
      </main>
      {role === "STUDENT" && <WhatsAppFab />}
    </div>
  );
}
