"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RmsView } from "@/components/RmsView";
import { FixedRoutineManagerView } from "@/components/fixed-routine/FixedRoutineManagerView";
import { FixedRoutineStudentView } from "@/components/fixed-routine/FixedRoutineStudentView";
import { GroupManagerView } from "@/components/group/GroupManagerView";
import { ShareWodButton } from "@/components/wod/ShareWodButton";
import { StudentWodDetailView } from "@/components/wod/StudentWodDetailView";
import { WodCard } from "@/components/wod/WodCard";
import { WodHistory } from "@/components/wod/WodHistory";
import { WodManagerView } from "@/components/wod/WodManagerView";
import { gymTerms } from "@/lib/gym-terms";
import { defaultGymFixedRenewAt } from "./gym-demo-view-model";
import { mapGymRms, mapGymWods, projectGymFixedStudentRoutineSafe } from "./gym-demo-view-model";
import { projectGymFixedAssignmentContext, projectGymFixedRenewals } from "@/components/demo/training/gym-fixed-demo-state";
import { projectGymTrainingViews } from "@/components/demo/training/gym-training-demo-state";
import type { GymFixedDemoAssignmentContext, GymFixedDemoRenewalDto } from "@/components/demo/training/gym-fixed-demo-types";
import type { GymTrainingProjection } from "@/components/demo/training/gym-training-demo-types";
import { getGymDemoActorToken, getGymDemoProfile } from "@/components/demo/scenarios/gym-demo-directory";
import { defaultActorId, useDemoGym, type DemoGymScreenRole } from "./DemoGymProvider";
import { useDemoGymProfile } from "./DemoGymProfileProvider";

export type DemoGymTrainingScreen = "staff" | "rms" | "student" | "student-wod";
type Props = { routeKey: string; routeRole: DemoGymScreenRole; routeActorId: string; screen: DemoGymTrainingScreen };
const terms = gymTerms("GYM");
const gymName = "Gimnasio de demostración";
const gymSlug = "demo-gym-training";

/** GYM route shell: the route declares a role default, while same-role navigation keeps the chosen persona. */
export function SharedDemoGymTrainingRoute({ routeKey, routeRole, routeActorId, screen }: Props) {
  const gym = useDemoGym();
  const initialized = useRef(new Set<string>());
  const [selectedWodId, setSelectedWodId] = useState<string | null>(null);

  useEffect(() => {
    if (!gym.ready || initialized.current.has(routeKey)) return;
    initialized.current.add(routeKey);
    // The provider only changes identity when this route crosses a role boundary.
    if (gym.selectedActor.role !== routeRole) gym.selectActor(routeRole, routeActorId || defaultActorId(routeRole));
  }, [gym, routeActorId, routeKey, routeRole]);

  const actor = gym.selectedActor;

  if (!gym.ready || actor.role !== routeRole) return <Loading />;
  if (!gym.trainingCallbacks && (screen === "staff")) return <Loading />;
  if (!gym.rmCallbacks && screen === "rms") return <Loading />;

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10 flex flex-col gap-8">
      {gym.warning && <p role="status" className="border border-brand-red/40 bg-brand-red/10 p-3 text-sm font-body text-gray-200">{gym.warning}</p>}
      <PersonaSelector
        role={routeRole}
        selectedId={actor.id}
        onSelect={(actorId) => { setSelectedWodId(null); gym.selectActor(routeRole, actorId); }}
      />
      {screen === "staff" && <StaffScreen />}
      {screen === "rms" && <RmsScreen />}
      {screen === "student" && <StudentScreen selectedWodId={selectedWodId} setSelectedWodId={setSelectedWodId} />}
      {screen === "student-wod" && <StudentDetail selectedWodId={selectedWodId} />}
    </main>
  );
}

function PersonaSelector({ role, selectedId, onSelect }: { role: DemoGymScreenRole; selectedId: string; onSelect: (actorId: string) => void }) {
  const { actorsForRole } = useDemoGym();
  const nameOverrides = useGymNameOverrides();
  const people = actorsForRole(role);
  return (
    <label className="self-start text-xs font-heading font-bold uppercase tracking-[0.12em] text-gray-500">
      Persona de demostración
      <select value={selectedId} onChange={(event) => onSelect(event.target.value)} className="ml-3 bg-panel border border-edge px-2 py-1 text-white normal-case tracking-normal">
        {people.map((person) => <option key={person.id} value={person.id}>{nameOverrides.get(person.id) ?? person.name}</option>)}
      </select>
    </label>
  );
}

