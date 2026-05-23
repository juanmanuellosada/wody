import { listPersonalUsers } from "@/actions/super-admin/personal-users";
import { PersonalUsersTable } from "@/components/admin/PersonalUsersTable";

export const dynamic = "force-dynamic";

export default async function WodyPersonalPage() {
  const users = await listPersonalUsers();

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="border border-line bg-panel p-6">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
          Super Admin
        </p>
        <h1 className="text-2xl font-heading font-black uppercase tracking-[0.1em] text-white">
          Wody Personal
        </h1>
        <p className="text-xs text-gray-500 font-body mt-1">
          {users.length} usuario(s)
        </p>
      </div>

      {/* Table */}
      <section>
        <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-gray-400 mb-4">
          Usuarios
        </h2>
        <PersonalUsersTable users={users} />
      </section>
    </div>
  );
}
