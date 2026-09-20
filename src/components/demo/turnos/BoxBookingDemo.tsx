"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MyTurnosView } from "../../activity/views/MyTurnosView";
import { TurnosCalendarView } from "../../activity/views/TurnosCalendarView";
import type { MyBookingRow, MyEnrollmentRow, StudentSessionRow } from "../../activity/views/view-models";
import {
  DEMO_TIMEZONE,
  getArgentinaDateKey,
  loadDemoState,
  reduceDemoBooking,
  resetDemoState,
  saveDemoState,
  toCalendarSessions,
  toMyBookingRows,
  type DemoBookingState,
  type DemoCommand,
} from "./booking-demo-state";

type DemoScreen = "calendar" | "mine";

const accountLabels = {
  FULL: "FULL · reserva desde la app",
  LITE: "LITE · solo inscripción por el equipo",
} as const;

/** A client-only, fictional booking simulation. It never calls the production booking boundary. */
export function BoxBookingDemo() {
  const [state, setState] = useState<DemoBookingState | null>(null);
  const [screen, setScreen] = useState<DemoScreen>("calendar");
  const [storageNotice, setStorageNotice] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setState(loadDemoState(window.sessionStorage, getArgentinaDateKey())), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function run(command: DemoCommand) {
    if (!state) return Promise.resolve({ success: false as const, error: "La demo todavía se está preparando." });
    const transition = reduceDemoBooking(state, command, new Date());
    setState(transition.state);
    if (!saveDemoState(window.sessionStorage, transition.state)) {
      setStorageNotice("No se pudo conservar esta simulación en el navegador. Podés seguir probando durante esta visita.");
    }
    return Promise.resolve(transition.result);
  }

  function reset() {
    const nextState = resetDemoState(window.sessionStorage, getArgentinaDateKey());
    setState(nextState);
    setScreen("calendar");
    setStorageNotice(null);
  }

  if (!state) {
    return (
      <main className="min-h-screen bg-brand-black px-4 py-10 text-white">
        <p className="mx-auto max-w-3xl font-body text-sm text-gray-400">Preparando la demostración de turnos…</p>
      </main>
    );
  }

  const calendarSessions = toCalendarSessions(state, new Date());
  const bookingRows = toMyBookingRows(state, new Date());
  const calendarKey = calendarSessions.map((session) => `${session.id}:${session.bookingId}:${session.bookedCount}:${session.enrolledSlot}`).join("|");
  const myTurnosKey = `${bookingRows.map((booking) => booking.bookingId).join("|")}::${state.enrollments.map((enrollment) => enrollment.enrollmentId).join("|")}`;

  return (
    <main className="min-h-screen bg-brand-black px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
          <div>
            <Link href="/" className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400 hover:text-white">
              ← Volver a Wody
            </Link>
            <h1 className="mt-4 font-heading text-4xl font-bold uppercase tracking-[0.04em] text-white sm:text-5xl">Turnos del box</h1>
            <p className="mt-2 max-w-2xl font-body text-sm leading-relaxed text-gray-400">
              Demo de alumno para Iron Harbor Box. Julia Acosta y sus datos son ficticios.
            </p>
          </div>
          <span className="border border-brand-red px-3 py-2 text-xs font-heading font-bold uppercase tracking-[0.15em] text-brand-red">
            Demo BOX
          </span>
        </header>

        <p className="border border-line bg-panel px-4 py-3 font-body text-sm text-gray-300">
          Demo: los cambios solo se guardan en este navegador. No representa cupos en tiempo real ni operaciones administrativas.
        </p>

        <section className="flex flex-col gap-4 border border-line bg-panel p-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-lg font-bold uppercase tracking-[0.15em] text-white">Ejemplo de cuenta</h2>
            <p className="mt-1 font-body text-sm text-gray-400">{accountLabels[state.accountKind]}</p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de cuenta de la demo">
            {(["FULL", "LITE"] as const).map((accountKind) => (
              <button
                key={accountKind}
                type="button"
                className={`min-h-[36px] border px-4 text-xs font-heading font-bold uppercase tracking-[0.15em] transition-colors ${
                  state.accountKind === accountKind
                    ? "border-brand-red bg-brand-red text-white"
                    : "border-edge bg-elev text-gray-300 hover:border-brand-red hover:text-brand-red"
                }`}
                aria-pressed={state.accountKind === accountKind}
                onClick={() => run({ type: "set-account-kind", accountKind })}
              >
                {accountKind}
              </button>
            ))}
            <button
              type="button"
              className="min-h-[36px] border border-edge bg-elev px-4 text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-300 hover:border-brand-red hover:text-brand-red"
              onClick={reset}
            >
              Restablecer demo
            </button>
          </div>
        </section>

        {storageNotice && <p className="text-sm font-body text-brand-red" role="status">{storageNotice}</p>}

        <nav className="flex border-b border-line" aria-label="Secciones de turnos">
          <button
            type="button"
            className={`min-h-[44px] px-4 text-sm font-heading font-bold uppercase tracking-[0.15em] ${screen === "calendar" ? "border-b-2 border-brand-red text-white" : "text-gray-500 hover:text-white"}`}
            aria-current={screen === "calendar" ? "page" : undefined}
            onClick={() => setScreen("calendar")}
          >
            Calendario
          </button>
          <button
            type="button"
            className={`min-h-[44px] px-4 text-sm font-heading font-bold uppercase tracking-[0.15em] ${screen === "mine" ? "border-b-2 border-brand-red text-white" : "text-gray-500 hover:text-white"}`}
            aria-current={screen === "mine" ? "page" : undefined}
            onClick={() => setScreen("mine")}
          >
            Mis turnos
          </button>
        </nav>

        {screen === "calendar" ? (
          <section aria-labelledby="calendar-title">
            <h2 id="calendar-title" className="mb-4 font-heading text-2xl font-bold uppercase tracking-[0.1em] text-white">
              Próximas clases
            </h2>
            <TurnosCalendarView
              key={calendarKey}
              timezone={DEMO_TIMEZONE}
              sessions={calendarSessions}
              canBook={state.accountKind === "FULL"}
              onBookSingle={(row: StudentSessionRow) => run({ type: "book-single", sessionId: row.id }).then((result) =>
                result.success && result.bookingId ? { success: true as const, bookingId: result.bookingId } : result as { success: false; error: string }
              )}
              onEnrollAll={(row: StudentSessionRow) => run({ type: "enroll-slot", slotId: row.slotId }).then((result) =>
                result.success && result.enrollmentId
                  ? { success: true as const, enrollmentId: result.enrollmentId, bookingsCreated: result.bookingsCreated ?? 0 }
                  : result as { success: false; error: string }
              )}
              onCancelBooking={(row: StudentSessionRow) => run({ type: "cancel-booking", bookingId: row.bookingId! }).then((result) =>
                result.success ? { success: true as const } : result as { success: false; error: string }
              )}
            />
            {state.accountKind === "LITE" && (
              <p className="mt-3 font-body text-sm text-gray-400">En una cuenta LITE, el equipo del box realiza las inscripciones.</p>
            )}
          </section>
        ) : (
          <section aria-label="Mis turnos">
            <MyTurnosView
              key={myTurnosKey}
              timezone={DEMO_TIMEZONE}
              bookings={bookingRows}
              enrollments={state.enrollments}
              onCancelBooking={(row: MyBookingRow) => run({ type: "cancel-booking", bookingId: row.bookingId }).then((result) =>
                result.success ? { success: true as const } : result as { success: false; error: string }
              )}
              onCancelEnrollment={(row: MyEnrollmentRow) => run({ type: "cancel-enrollment", enrollmentId: row.enrollmentId }).then((result) =>
                result.success ? { success: true as const } : result as { success: false; error: string }
              )}
            />
          </section>
        )}
      </div>
    </main>
  );
}
