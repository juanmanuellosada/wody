import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { headers } from "next/headers";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/layout/Navbar";
import { InstallPwaButton } from "@/components/InstallPwaButton";
import { NotificationPermissionButton } from "@/components/NotificationPermissionButton";
import { PaymentStatusBanner } from "@/components/PaymentStatusBanner";
import { TrialEndingBanner } from "@/components/billing/TrialEndingBanner";
import { PersonalTrialEndingBanner } from "@/components/billing/PersonalTrialEndingBanner";
import { GymBillingBanner } from "@/components/billing/GymBillingBanner";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { gymPath, hasTeacherWhatsAppContact, isPersonalGym } from "@/lib/gym";
import { gymTerms } from "@/lib/gym-terms";
import { getBlockStatus } from "@/lib/blocking";
import { sendDueReminderIfNeeded } from "@/lib/push";

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

  // Public token-based flows: render bare even if there's an active session.
  // Si un usuario logueado abre el link de invitación o reset, queremos mostrar
  // la página tal cual la verá un visitante anónimo (sin la navbar del gym).
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const subPath = pathname.replace(`/${gymSlug}`, "");
  const isPublicFlow =
    subPath === "/invitarme" || subPath === "/activar" || subPath === "/recuperar" || subPath === "/instalar";

  // Not authenticated, session belongs to a different gym, or public flow page —
  // render children bare (login, gym landing, and public flows handle their own layout).
  if (!session?.user || session.user.gymSlug !== gymSlug || isPublicFlow) {
    return <div style={accentVars}>{children}</div>;
  }

  const { id: userId, name, role, canCreateOwnRoutines, email: sessionEmail, isEmailVerified } = session.user;

  // One DB read covers both: the blocked check (every request) and the
  // student's next payment date used for the status banner.
  // For ADMIN, also fetch the pending join requests count in parallel.
  // For STUDENT, also fetch all gyms this email belongs to (for the gym switcher).
  const [dbUser, pendingJoinRequestsCount, studentGyms] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        blockedAt: true,
        deletedAt: true,
        nextPaymentDate: true,
        role: true,
        paymentExempt: true,
        paymentExemptReason: true,
        trialEndsAt: true,
        mpSubscriptionStatus: true,
      },
    }),
    role === "ADMIN"
      ? prisma.joinRequest.count({ where: { gymId: gym.id, status: "PENDING" } })
      : Promise.resolve(0),
    role === "STUDENT" && sessionEmail
      ? prisma.user.findMany({
          where: { email: sessionEmail, deletedAt: null, role: "STUDENT" },
          select: { gym: { select: { slug: true, name: true, logo: true } } },
        })
      : Promise.resolve([]),
  ]);

  // Flatten into a list of gym descriptors; only pass to Navbar if 2+.
  const switcherGyms = studentGyms
    .map((u) => u.gym)
    .filter((g): g is NonNullable<typeof g> => g !== null);
  const gymSwitcherList = switcherGyms.length >= 2 ? switcherGyms : [];

  if (dbUser) {
    if (dbUser.deletedAt !== null) {
      redirect("/api/auth/kick?next=/");
    }

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

  // Disparar el recordatorio de cuota post-response (no bloquea el render).
  // El helper dedupea por día (User.lastDueNotifiedOn), así que el primer
  // acceso del día del alumno manda la push; el cron de las 12 atrapa a los
  // que no entraron.
  if (role === "STUDENT") {
    after(() => sendDueReminderIfNeeded(userId).catch(() => {}));
  }

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: gymPath(gymSlug, "/login") });
  }

  const personalGym = isPersonalGym(gym.kind);

  // Trial ending banner: only for ADMIN, non-exempt, non-manual, non-authorized, within 7 days of expiry.
  let trialBanner: React.ReactNode = null;
  if (
    role === "ADMIN" &&
    !personalGym &&
    !gym.paymentExempt &&
    !gym.selfManagedBilling &&
    gym.mpSubscriptionStatus !== "authorized" &&
    gym.trialEndsAt !== null
  ) {
    const daysLeft = Math.ceil(
      (gym.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );
    if (daysLeft <= 7) {
      trialBanner = <TrialEndingBanner daysLeft={daysLeft} gymSlug={gymSlug} />;
    }
  }

  // Due-date billing banner: for ADMIN of gyms with a subscriptionNextPaymentDate loaded.
  // Independent of selfManagedBilling — governed by the date itself.
  if (
    role === "ADMIN" &&
    !personalGym &&
    !gym.paymentExempt &&
    gym.subscriptionNextPaymentDate !== null &&
    trialBanner === null
  ) {
    trialBanner = (
      <GymBillingBanner subscriptionNextPaymentDate={gym.subscriptionNextPaymentDate} />
    );
  }

  // Personal trial ending banner: for STUDENT + canCreateOwnRoutines in the personal gym.
  if (
    trialBanner === null &&
    personalGym &&
    role === "STUDENT" &&
    canCreateOwnRoutines &&
    dbUser !== null &&
    !dbUser.paymentExempt &&
    dbUser.mpSubscriptionStatus !== "authorized" &&
    dbUser.trialEndsAt !== null
  ) {
    const daysLeft = Math.ceil(
      (dbUser.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );
    if (daysLeft <= 7) {
      trialBanner = <PersonalTrialEndingBanner daysLeft={daysLeft} />;
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-black" style={accentVars}>
      <Navbar
        userName={name ?? "Usuario"}
        role={role}
        gymSlug={gymSlug}
        gymName={gym.name}
        gymKind={gym.kind}
        onSignOut={handleSignOut}
        terms={gymTerms(gym.kind)}
        canCreateOwnRoutines={canCreateOwnRoutines}
        pendingJoinRequestsCount={pendingJoinRequestsCount}
        gymSwitcherList={gymSwitcherList}
        emailVerified={isEmailVerified}
      />
      {trialBanner}
      <main
        className={[
          "flex-1 max-w-6xl mx-auto w-full px-4 py-8 sm:py-10",
          role === "STUDENT" ? "pb-28 sm:pb-10" : "",
        ].join(" ")}
      >
        {student && !personalGym && (
          <PaymentStatusBanner
            nextPaymentDate={student.nextPaymentDate}
            paymentExempt={student.paymentExempt}
            paymentExemptReason={student.paymentExemptReason}
          />
        )}
        <InstallPwaButton />
        {role === "STUDENT" && <NotificationPermissionButton />}
        {children}
      </main>
      {role === "STUDENT" && !personalGym && hasTeacherWhatsAppContact(gymSlug) && <WhatsAppFab />}
    </div>
  );
}
