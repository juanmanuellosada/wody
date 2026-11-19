"use client";

import { useEffect, useRef, useState } from "react";
import { GroupManagerView } from "@/components/group/GroupManagerView";
import { RmsView } from "@/components/RmsView";
import { ShareWodButton } from "@/components/wod/ShareWodButton";
import { StudentWodDetailView } from "@/components/wod/StudentWodDetailView";
import { WodCard } from "@/components/wod/WodCard";
import { WodHistory } from "@/components/wod/WodHistory";
import { WodManagerView } from "@/components/wod/WodManagerView";
import { gymTerms } from "@/lib/gym-terms";
import { DemoTrainingActorSelector } from "./DemoTrainingActorSelector";
import { useDemoTraining } from "./DemoTrainingProvider";
import type { TrainingRole } from "./training-demo-types";

type DemoTrainingScreen = "staff" | "student" | "student-wod" | "rms";

type DemoTrainingRouteProps = {
  routeKey: string;
  routeRole: TrainingRole;
  routeActorId: string;
  screen: DemoTrainingScreen;
};

const terms = gymTerms("BOX");
const gymName = "BOX de demostración";
const gymSlug = "demo-box-training";

/**
 * Client-only route entry for the local training provider. The provider survives
 * App Router navigation; this component only selects an explicit route identity.
 */
export function DemoTrainingRoute({ routeKey, routeRole, routeActorId, screen }: DemoTrainingRouteProps) {
  const { ready, warning, state, projections, callbacks, selectActor, reset } = useDemoTraining();
  const initializedRoutes = useRef(new Set<string>());
  const [initializedRouteKey, setInitializedRouteKey] = useState<string | null>(null);
  const [selectedWodId, setSelectedWodId] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || initializedRoutes.current.has(routeKey)) return;
    initializedRoutes.current.add(routeKey);
    selectActor(routeActorId);
    // Keep the first route-key selection visible after React's development effect replay.
    queueMicrotask(() => setInitializedRouteKey(routeKey));
  }, [ready, routeActorId, routeKey, selectActor]);

  const selectedWod = selectedWodId
    ? projections.student.wods.find((wod) => wod.id === selectedWodId) ?? null
    : null;


  function resetForRoute() {
    reset();
    selectActor(routeActorId);
    setSelectedWodId(null);
  }

  // Do not paint the previous route's actor while a persistent provider is changing identity.
  const routeReady = ready
    && initializedRouteKey === routeKey
    && projections.selectedActor.id === state.selectedActorId
    && projections.selectedActor.role === routeRole;

  if (!routeReady) {
    return (
      <main className="flex-1 min-h-[60vh] px-4 py-10 text-white">
        <p className="mx-auto max-w-5xl text-sm font-body text-gray-400">Preparando la identidad de demostración…</p>
      </main>
    );
  }

  const actor = projections.selectedActor;
  const isStaff = actor.role === "ADMIN" || actor.role === "TEACHER";
  const detailWod = selectedWod ?? projections.student.wods[0] ?? null;

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10 flex flex-col gap-8">
      {warning && <p role="status" className="border border-brand-red/40 bg-brand-red/10 p-3 text-sm font-body text-gray-200">{warning}</p>}
      <DemoTrainingActorSelector
        routeRole={routeRole}
        selectedActor={actor}
        actors={state.actors}
        onSelectActor={(actorId) => {
          setSelectedWodId(null);
          selectActor(actorId);
        }}
        onReset={resetForRoute}
      />

      {screen === "staff" && isStaff && (
        <>
          <header>
            <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red">{actor.role === "ADMIN" ? "Panel de control" : "Dashboard profe"}</p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
              WODs y grupos de {actor.name}
            </h1>
          </header>
          <GroupManagerView
            groups={projections.staff.groups}
            onCreateGroup={callbacks.onCreateGroup}
            onDeleteGroup={callbacks.onDeleteGroup}
            onRenameGroup={callbacks.onRenameGroup}
            onAssignStudentToGroup={callbacks.onAssignStudentToGroup}
            onRemoveStudentFromGroup={callbacks.onRemoveStudentFromGroup}
          />
          <section>
            <div className="flex items-center gap-4 mb-5">
              <h2 className="text-lg font-heading font-bold uppercase tracking-[0.15em] text-gray-400">Mis {terms.wods}</h2>
              <div className="flex-1 h-px bg-elev" aria-hidden="true" />
            </div>
            <WodManagerView
              wods={projections.staff.wods}
              groups={projections.staff.groups}
              students={projections.staff.students}
              terms={terms}
              onCreateWod={callbacks.onCreateWod}
              onUpdateWod={callbacks.onUpdateWod}
              onDeleteWod={callbacks.onDeleteWod}
              onCreateFixedRoutine={callbacks.onCreateFixedRoutine}
              onCreateFixedRoutineForGroup={callbacks.onCreateFixedRoutineForGroup}
              onCopyWod={callbacks.onCopyWod}
            />
          </section>
        </>
      )}

      {screen === "rms" && (
        <RmsView
          rms={projections.rms}
          athleteName={actor.name}
          gymName={gymName}
          gymSlug={gymSlug}
          terms={terms}
          onCreateRm={callbacks.rm.createRm}
          onUpdateRm={callbacks.rm.updateRm}
          onDeleteRm={callbacks.rm.deleteRm}
        />
      )}

      {screen === "student" && actor.role === "STUDENT" && (
        selectedWod ? (
          <StudentWodDetailView
            wod={selectedWod}
            studentId={actor.id}
            onBack={() => setSelectedWodId(null)}
            shareAction={<ShareWodButton title={selectedWod.title} content={selectedWod.content} dateLabel={selectedWod.date.toLocaleDateString("es-AR")} gymName={gymName} />}
          />
        ) : (
          <StudentWodHome
            wods={projections.student.wods}
            onSelectWod={setSelectedWodId}
          />
        )
      )}

      {screen === "student-wod" && actor.role === "STUDENT" && (
        detailWod ? (
          <StudentWodDetailView
            wod={detailWod}
            studentId={actor.id}
            backHref="/demo/student"
            shareAction={<ShareWodButton title={detailWod.title} content={detailWod.content} dateLabel={detailWod.date.toLocaleDateString("es-AR")} gymName={gymName} />}
          />
        ) : (
          <section className="min-h-[60vh] flex flex-col items-center justify-center text-center">
            <p className="text-gray-500 text-lg font-heading font-bold uppercase tracking-[0.15em]">No hay {terms.wod} para mostrar</p>
          </section>
        )
      )}
    </main>
  );
}

