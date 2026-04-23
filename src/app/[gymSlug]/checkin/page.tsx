import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";
import { createCheckin } from "@/actions/access";
import { CheckinStatusPoller } from "@/components/access/CheckinStatusPoller";

interface Props {
  params: Promise<{ gymSlug: string }>;
  searchParams: Promise<{ t?: string }>;
}

// Landing del QR del kiosk. El alumno cae acá al scanear. Server-side
// crea el AccessLog (GRANTED o PENDING según esté al día), y después el
// cliente pollea el estado para mostrarle el resultado.
export default async function CheckinPage({ params, searchParams }: Props) {
  const { gymSlug } = await params;
  const { t: token } = await searchParams;

  const gym = await prisma.gym.findUnique({ where: { slug: gymSlug } });
  if (!gym) notFound();

  const session = await auth();
  if (!session?.user) {
    const next = encodeURIComponent(
      gymPath(gymSlug, token ? `/checkin?t=${token}` : "/checkin")
    );
    redirect(gymPath(gymSlug, `/login?next=${next}`));
  }

  if (!token) {
    return (
      <CheckinFallback
        title="Código faltante"
        body="Escaneá el QR del gym desde esta pantalla, no entres por URL."
      />
    );
  }

  let result: Awaited<ReturnType<typeof createCheckin>>;
  try {
    result = await createCheckin(gymSlug, token);
  } catch (err) {
    console.error("createCheckin threw:", err);
    return (
      <CheckinFallback
        title="Error al registrar el ingreso"
        body="Probá de nuevo en unos segundos."
      />
    );
  }

  if (!result.success) {
    return <CheckinFallback title="No pudimos registrar tu ingreso" body={result.error} />;
  }

  const backHref =
    session.user.role === "STUDENT"
      ? gymPath(gymSlug, "/dashboard/athlete")
      : session.user.role === "TEACHER" || session.user.role === "ADMIN"
      ? gymPath(gymSlug, "/dashboard/teacher")
      : gymPath(gymSlug, "/");

  return (
    <CheckinStatusPoller
      logId={result.logId}
      initialState={result.state}
      userName={session.user.name ?? "alumno"}
      backHref={backHref}
    />
  );
}

function CheckinFallback({ title, body }: { title: string; body: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-black">
      <div className="w-full max-w-sm border border-line bg-panel p-8 flex flex-col gap-4 text-center">
        <h1 className="text-lg font-heading font-black uppercase tracking-[0.1em] text-white">
          {title}
        </h1>
        <p className="text-sm text-gray-400 font-body">{body}</p>
      </div>
    </main>
  );
}
