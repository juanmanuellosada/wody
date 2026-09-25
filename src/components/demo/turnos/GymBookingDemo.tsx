"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MyTurnosView } from "../../activity/views/MyTurnosView";
import { TurnosCalendarView } from "../../activity/views/TurnosCalendarView";
import type {
  BookingActionResult,
  EnrollmentActionResult,
  MyBookingRow,
  MyEnrollmentRow,
  SimpleActionResult,
  StudentSessionRow,
} from "../../activity/views/view-models";
import { useDemoGymProfile } from "../gym/DemoGymProfileProvider";
import { GymManagementDemo } from "./GymManagementDemo";
import {
  activeGymTurnosActor,
  gymTurnosMyTurnosRevision,
  gymTurnosRowsRevision,
  gymTurnosStudents,
  isGymTurnosStaff,
  resolveGymTurnosDisplayName,
  selectInitialGymTurnosActor,
} from "./gym-turnos-demo-adapters";
import { buenosAiresDateKey } from "./gym-turnos-demo-fixtures";
import {
  createGymTurnosDemoState,
  reduceGymTurnosDemo,
  toGymTurnosMyBookingRows,
  toGymTurnosMyEnrollmentRows,
  toGymTurnosStudentSessionRows,
} from "./gym-turnos-demo-state";
import { loadGymTurnosDemoState, persistGymTurnosDemoState } from "./gym-turnos-demo-storage";
import type { GymTurnosDemoStorage } from "./gym-turnos-demo-storage";
import type {
  GymTurnosDemoCommand,
  GymTurnosDemoRole,
  GymTurnosDemoState,
} from "./gym-turnos-demo-types";

type DemoScreen = "calendar" | "mine" | "management";
type CommandResult = ReturnType<typeof reduceGymTurnosDemo>["result"];

const roleLabel = {
  ADMIN: "Administración",
  TEACHER: "Profesorado",
  STUDENT: "Alumno",
} as const;

function currentAnchor(now: Date): string {
  return buenosAiresDateKey(now);
}

