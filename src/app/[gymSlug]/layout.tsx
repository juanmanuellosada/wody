import { notFound, redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/layout/Navbar";
import { InstallPwaButton } from "@/components/InstallPwaButton";
import { NotificationPermissionButton } from "@/components/NotificationPermissionButton";
import { PaymentStatusBanner } from "@/components/PaymentStatusBanner";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { gymPath } from "@/lib/gym";
import { getBlockStatus } from "@/lib/blocking";

interface GymLayoutProps {
  children: React.ReactNode;
  params: Promise<{ gymSlug: string }>;
}

export default async function GymLayout({ children, params }: GymLayoutProps) {
  const { gymSlug } = await params;

  const gym = await prisma.gym.findUnique({ where: { slug: gymSlug } });
  if (!gym) notFound();

  const session = await auth();

  // Gym bloqueado: nada del /{slug}/* es accesible. Si el usuario tiene sesión
  // de este gym, lo firmamos fuera (la cookie quedaría colgada sino); si no,
  // redirigimos directo a la landing de WODY.
  if (gym.blockedAt) {
    if (session?.user && session.user.gymSlug === gymSlug) {
      redirect("/api/auth/kick?next=/");
    }
    redirect("/");
  }

  const accent = gym.primaryColor ?? "#E31414";
  const accentVars = {
    '--color-red': accent,
    '--color-red-dark': `color-mix(in oklch, ${accent} 80%, black)`,
    '--color-red-hover': `color-mix(in oklch, ${accent} 85%, white)`,
  } as React.CSSProperties;

  // Not authenticated or session belongs to a different gym — render children bare
  // (login page and gym landing handle their own layout)
  if (!session?.user || session.user.gymSlug !== gymSlug) {
    return <div style={accentVars}>{children}</div>;
  }

  const { id: userId, name, role, studentType } = session.user;

  // One DB read covers both: the blocked check (every request) and the
  // student's next payment date used for the status banner.
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { blockedAt: true, nextPaymentDate: true, role: true },
  });

  if (dbUser) {
    const status = getBlockStatus(
      {
        role: dbUser.role,
        blockedAt: dbUser.blockedAt,
        nextPaymentDate: dbUser.nextPaymentDate,
      },
      gym.autoBlockAfterDays
    );
    if (status.blocked) {
      const next = encodeURIComponent(gymPath(gymSlug, "/login?blocked=1"));
      redirect(`/api/auth/kick?next=${next}`);
    }
  }

  const student = role === "STUDENT" ? dbUser : null;

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: gymPath(gymSlug, "/login") });
  }

  return (
    <div className="min-h-screen flex flex-col bg-black" style={accentVars}>
      <Navbar
        userName={name ?? "Usuario"}
        role={role}
        studentType={studentType}
        gymSlug={gymSlug}
        onSignOut={handleSignOut}
      />
      <main
        className={[
          "flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10",
          role === "STUDENT" ? "pb-28 sm:pb-10" : "",
        ].join(" ")}
      >
        {student && (
          <PaymentStatusBanner nextPaymentDate={student.nextPaymentDate} />
        )}
        <InstallPwaButton />
        {role === "STUDENT" && <NotificationPermissionButton />}
        {children}
      </main>
      {role === "STUDENT" && <WhatsAppFab />}
    </div>
  );
}
