import assert from "node:assert/strict";
import test from "node:test";
import { createGymTurnosDemoState } from "./gym-turnos-demo-state.ts";
import {
  isValidGymTurnosDemoState,
  loadGymTurnosDemoState,
  persistGymTurnosDemoState,
  resolveGymTurnosDemoInitialState,
  serializeGymTurnosDemoState,
} from "./gym-turnos-demo-storage.ts";
import { GYM_TURNOS_DEMO_STORAGE_KEY } from "./gym-turnos-demo-types.ts";

const anchor = "2030-06-03";
const fixture = createGymTurnosDemoState(anchor);

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  const reads = [];
  const writes = [];
  return {
    getItem(key) { reads.push(key); return values.get(key) ?? null; },
    setItem(key, value) { writes.push([key, value]); values.set(key, value); },
    reads,
    writes,
    values,
  };
}

test("the GYM turnos namespace and storage key are isolated from BOX's", () => {
  assert.equal(GYM_TURNOS_DEMO_STORAGE_KEY, "wody-gym-turnos-demo-v1");
  assert.notEqual(GYM_TURNOS_DEMO_STORAGE_KEY, "wody-box-turnos-demo-v2");
});

test("a valid fixture round-trips through serialize/resolve", () => {
  assert.equal(isValidGymTurnosDemoState(fixture), true);
  const raw = serializeGymTurnosDemoState(fixture);
  assert.deepEqual(resolveGymTurnosDemoInitialState(raw, anchor).state, fixture);
  assert.equal(resolveGymTurnosDemoInitialState(raw, anchor).warning, null);
});

test("an invalid state refuses to serialize", () => {
  assert.throws(() => serializeGymTurnosDemoState({ ...fixture, extra: true }));
});

test("load reads only its own key and never the BOX or other GYM module keys, and read/write failures fall back safely", () => {
  const boxKey = "wody-box-turnos-demo-v2";
  const gymAccessKey = "wody-gym-access-demo-v1";
  const storage = memoryStorage({ [boxKey]: "box-bytes", [gymAccessKey]: "gym-access-bytes" });
  const loaded = loadGymTurnosDemoState(storage, anchor, createGymTurnosDemoState("2031-01-01"));
  assert.equal(loaded.warning, null);
  assert.deepEqual(storage.reads, [GYM_TURNOS_DEMO_STORAGE_KEY]);
  assert.equal(storage.writes.length, 0);
  assert.equal(persistGymTurnosDemoState(storage, fixture), null);
  assert.deepEqual(storage.writes.map(([key]) => key), [GYM_TURNOS_DEMO_STORAGE_KEY]);
  assert.equal(storage.values.get(boxKey), "box-bytes", "the BOX key is never touched");
  assert.equal(storage.values.get(gymAccessKey), "gym-access-bytes", "GYM access's own key is never touched");

  const failure = loadGymTurnosDemoState({ getItem() { throw new Error("denied"); }, setItem() { throw new Error("no write"); } }, anchor, fixture);
  assert.equal(failure.state, fixture);
  assert.match(failure.warning, /No se pudo leer/);

  assert.equal(loadGymTurnosDemoState(null, anchor, fixture).warning, "El almacenamiento de esta pestaña no está disponible; los cambios no se conservarán.");
  assert.equal(persistGymTurnosDemoState(null, fixture), "El almacenamiento de esta pestaña no está disponible; los cambios no se conservarán.");

  const throwingWrite = { getItem() { return null; }, setItem() { throw new Error("quota"); } };
  assert.match(persistGymTurnosDemoState(throwingWrite, fixture), /No se pudieron guardar/);
});

test("a malformed persisted value falls back to a fresh fixture with a warning, never destructively", () => {
  const storage = memoryStorage({ [GYM_TURNOS_DEMO_STORAGE_KEY]: "{not json" });
  const loaded = loadGymTurnosDemoState(storage, anchor, fixture);
  assert.equal(loaded.state, fixture);
  assert.match(loaded.warning, /no es válido/);
  assert.equal(storage.writes.length, 0, "a failed load never writes back a repaired value");
});

