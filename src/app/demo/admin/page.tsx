import type { Metadata } from "next";
import { DemoNavbar } from "@/components/DemoNavbar";
import { GroupManager } from "@/components/group/GroupManager";
import { EditStudentButton } from "@/components/EditStudentButton";
import { ToggleStudentTypeButton } from "@/components/ToggleStudentTypeButton";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "WODY — Demo Admin",
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  TEACHER: "Profe",
  STUDENT: "Alumno",
};

const mockUsers = [
  { id: "a1", name: "Martín Demo", email: "martin@demo.com", role: "ADMIN", studentType: "PERSONALIZED", createdAt: "15 mar 2025" },
  { id: "t1", name: "Carlos Entrenador", email: "carlos@demo.com", role: "TEACHER", studentType: "PERSONALIZED", createdAt: "20 mar 2025" },
  { id: "t2", name: "Ana Coach", email: "ana@demo.com", role: "TEACHER", studentType: "PERSONALIZED", createdAt: "22 mar 2025" },
  { id: "s1", name: "Juan Pérez", email: "juan@demo.com", role: "STUDENT", studentType: "PERSONALIZED", createdAt: "1 abr 2025" },
  { id: "s2", name: "María García", email: "maria@demo.com", role: "STUDENT", studentType: "PERSONALIZED", createdAt: "1 abr 2025" },
  { id: "s3", name: "Lucas Rodríguez", email: "lucas@demo.com", role: "STUDENT", studentType: "PERSONALIZED", createdAt: "5 abr 2025" },
  { id: "s4", name: "Sofía López", email: "sofia@demo.com", role: "STUDENT", studentType: "GENERAL", createdAt: "8 abr 2025" },
  { id: "s5", name: "Tomás Fernández", email: "tomas@demo.com", role: "STUDENT", studentType: "PERSONALIZED", createdAt: "10 abr 2025" },
];

const mockGroups = [
  {
    id: "g1",
    name: "CrossFit Avanzado",
    teacherName: "Carlos Entrenador",
    students: [
      { id: "s1", name: "Juan Pérez" },
      { id: "s2", name: "María García" },
    ],
  },
  {
    id: "g2",
    name: "Funcional Mañana",
    teacherName: "Carlos Entrenador",
    students: [
      { id: "s3", name: "Lucas Rodríguez" },
    ],
  },
  {
    id: "g3",
    name: "Fuerza",
    teacherName: "Ana Coach",
    students: [
      { id: "s5", name: "Tomás Fernández" },
    ],
  },
];

const teacherGroupMap = new Map<string, typeof mockGroups>();
for (const g of mockGroups) {
  const existing = teacherGroupMap.get(g.teacherName) ?? [];
  existing.push(g);
  teacherGroupMap.set(g.teacherName, existing);
}

