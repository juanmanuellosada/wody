import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { WhitelistForm } from "@/components/admin/WhitelistForm";

export const dynamic = "force-dynamic";

export default async function SignupRequestNewPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPERADMIN") {
    redirect("/");
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
          <Link href="/admin/signup-requests" className="hover:underline">
            Leads
          </Link>
          {" / "}Agregar whitelist
        </p>
        <h1 className="text-2xl font-heading font-black uppercase tracking-[0.1em] text-white">
          Agregar whitelist
        </h1>
        <p className="text-xs text-gray-500 font-body mt-1">
          Crea una solicitud aprobada directamente — útil si ya hablaste con el dueño por otro canal.
        </p>
      </div>

      <WhitelistForm />
    </div>
  );
}