test("the closed-shape validator rejects an extra own key at every level of the graph, even a non-enumerable one", () => {
  assert.equal(isValidGymTurnosDemoState({ ...fixture, extraTopLevel: true }), false);
  assert.equal(
    isValidGymTurnosDemoState({ ...fixture, actors: fixture.actors.map((actor, index) => (index === 0 ? { ...actor, extra: "x" } : actor)) }),
    false,
  );
  assert.equal(
    isValidGymTurnosDemoState({ ...fixture, activities: fixture.activities.map((activity, index) => (index === 0 ? { ...activity, extra: "x" } : activity)) }),
    false,
  );
  assert.equal(
    isValidGymTurnosDemoState({ ...fixture, slots: fixture.slots.map((slot, index) => (index === 0 ? { ...slot, extra: "x" } : slot)) }),
    false,
  );
  assert.equal(
    isValidGymTurnosDemoState({ ...fixture, sessions: fixture.sessions.map((session, index) => (index === 0 ? { ...session, extra: "x" } : session)) }),
    false,
  );
  assert.equal(
    isValidGymTurnosDemoState({ ...fixture, bookings: fixture.bookings.map((booking, index) => (index === 0 ? { ...booking, extra: "x" } : booking)) }),
    false,
  );
  assert.equal(
    isValidGymTurnosDemoState({ ...fixture, enrollments: fixture.enrollments.map((enrollment, index) => (index === 0 ? { ...enrollment, extra: "x" } : enrollment)) }),
    false,
  );

  const smuggled = { ...fixture.actors[0] };
  Object.defineProperty(smuggled, "hidden", { value: "x", enumerable: false });
  assert.equal(
    isValidGymTurnosDemoState({ ...fixture, actors: [smuggled, ...fixture.actors.slice(1)] }),
    false,
    "a non-enumerable own key must still be caught by Reflect.ownKeys, not Object.keys",
  );
});

test("a staff actor's accountKind is null, not undefined, so it survives a storage round-trip", () => {
  const raw = serializeGymTurnosDemoState(fixture);
  const restored = resolveGymTurnosDemoInitialState(raw, anchor).state;
  const admin = restored.actors.find((actor) => actor.role === "ADMIN");
  assert.equal(admin.accountKind, null);
  assert.equal(Reflect.ownKeys(admin).includes("accountKind"), true);
});

test("double-booking, double-enrollment, and duplicate-occurrence uniqueness are independently re-derived by the validator", () => {
  const firstBooking = fixture.bookings[0];
  const duplicateSessionStudent = {
    ...fixture,
    bookings: [...fixture.bookings, { ...firstBooking, id: "booking-forged-duplicate" }],
  };
  assert.equal(isValidGymTurnosDemoState(duplicateSessionStudent), false);

  const firstEnrollment = fixture.enrollments[0];
  const duplicateSlotStudent = {
    ...fixture,
    enrollments: [...fixture.enrollments, { ...firstEnrollment, id: "enrollment-forged-duplicate" }],
  };
  assert.equal(isValidGymTurnosDemoState(duplicateSlotStudent), false);

  const firstSession = fixture.sessions[0];
  const duplicateSlotDate = {
    ...fixture,
    sessions: [...fixture.sessions, { ...firstSession, id: "session-forged-duplicate" }],
  };
  assert.equal(isValidGymTurnosDemoState(duplicateSlotDate), false);
});

test("a session's confirmed booking count may never exceed its capacity snapshot", () => {
  const spinning = fixture.sessions.find((session) => session.activityId === "activity-spinning");
  const overCapacity = {
    ...fixture,
    sessions: fixture.sessions.map((session) => (session.id === spinning.id ? { ...session, capacity: 1 } : session)),
  };
  assert.equal(isValidGymTurnosDemoState(overCapacity), false, "3 confirmed bookings must not fit inside capacity 1");
});