function StaffScreen() {
  const gym = useDemoGym();
  const actor = gym.selectedActor;
  // Projections are based on a canonical token; display profiles never authorize the prepared cores.
  const projection = useGymProjection(actor.id, true);
  if (!projection.success || !projection.fixed) return <ProjectionError error={projection.success ? "No se pudo preparar el entrenamiento." : projection.error} />;
  const wods = mapGymWods(projection.staff.wods);
  if (!wods.success || !gym.trainingCallbacks || !gym.fixedCallbacks || !gym.today) return <ProjectionError error={wods.success ? "No se pudo preparar el entrenamiento." : wods.error} />;
  const fixed = projection.fixed;
  return (
    <>
      <header>
        <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">{actor.role === "ADMIN" ? "Administración de entrenamiento" : "Mis rutinas"}</h1>
        <p className="mt-2 text-sm font-body text-gray-400">Gestioná rutinas y grupos de entrenamiento. La gestión integral de usuarios queda fuera de este demo.</p>
      </header>
      <div className="flex flex-col gap-8">
        <GroupManagerView key={gym.datedEpoch} groups={projection.staff.groups.map((group) => ({ ...group, students: [...group.students], availableToAdd: [...group.availableToAdd] }))} onCreateGroup={gym.trainingCallbacks.onCreateGroup} onDeleteGroup={gym.trainingCallbacks.onDeleteGroup} onRenameGroup={gym.trainingCallbacks.onRenameGroup} onAssignStudentToGroup={gym.trainingCallbacks.onAssignStudentToGroup} onRemoveStudentFromGroup={gym.trainingCallbacks.onRemoveStudentFromGroup} />
        <FixedRoutineManagerView key={gym.fixedEpoch} muslibStudents={fixed.assignment.muslibStudents} renewalRoutines={fixed.renewals} createFixedRoutine={gym.fixedCallbacks.onCreateFixedRoutine} updateFixedRoutine={gym.fixedCallbacks.onUpdateFixedRoutine} deleteFixedRoutine={gym.fixedCallbacks.onDeleteFixedRoutine} getDefaultRenewAt={() => defaultGymFixedRenewAt(gym.today!)} />
        <WodManagerView key={`${gym.datedEpoch}:${gym.fixedEpoch}`} wods={wods.value} groups={projection.staff.groups.map((group) => ({ id: group.id, name: group.name }))} students={projection.staff.students.map((student) => ({ ...student }))} muslibStudents={fixed.assignment.muslibStudents} terms={terms} onCreateWod={gym.trainingCallbacks.onCreateWod} onUpdateWod={gym.trainingCallbacks.onUpdateWod} onDeleteWod={gym.trainingCallbacks.onDeleteWod} onCreateFixedRoutine={gym.fixedCallbacks.onCreateFixedRoutine} onCreateFixedRoutineForGroup={gym.fixedCallbacks.onCreateFixedRoutineForGroup} onCopyWod={gym.trainingCallbacks.onCopyWod} />
      </div>
      <div className="flex gap-3 flex-wrap text-xs font-heading font-bold uppercase tracking-[0.12em]">
        <button type="button" onClick={gym.resetDatedTraining} className="text-gray-500 hover:text-white">Restablecer rutinas por fecha</button>
        <button type="button" onClick={gym.resetFixedRoutines} className="text-gray-500 hover:text-white">Restablecer rutinas fijas</button>
      </div>
    </>
  );
}

function RmsScreen() {
  const gym = useDemoGym();
  const nameOverrides = useGymNameOverrides();
  const rms = gym.rmProjection.success ? mapGymRms(gym.rmProjection.rms) : gym.rmProjection;
  if (!rms.success || !gym.rmCallbacks) return <ProjectionError error={rms.success ? "No se pudieron preparar los PRs." : rms.error} />;
  const athleteName = nameOverrides.get(gym.selectedActor.id) ?? gym.selectedActor.name;
  return <div key={gym.rmEpoch} className="flex flex-col gap-6"><RmsView rms={rms.value} athleteName={athleteName} gymName={gymName} gymSlug={gymSlug} terms={terms} onCreateRm={gym.rmCallbacks.onCreateRm} onUpdateRm={gym.rmCallbacks.onUpdateRm} onDeleteRm={gym.rmCallbacks.onDeleteRm} /><button type="button" onClick={gym.resetRms} className="self-start text-xs font-heading font-bold uppercase tracking-[0.12em] text-gray-500 hover:text-white">Restablecer PRs</button></div>;
}

function StudentScreen({ selectedWodId, setSelectedWodId }: { selectedWodId: string | null; setSelectedWodId: (id: string | null) => void }) {
  const gym = useDemoGym();
  const isMuslib = gym.selectedActor.studentType === "MUSCULACION_LIBRE";
  const projection = useGymProjection(gym.selectedActor.id, false, isMuslib);
  if (!projection.success) return <ProjectionError error={projection.error} />;
  if (isMuslib) {
    const fixed = projection.fixedStudent;
    if (!fixed) return <ProjectionError error="No se pudo preparar la rutina fija." />;
    return fixed.success ? <FixedRoutineStudentView activeRoutine={fixed.value} renewalWarning={null} /> : <ProjectionError error={fixed.error} />;
  }
  const wods = mapGymWods(projection.student.wods);
  if (!wods.success) return <ProjectionError error={wods.error} />;
  const selected = selectedWodId ? wods.value.find((wod) => wod.id === selectedWodId) ?? null : null;
  if (selected) return <StudentWodDetailView wod={selected} studentId={gym.selectedActor.id} onBack={() => setSelectedWodId(null)} shareAction={<ShareWodButton title={selected.title} content={selected.content} dateLabel={selected.date.toLocaleDateString("es-AR")} gymName={gymName} />} />;
  return <StudentWodHome wods={wods.value} onSelect={setSelectedWodId} />;
}