/** A client-only, fictional GYM turnos simulation. It never calls production actions. */
export function GymBookingDemo({ initialRole }: { initialRole?: GymTurnosDemoRole }) {
  const [state, setState] = useState<GymTurnosDemoState | null>(null);
  const stateRef = useRef<GymTurnosDemoState | null>(null);
  const storageRef = useRef<GymTurnosDemoStorage | null>(null);
  const initialRoleRef = useRef(initialRole);
  const [screen, setScreen] = useState<DemoScreen>("management");
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const { profileState } = useDemoGymProfile();
  // Display-only student id -> current editable name, from the profile bridge. Read fresh at
  // render and threaded as a plain value, never cached in a ref or mirrored with an effect.
  const nameOverrides = useMemo(
    () => new Map(profileState.students.map((student) => [student.id, student.name])),
    [profileState],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const now = new Date();
      const anchor = currentAnchor(now);
      let storage: GymTurnosDemoStorage | null = null;
      try {
        storage = window.sessionStorage;
      } catch {
        storage = null;
      }
      const loaded = loadGymTurnosDemoState(storage, anchor, createGymTurnosDemoState(anchor));
      const initialized = selectInitialGymTurnosActor(loaded.state, initialRoleRef.current);
      storageRef.current = storage;
      stateRef.current = initialized;
      setState(initialized);
      setStorageNotice(loaded.warning);
      setScreen(activeGymTurnosActor(initialized).role === "STUDENT" ? "calendar" : "management");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function persist(next: GymTurnosDemoState) {
    setStorageNotice(persistGymTurnosDemoState(storageRef.current, next));
  }

  function run(command: GymTurnosDemoCommand): Promise<CommandResult> {
    const current = stateRef.current;
    if (!current) {
      return Promise.resolve({ success: false, error: "La demo todavía se está preparando." } as CommandResult);
    }
    const transition = reduceGymTurnosDemo(current, command, new Date());
    stateRef.current = transition.state;
    setState(transition.state);
    persist(transition.state);
    return Promise.resolve(transition.result);
  }

  function reset() {
    const now = new Date();
    const next = selectInitialGymTurnosActor(
      createGymTurnosDemoState(currentAnchor(now)),
      initialRoleRef.current,
    );
    stateRef.current = next;
    setState(next);
    setScreen(activeGymTurnosActor(next).role === "STUDENT" ? "calendar" : "management");
    persist(next);
  }

  if (!state) {
    return (
      <main className="min-h-screen bg-brand-black px-4 py-10 text-white">
        <p className="mx-auto max-w-3xl font-body text-sm text-gray-400">Preparando la demostración de turnos…</p>
      </main>
    );
  }

  const now = new Date();
  const actor = activeGymTurnosActor(state);
  const studentId = actor.role === "STUDENT" ? actor.id : null;
  const calendarSessions = studentId ? toGymTurnosStudentSessionRows(state, studentId, now) : [];
  const bookingRows = studentId ? toGymTurnosMyBookingRows(state, studentId, now) : [];
  const enrollmentRows = studentId ? toGymTurnosMyEnrollmentRows(state, studentId) : [];
  const calendarKey = gymTurnosRowsRevision(calendarSessions);
  const myTurnosKey = gymTurnosMyTurnosRevision(bookingRows, enrollmentRows);
  const students = gymTurnosStudents(state);

  function selectActor(actorId: string) {
    void run({ type: "select-actor", actorId }).then((result) => {
      if (!result.success) return;
      const next = stateRef.current;
      if (next) setScreen(activeGymTurnosActor(next).role === "STUDENT" ? "calendar" : "management");
    });
  }

  function asBookingResult(result: CommandResult): BookingActionResult {
    return result as BookingActionResult;
  }
  function asEnrollmentResult(result: CommandResult): EnrollmentActionResult {
    return result as EnrollmentActionResult;
  }
  function asSimpleResult(result: CommandResult): SimpleActionResult {
    return result as SimpleActionResult;
  }

  return (
    <main className="min-h-screen bg-brand-black px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
          <div>
            <Link href="/" className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400 hover:text-white">
              ← Volver a Wody
            </Link>
            <h1 className="mt-4 font-heading text-4xl font-bold uppercase tracking-[0.04em] text-white sm:text-5xl">Turnos del gimnasio</h1>
            <p className="mt-2 max-w-2xl font-body text-sm leading-relaxed text-gray-400">
              Demo local del gimnasio de demostración. Todas las personas, actividades y reservas son ficticias.
            </p>
          </div>
          <span className="border border-brand-red px-3 py-2 text-xs font-heading font-bold uppercase tracking-[0.15em] text-brand-red">
            Demo GYM
          </span>
        </header>

        <p className="border border-line bg-panel px-4 py-3 font-body text-sm text-gray-300">
          Esta demo se ejecuta solo en este navegador: no envía notificaciones, no llama a servicios reales y no representa cupos en tiempo real.
        </p>

        <section className="flex flex-col gap-4 border border-line bg-panel p-4">
          <div>
            <h2 className="font-heading text-lg font-bold uppercase tracking-[0.15em] text-white">Identidad ficticia</h2>
            <p className="mt-1 font-body text-sm text-gray-400">
              Estás viendo la demo como {resolveGymTurnosDisplayName(nameOverrides, actor.id, actor.name)} · {roleLabel[actor.role]}{actor.role === "STUDENT" ? ` · ${actor.accountKind}` : ""}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Identidad de la demo">
            {state.actors.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                className={`min-h-[36px] border px-3 text-xs font-heading font-bold uppercase tracking-[0.12em] transition-colors ${
                  actor.id === candidate.id
                    ? "border-brand-red bg-brand-red text-white"
                    : "border-edge bg-elev text-gray-300 hover:border-brand-red hover:text-brand-red"
                }`}
                aria-pressed={actor.id === candidate.id}
                onClick={() => selectActor(candidate.id)}
              >
                {resolveGymTurnosDisplayName(nameOverrides, candidate.id, candidate.name)} · {candidate.role === "STUDENT" ? candidate.accountKind : roleLabel[candidate.role]}
              </button>
            ))}
            <button
              type="button"
              className="min-h-[36px] border border-edge bg-elev px-3 text-xs font-heading font-bold uppercase tracking-[0.12em] text-gray-300 hover:border-brand-red hover:text-brand-red"
              onClick={reset}
            >
              Restablecer demo
            </button>
          </div>
          <p className="font-body text-xs text-gray-500">
            Cuentas de alumno disponibles: {students.map((student) => `${resolveGymTurnosDisplayName(nameOverrides, student.id, student.name)} (${student.accountKind})`).join(" · ")}.
          </p>
        </section>

        {storageNotice && <p className="text-sm font-body text-brand-red" role="status">{storageNotice}</p>}

        {actor.role === "STUDENT" ? (
          <nav className="flex border-b border-line" aria-label="Secciones de turnos">
            <DemoTab active={screen === "calendar"} onClick={() => setScreen("calendar")}>Calendario</DemoTab>
            <DemoTab active={screen === "mine"} onClick={() => setScreen("mine")}>Mis turnos</DemoTab>
          </nav>
        ) : (
          <nav className="flex border-b border-line" aria-label="Secciones de gestión">
            <DemoTab active={screen === "management"} onClick={() => setScreen("management")}>Gestión</DemoTab>
          </nav>
        )}

        {actor.role === "STUDENT" && screen === "calendar" && studentId && (
          <section aria-labelledby="calendar-title">
            <h2 id="calendar-title" className="mb-4 font-heading text-2xl font-bold uppercase tracking-[0.1em] text-white">Próximas clases</h2>
            <TurnosCalendarView
              key={calendarKey}
              timezone="America/Argentina/Buenos_Aires"
              sessions={calendarSessions}
              canBook={actor.accountKind === "FULL"}
              onBookSingle={(row: StudentSessionRow) => run({ type: "student-book", studentId, sessionId: row.id }).then(asBookingResult)}
              onEnrollAll={(row: StudentSessionRow) => run({ type: "student-enroll", studentId, slotId: row.slotId }).then(asEnrollmentResult)}
              onCancelBooking={(row: StudentSessionRow) => run({ type: "student-cancel-booking", studentId, bookingId: row.bookingId! }).then(asSimpleResult)}
            />
            {actor.accountKind === "LITE" && (
              <p className="mt-3 font-body text-sm text-gray-400">La cuenta LITE puede ver los turnos, pero el equipo del gimnasio debe inscribirla.</p>
            )}
          </section>
        )}

        {actor.role === "STUDENT" && screen === "mine" && studentId && (
          <section aria-label="Mis turnos">
            <MyTurnosView
              key={myTurnosKey}
              timezone="America/Argentina/Buenos_Aires"
              bookings={bookingRows}
              enrollments={enrollmentRows}
              onCancelBooking={(row: MyBookingRow) => run({ type: "student-cancel-booking", studentId, bookingId: row.bookingId }).then(asSimpleResult)}
              onCancelEnrollment={(row: MyEnrollmentRow) => run({ type: "student-cancel-enrollment", studentId, enrollmentId: row.enrollmentId }).then(asSimpleResult)}
            />
          </section>
        )}

        {isGymTurnosStaff(actor) && screen === "management" && (
          <GymManagementDemo key={actor.id} state={state} now={now} run={run} nameOverrides={nameOverrides} />
        )}
      </div>
    </main>
  );
}

function DemoTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={`min-h-[44px] px-4 text-sm font-heading font-bold uppercase tracking-[0.15em] ${active ? "border-b-2 border-brand-red text-white" : "text-gray-500 hover:text-white"}`}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