function StudentWodHome({
  wods,
  onSelectWod,
}: {
  wods: ReturnType<typeof useDemoTraining>["projections"]["student"]["wods"];
  onSelectWod: (wodId: string) => void;
}) {
  const todayWod = wods[0] ?? null;
  return (
    <>
      <header>
        <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red">BOX de demostración</p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">Mi {terms.wod}</h1>
      </header>
      <section>
        <div className="flex items-center gap-4 mb-5">
          <h2 className="text-lg font-heading font-bold uppercase tracking-[0.15em] text-gray-400">{terms.wod} visible</h2>
          <div className="flex-1 h-px bg-elev" aria-hidden="true" />
        </div>
        {todayWod ? (
          <WodCard
            wod={todayWod}
            highlight
            assignment={{
              targetType: todayWod.targetType,
              targetGroupName: todayWod.targetGroupName,
              isOwn: todayWod.isOwn,
            }}
            actions={<button type="button" onClick={() => onSelectWod(todayWod.id)} className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-brand-red hover:text-white transition-colors duration-200 cursor-pointer">Ver en grande</button>}
          />
        ) : (
          <p className="text-gray-600 text-sm font-heading font-bold uppercase tracking-[0.15em]">No hay {terms.wods} visibles todavía.</p>
        )}
      </section>
      <section>
        <div className="flex items-center gap-4 mb-5">
          <h2 className="text-lg font-heading font-bold uppercase tracking-[0.15em] text-gray-400">Historial</h2>
          <div className="flex-1 h-px bg-elev" aria-hidden="true" />
        </div>
        <WodHistory
          wods={wods.map((wod) => ({
            ...wod,
            assignment: {
              targetType: wod.targetType,
              targetGroupName: wod.targetGroupName,
              isOwn: wod.isOwn,
            },
          }))}
          wodPath="/demo/student/wod"
          terms={terms}
          onSelectWod={onSelectWod}
        />
      </section>
    </>
  );
}