function StudentDetail({ selectedWodId }: { selectedWodId: string | null }) {
  const gym = useDemoGym();
  const projection = useGymProjection(gym.selectedActor.id, false);
  if (!projection.success) return <ProjectionError error={projection.error} />;
  if (gym.selectedActor.studentType === "MUSCULACION_LIBRE") return <StudentScreen selectedWodId={null} setSelectedWodId={() => {}} />;
  const wods = mapGymWods(projection.student.wods);
  if (!wods.success) return <ProjectionError error={wods.error} />;
  // Direct entry has no authority-bearing query parameter; it falls back to a currently visible record only.
  const visible = selectedWodId ? wods.value.find((wod) => wod.id === selectedWodId) ?? null : wods.value[0] ?? null;
  return visible ? <StudentWodDetailView wod={visible} studentId={gym.selectedActor.id} backHref="/demo/gym/student" shareAction={<ShareWodButton title={visible.title} content={visible.content} dateLabel={visible.date.toLocaleDateString("es-AR")} gymName={gymName} />} /> : <p className="text-gray-500">No hay rutina visible para mostrar.</p>;
}

function StudentWodHome({ wods, onSelect }: { wods: import("./gym-demo-view-model").GymViewWod[]; onSelect: (id: string) => void }) {
  const { today } = useDemoGym();
  const current = wods[0] ?? null;
  const isCurrentDay = current !== null && today !== null && current.date.toISOString().slice(0, 10) === today;
  return <><header><h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">Mi rutina</h1></header>{current ? <WodCard wod={current} highlight={isCurrentDay} assignment={{ targetType: current.targetType, targetGroupName: current.targetGroupName, isOwn: current.isOwn ?? false }} actions={<button type="button" onClick={() => onSelect(current.id)} className="text-xs font-heading font-bold uppercase tracking-[0.12em] text-brand-red">Ver rutina</button>} /> : <p className="text-gray-500">No hay rutina visible todavía.</p>}<WodHistory wods={wods.map((wod) => ({ ...wod, assignment: { targetType: wod.targetType, targetGroupName: wod.targetGroupName, isOwn: wod.isOwn ?? false } }))} wodPath="/demo/gym/student/wod" terms={terms} onSelectWod={onSelect} /></>;
}

type GymTrainingSuccess = Extract<GymTrainingProjection, { success: true }>;
type GymRouteProjection = { success: true; staff: GymTrainingSuccess["staff"]; student: GymTrainingSuccess["student"]; fixed?: { assignment: GymFixedDemoAssignmentContext; renewals: GymFixedDemoRenewalDto[] }; fixedStudent?: ReturnType<typeof projectGymFixedStudentRoutineSafe> } | { success: false; error: string };

/**
 * Display-only student id -> current editable name, from the profile bridge. Eligibility and
 * canonical-only fields stay on the frozen directory everywhere this map is passed downstream.
 */
function useGymNameOverrides(): ReadonlyMap<string, string> {
  const { profileState } = useDemoGymProfile();
  return useMemo(() => new Map(profileState.students.map((student) => [student.id, student.name])), [profileState]);
}

function useGymProjection(actorId: string, includeStaffFixed: boolean, includeStudentFixed = false): GymRouteProjection {
  const gym = useDemoGym();
  const nameOverrides = useGymNameOverrides();
  // The prepared state projector resolves only a canonical directory token generated from this active FULL identity.
  const token = requireGymToken(actorId);
  if (!token) return { success: false, error: "La identidad de demostración no es válida." };
  const training = projectGymTrainingViews(gym.trainingState, token, nameOverrides);
  if (!training.success) return { success: false, error: training.error };
  if (!includeStaffFixed) return { success: true, staff: training.staff, student: training.student, fixedStudent: includeStudentFixed ? projectGymFixedStudentRoutineSafe(gym.fixedState, token) : undefined };
  const assignment = projectGymFixedAssignmentContext(gym.fixedState, gym.trainingState, token, nameOverrides);
  const renewals = gym.today ? projectGymFixedRenewals(gym.fixedState, token, gym.today, nameOverrides) : null;
  if (!assignment || !renewals) return { success: false, error: "No se pudo proyectar el entrenamiento de demostración." };
  return { success: true, staff: training.staff, student: training.student, fixed: { assignment, renewals } };
}

function requireGymToken(actorId: string): object | null {
  // Imported from the canonical directory without accepting caller data as a token.
  return getGymDemoProfile(actorId) ? getGymDemoActorToken(actorId) : null;
}

function Loading() { return <main className="flex-1 min-h-[60vh] px-4 py-10 text-white"><p className="mx-auto max-w-5xl text-sm font-body text-gray-400">Preparando la demostración de gimnasio…</p></main>; }
function ProjectionError({ error }: { error: string }) { return <p role="alert" className="text-sm text-brand-red">{error}</p>; }
