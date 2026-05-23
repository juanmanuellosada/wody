import { listWhitelist } from "@/actions/super-admin/personal-whitelist";
import { WhitelistManager } from "@/components/admin/WhitelistManager";

export const dynamic = "force-dynamic";

export default async function AdminWhitelistPage() {
  const entries = await listWhitelist();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
          Super Admin
        </p>
        <h1 className="text-2xl font-heading font-black uppercase tracking-[0.1em] text-white">
          Whitelist — Modo Personal
        </h1>
        <p className="text-xs text-gray-500 font-body mt-1">
          {entries.length} entrada(s) · {entries.filter((e) => e.consumedAt !== null).length} consumida(s)
        </p>
      </div>

      <WhitelistManager entries={entries} />
    </div>
  );
}
