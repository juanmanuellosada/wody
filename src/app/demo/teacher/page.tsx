import type { Metadata } from "next";
import { WodManagerClient } from "@/components/wod/WodManagerClient";
import { GroupManager } from "@/components/group/GroupManager";
import type { WodTargetType } from "@prisma/client";

export const metadata: Metadata = {
  title: "WODY — Demo Profe",
};

const today = new Date();
const yesterday = new Date(today.getTime() - 86400000);
const twoDaysAgo = new Date(today.getTime() - 86400000 * 2);
const threeDaysAgo = new Date(today.getTime() - 86400000 * 3);

const mockGroups = [
  {
    id: "g1",
    name: "CrossFit Avanzado",
    students: [
      { id: "s1", name: "Juan Pérez" },
      { id: "s2", name: "María García" },
      { id: "s3", name: "Lucas Rodríguez" },
    ],
  },
  {
    id: "g2",
    name: "Funcional Mañana",
    students: [
      { id: "s4", name: "Sofía López" },
      { id: "s5", name: "Tomás Fernández" },
    ],
  },
];

const mockUngrouped = [
  { id: "s6", name: "Valentina Martínez" },
];

const mockWods = [
  {
    id: "w1",
    title: "WOD",
    content: "## Warm Up\n3 rondas:\n- 10 air squats\n- 10 push-ups\n- 200m run\n\n## Strength\nBack Squat 5x5 @75%\n\n## MetCon\nAMRAP 12'\n- 12 Wall Balls (20/14)\n- 9 Box Jumps (24/20)\n- 6 Pull-ups",
    date: today,
    targetType: "ALL" as WodTargetType,
    targetGroupId: null,
    targetStudentId: null,
    targetGroupName: null,
    targetStudentName: null,
  },
  {
    id: "w2",
    title: "Rutina Fuerza",
    content: "## Fuerza\nDeadlift 5-5-3-3-1-1\n\n## Accessory\n3 rondas:\n- 12 Romanian DL\n- 15 Hip Thrust\n- 20 Glute Bridge",
    date: yesterday,
    targetType: "GROUP" as WodTargetType,
    targetGroupId: "g1",
    targetStudentId: null,
    targetGroupName: "CrossFit Avanzado",
    targetStudentName: null,
  },
  {
    id: "w3",
    title: "Cardio + Core",
    content: "## EMOM 20'\nMin 1: 15 cal Row\nMin 2: 12 T2B\nMin 3: 10 Burpees\nMin 4: Rest",
    date: yesterday,
    targetType: "GROUP" as WodTargetType,
    targetGroupId: "g2",
    targetStudentId: null,
    targetGroupName: "Funcional Mañana",
    targetStudentName: null,
  },
  {
    id: "w4",
    title: "Recuperación Activa",
    content: "## Movilidad\n- 2' Foam Rolling piernas\n- 2' Foam Rolling espalda\n\n## Yoga Flow\n15' Sun Salutations + Pigeon Pose\n\n## Cardio Suave\n20' bici estática zona 2",
    date: twoDaysAgo,
    targetType: "STUDENT" as WodTargetType,
    targetGroupId: null,
    targetStudentId: "s1",
    targetGroupName: null,
    targetStudentName: "Juan Pérez",
  },
  {
    id: "w5",
    title: "WOD",
    content: "## Warm Up\n400m Run + movilidad\n\n## OLY\nClean & Jerk — build to heavy single\n\n## For Time\n21-15-9\n- Thrusters (43/30)\n- Pull-ups",
    date: threeDaysAgo,
    targetType: "ALL" as WodTargetType,
    targetGroupId: null,
    targetStudentId: null,
    targetGroupName: null,
    targetStudentName: null,
  },
];

const mockStudents = [
  { id: "s1", name: "Juan Pérez" },
  { id: "s2", name: "María García" },
  { id: "s3", name: "Lucas Rodríguez" },
  { id: "s4", name: "Sofía López" },
  { id: "s5", name: "Tomás Fernández" },
  { id: "s6", name: "Valentina Martínez" },
];

const mockGroupOptions = [
  { id: "g1", name: "CrossFit Avanzado" },
  { id: "g2", name: "Funcional Mañana" },
];

export default function DemoTeacherPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        {/* Welcome header */}
        <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-[#E31414] mb-1">
                Dashboard Profe
              </p>
              <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
                Hola, Carlos
              </h1>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-3xl font-heading font-black text-[#E31414]">{mockWods.length}</p>
                <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-600">
                  WODs
                </p>
              </div>
              <div className="w-px bg-[#1A1A1A]" aria-hidden="true" />
              <div className="text-center">
                <p className="text-3xl font-heading font-black text-white">{mockGroups.length}</p>
                <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-600">
                  Grupos
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Group manager */}
        <GroupManager
          groups={mockGroups}
          ungroupedStudents={mockUngrouped}
          demo
        />

        {/* WOD manager */}
        <WodManagerClient
          wods={mockWods}
          groups={mockGroupOptions}
          students={mockStudents}
          demo
        />
      </div>
    </main>
  );
}