export default function DemoAdminPage() {
  const totalTeachers = mockUsers.filter((u) => u.role === "TEACHER").length;
  const totalStudents = mockUsers.filter((u) => u.role === "STUDENT").length;

  return (
    <>
      <DemoNavbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10 flex flex-col gap-10">
        {/* Welcome banner */}
        <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-[#E31414] mb-1">
                Panel de Control
              </p>
              <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
                Hola, Martín
              </h1>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-2xl font-heading font-black text-white">{totalTeachers}</p>
                <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-600">Profes</p>
              </div>
              <div className="w-px bg-[#1A1A1A]" aria-hidden="true" />
              <div className="text-center">
                <p className="text-2xl font-heading font-black text-[#E31414]">{totalStudents}</p>
                <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-600">Alumnos</p>
              </div>
              <div className="w-px bg-[#1A1A1A]" aria-hidden="true" />
              <div className="text-center">
                <p className="text-2xl font-heading font-black text-white">{mockUsers.length}</p>
                <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-600">Total</p>
              </div>
            </div>
          </div>
        </div>

        {/* Create user + Assign students — grid (disabled) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="border border-[#1A1A1A] bg-[#0A0A0A]">
            <div className="px-5 py-3 border-b border-[#1A1A1A] flex items-center gap-3">
              <span className="w-2 h-2 bg-[#E31414] flex-shrink-0" aria-hidden="true" />
              <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
                Crear Usuario
              </h2>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <input disabled placeholder="Nombre" className="w-full bg-[#1A1A1A] border border-[#2A2A2A] text-gray-600 text-sm font-body px-3 py-2 cursor-not-allowed" />
              <input disabled placeholder="Email" className="w-full bg-[#1A1A1A] border border-[#2A2A2A] text-gray-600 text-sm font-body px-3 py-2 cursor-not-allowed" />
              <input disabled placeholder="Contraseña" type="password" className="w-full bg-[#1A1A1A] border border-[#2A2A2A] text-gray-600 text-sm font-body px-3 py-2 cursor-not-allowed" />
              <div className="flex gap-3">
                <select disabled className="flex-1 bg-[#1A1A1A] border border-[#2A2A2A] text-gray-600 text-sm font-body px-3 py-2 cursor-not-allowed">
                  <option>Profe</option>
                </select>
                <Button variant="primary" size="sm" disabled>Crear</Button>
              </div>
            </div>
          </section>

          <section className="border border-[#1A1A1A] bg-[#0A0A0A]">
            <div className="px-5 py-3 border-b border-[#1A1A1A] flex items-center gap-3">
              <span className="w-2 h-2 bg-[#E31414] flex-shrink-0" aria-hidden="true" />
              <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
                Asignaciones
              </h2>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <select disabled className="w-full bg-[#1A1A1A] border border-[#2A2A2A] text-gray-600 text-sm font-body px-3 py-2 cursor-not-allowed">
                <option>Carlos Entrenador</option>
              </select>
              <select disabled className="w-full bg-[#1A1A1A] border border-[#2A2A2A] text-gray-600 text-sm font-body px-3 py-2 cursor-not-allowed">
                <option>Juan Pérez</option>
              </select>
              <Button variant="primary" size="sm" disabled>Asignar</Button>
            </div>
          </section>
        </div>

        {/* Groups by teacher */}
        {Array.from(teacherGroupMap.entries()).map(([teacherName, groups]) => (
          <section key={teacherName}>
            <div className="flex items-center gap-4 mb-3">
              <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
                Grupos de {teacherName}
              </h2>
              <div className="flex-1 h-px bg-[#1A1A1A]" aria-hidden="true" />
            </div>
            <GroupManager
              groups={groups}
              ungroupedStudents={[]}
              hideCreate
              demo
            />
          </section>
        ))}

        {/* User list */}
        <section>
          <div className="flex items-center gap-4 mb-5">
            <h2 className="text-lg font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
              Usuarios
            </h2>
            <span className="text-xs font-heading font-bold text-[#E31414] bg-[#E31414]/10 px-2 py-0.5">
              {mockUsers.length}
            </span>
            <div className="flex-1 h-px bg-[#1A1A1A]" aria-hidden="true" />
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto border border-[#1A1A1A]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0A0A0A]">
                  {["Nombre", "Email", "Rol", "Tipo", "Alta", ""].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 px-4 py-3 border-b border-[#1A1A1A]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mockUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-[#1A1A1A] hover:bg-[#0D0D0D] transition-colors duration-200 group"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center flex-shrink-0 group-hover:border-[#E31414]/30 transition-colors duration-200">
                          <span className="text-xs font-heading font-bold text-gray-500">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-white font-heading font-bold">
                          {user.name}
                          {user.id === "a1" && (
                            <span className="ml-2 text-[#E31414] text-xs">(vos)</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-400 font-body">{user.email}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={[
                          "text-xs font-heading font-bold uppercase tracking-[0.15em] px-2.5 py-1 inline-block",
                          user.role === "ADMIN"
                            ? "bg-[#E31414]/15 text-[#E31414] border border-[#E31414]/20"
                            : user.role === "TEACHER"
                            ? "bg-white/5 text-white border border-white/10"
                            : "bg-[#1A1A1A] text-gray-400 border border-[#2A2A2A]",
                        ].join(" ")}
                      >
                        {ROLE_LABEL[user.role] ?? user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {user.role === "STUDENT" ? (
                        <ToggleStudentTypeButton
                          userId={user.id}
                          currentType={user.studentType as "GENERAL" | "PERSONALIZED"}
                          demo
                        />
                      ) : (
                        <span className="text-xs text-gray-700 font-heading">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 text-xs font-heading">
                      {user.createdAt}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-1">
                        {user.role === "STUDENT" && (
                          <EditStudentButton
                            studentId={user.id}
                            name={user.name}
                            email={user.email}
                            assignedTeachers={[]}
                            allTeachers={[]}
                            demo
                          />
                        )}
                        <Button variant="danger" size="sm" disabled>Eliminar</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden flex flex-col gap-3">
            {mockUsers.map((user) => (
              <Card key={user.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 bg-[#0A0A0A] border border-[#2A2A2A] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-heading font-bold text-gray-500">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <p className="text-white font-heading font-bold text-sm truncate">
                        {user.name}
                      </p>
                      <p className="text-gray-500 text-xs font-body truncate">{user.email}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span
                          className={[
                            "text-xs font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5",
                            user.role === "ADMIN"
                              ? "bg-[#E31414]/15 text-[#E31414] border border-[#E31414]/20"
                              : user.role === "TEACHER"
                              ? "bg-white/5 text-white border border-white/10"
                              : "bg-[#1A1A1A] text-gray-400 border border-[#2A2A2A]",
                          ].join(" ")}
                        >
                          {ROLE_LABEL[user.role] ?? user.role}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {user.role === "STUDENT" && (
                      <EditStudentButton studentId={user.id} name={user.name} email={user.email} assignedTeachers={[]} allTeachers={[]} demo />
                    )}
                    <Button variant="danger" size="sm" disabled>Eliminar</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
