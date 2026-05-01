import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listWhitelist } from "@/actions/personal-whitelist";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { AddWhitelistForm } from "./AddWhitelistForm";
import { RemoveWhitelistButton } from "./RemoveWhitelistButton";

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

export default async function PersonalWhitelistPage() {
  const session = await auth();
  if (!session?.user?.isPlatformAdmin) {
    redirect("/");
  }

  const entries = await listWhitelist();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-heading font-bold uppercase tracking-[0.15em] text-white">
        Whitelist de acceso personal
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Agregar email</CardTitle>
        </CardHeader>
        <CardBody>
          <AddWhitelistForm />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Emails autorizados ({entries.length})</CardTitle>
        </CardHeader>
        <CardBody>
          {entries.length === 0 ? (
            <p className="text-sm text-gray-500">No hay emails en la whitelist todavía.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-edge text-gray-400 text-xs font-heading uppercase tracking-[0.1em]">
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2 pr-4">Nota</th>
                    <th className="pb-2 pr-4">Creado</th>
                    <th className="pb-2 pr-4">Consumido</th>
                    <th className="pb-2 pr-4">Creado por</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-edge/50 last:border-0">
                      <td className="py-3 pr-4 text-white font-mono text-xs">{entry.email}</td>
                      <td className="py-3 pr-4 text-gray-400">{entry.note ?? "—"}</td>
                      <td className="py-3 pr-4 text-gray-400 whitespace-nowrap">
                        {formatDate(entry.createdAt)}
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        {entry.consumedAt ? (
                          <span className="text-green-400">{formatDate(entry.consumedAt)}</span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-gray-400">
                        {entry.createdBy?.name ?? "—"}
                      </td>
                      <td className="py-3">
                        <RemoveWhitelistButton email={entry.email} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
