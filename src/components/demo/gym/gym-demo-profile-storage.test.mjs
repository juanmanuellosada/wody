import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  createGymDemoProfileJournalFixture,
  prepareGymDemoProfileJournalCommand,
  stageGymDemoProfileJournal,
} from "./gym-demo-profile-journal.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { GYM_DEMO_ADMIN_ID, GYM_DEMO_MUSLIB_STUDENT_ID, GYM_DEMO_PERSONALIZED_STUDENT_ID } from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getGymDemoProfileActorToken } from "./gym-demo-profile-core.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  GYM_DEMO_PROFILE_STORAGE_KEY,
  deserializeGymDemoProfileJournal,
  loadGymDemoProfileJournal,
  persistGymDemoProfileJournal,
  restoreGymDemoProfileJournal,
  serializeGymDemoProfileJournal,
} from "./gym-demo-profile-storage.ts";

const admin = getGymDemoProfileActorToken(GYM_DEMO_ADMIN_ID);

function storageSpy(entries = {}) {
  const values = new Map(Object.entries(entries));
  const reads = [];
  const writes = [];
  return {
    values,
    reads,
    writes,
    storage: {
      getItem(key) { reads.push(key); return values.get(key) ?? null; },
      setItem(key, value) { writes.push([key, value]); values.set(key, value); },
    },
  };
}

function stagedJournal() {
  const initial = createGymDemoProfileJournalFixture();
  const prepared = prepareGymDemoProfileJournalCommand(initial, {
    type: "SET_TYPE",
    actorToken: admin,
    input: { studentId: GYM_DEMO_PERSONALIZED_STUDENT_ID, studentType: "GENERAL" },
  });
  assert.equal(prepared.success, true);
  const staged = stageGymDemoProfileJournal(initial, prepared.ticket);
  assert.equal(staged.success, true);
  return staged.journal;
}

test("serializes and restores a detached journal with pending intent bytes stable", () => {
  const journal = stagedJournal();
  const bytes = serializeGymDemoProfileJournal(journal);
  const restored = deserializeGymDemoProfileJournal(bytes);
  assert.equal(restored.source, "stored");
  assert.equal(restored.warning, null);
  assert.equal(restored.raw, bytes);
  assert.deepEqual(restored.journal, JSON.parse(bytes));
  assert.equal(serializeGymDemoProfileJournal(restored.journal), bytes);
  restored.journal.pendingGroupDetaches.length = 0;
  assert.equal(restoreGymDemoProfileJournal(bytes).journal.pendingGroupDetaches.length, 1);
});

test("restore preserves the corrupt/absent/stored classification instead of collapsing it into an indistinguishable journal (finding 3)", () => {
  const fixture = createGymDemoProfileJournalFixture();

  const corrupt = restoreGymDemoProfileJournal("{bad");
  assert.equal(corrupt.source, "corrupt");
  assert.deepEqual(corrupt.journal, fixture);

  const absent = restoreGymDemoProfileJournal(null);
  assert.equal(absent.source, "absent");
  assert.deepEqual(absent.journal, fixture);

  const journal = stagedJournal();
  const stored = restoreGymDemoProfileJournal(serializeGymDemoProfileJournal(journal));
  assert.equal(stored.source, "stored");
  assert.deepEqual(stored.journal, journal);
});

test("only null is absent; blank, malformed, foreign, unknown, and invalid profile timestamp bytes are corrupt detached fallbacks", () => {
  const fixture = createGymDemoProfileJournalFixture();
  assert.deepEqual(deserializeGymDemoProfileJournal(null), { journal: fixture, warning: null, source: "absent", raw: null });
  const foreign = JSON.stringify({ ...fixture, namespace: "wody-box-profile-journal" });
  const badTimestamp = JSON.parse(JSON.stringify(fixture));
  badTimestamp.profileState.students[0].blockedAt = "2030-02-30T12:00:00.000Z";
  for (const raw of [undefined, "", " \n\t", "{bad", "[]", foreign, JSON.stringify({ ...fixture, version: 2 }), JSON.stringify({ ...fixture, actor: "forged" }), JSON.stringify(badTimestamp)]) {
    const recovered = deserializeGymDemoProfileJournal(raw);
    assert.equal(recovered.source, "corrupt");
    assert.match(recovered.warning ?? "", /no es válido/i);
    assert.equal(recovered.raw, raw);
    assert.deepEqual(recovered.journal, fixture);
    assert.notEqual(recovered.journal, fixture);
  }
});

test("a journal persisted under the pre-fix version-1 seed (nobody blocked, nobody exempt) is rejected on load and falls back to the fresh fixture, not silently resurrected", () => {
  const fresh = createGymDemoProfileJournalFixture();
  // Simulates exactly what a pre-fix tab would have persisted before GYM_DEMO_PROFILE_VERSION moved to
  // 2: the same envelope shape, but the OLD embedded profile-state version and the OLD all-clear seed
  // (blockedAt: null / paymentExempt: false for every student, including the two the new seed narrates).
  const staleProfileState = {
    ...fresh.profileState,
    version: 1,
    students: fresh.profileState.students.map((student) => ({ ...student, blockedAt: null, paymentExempt: false, paymentExemptReason: null })),
  };
  const staleJournal = { ...fresh, profileState: staleProfileState };
  const raw = JSON.stringify(staleJournal);

  const recovered = deserializeGymDemoProfileJournal(raw);
  assert.equal(recovered.source, "corrupt");
  assert.match(recovered.warning ?? "", /no es válido/i);
  assert.equal(recovered.raw, raw);
  assert.deepEqual(recovered.journal, fresh);

  // Sanity: the fallback actually carries the CURRENT narrative seed, not just "some" valid fixture -
  // this is what proves the regression cannot come back through a stale persisted journal.
  const personalized = recovered.journal.profileState.students.find((student) => student.id === GYM_DEMO_PERSONALIZED_STUDENT_ID);
  const muslib = recovered.journal.profileState.students.find((student) => student.id === GYM_DEMO_MUSLIB_STUDENT_ID);
  assert.notEqual(personalized?.blockedAt, null);
  assert.equal(muslib?.paymentExempt, true);
  assert.equal(muslib?.paymentExemptReason, "Beca de demostración");

  // Same rejection through the storage-reading path (loadGymDemoProfileJournal), not just deserialize.
  const { storage } = storageSpy({ [GYM_DEMO_PROFILE_STORAGE_KEY]: raw });
  const loaded = loadGymDemoProfileJournal(storage);
  assert.equal(loaded.source, "corrupt");
  assert.deepEqual(loaded.journal, fresh);
});

test("load reads exactly the owned journal key, never writes, prunes, acknowledges, or probes unrelated ledger sentinels", () => {
  const sentinels = {
    "wody-box-finance-demo-v1": "box-finance",
    "wody-box-finance-demo-v2": "box-finance-2",
    "wody-box-finance-demo-v3": "box-finance-3",
    "wody-gym-finance-demo-v1": "gym-finance",
    "wody-gym-training-demo-v1": "training",
    "wody-gym-fixed-routines-demo-v1": "fixed",
    "wody-gym-rms-demo-v1": "rms",
    "wody-access-demo-v1": "access",
    "wody-turnos-demo-v1": "turnos",
  };
  const { storage, reads, writes, values } = storageSpy(sentinels);
  const loaded = loadGymDemoProfileJournal(storage);
  assert.equal(loaded.source, "absent");
  assert.deepEqual(reads, [GYM_DEMO_PROFILE_STORAGE_KEY]);
  assert.deepEqual(writes, []);
  assert.deepEqual(loaded.journal.pendingGroupDetaches, []);
  for (const [key, value] of Object.entries(sentinels)) assert.equal(values.get(key), value, key);
});

test("corrupt storage is not actionably stored: bytes are retained, only the owned key is read, and no fallback is written", () => {
  const { storage, reads, writes, values } = storageSpy({ [GYM_DEMO_PROFILE_STORAGE_KEY]: " " });
  const loaded = loadGymDemoProfileJournal(storage);
  assert.equal(loaded.source, "corrupt");
  assert.equal(loaded.raw, " ");
  assert.match(loaded.warning ?? "", /no es válido/i);
  assert.deepEqual(reads, [GYM_DEMO_PROFILE_STORAGE_KEY]);
  assert.deepEqual(writes, []);
  assert.equal(values.get(GYM_DEMO_PROFILE_STORAGE_KEY), " ");
});

test("persist validates before any IO and writes only the owned key from a private snapshot", () => {
  const { storage, reads, writes } = storageSpy({ "wody-box-finance-demo-v3": "box bytes" });
  const journal = stagedJournal();
  assert.equal(persistGymDemoProfileJournal(storage, journal), null);
  assert.deepEqual(reads, []);
  assert.deepEqual(writes.map(([key]) => key), [GYM_DEMO_PROFILE_STORAGE_KEY]);

  const invalid = JSON.parse(JSON.stringify(journal));
  invalid.pendingGroupDetaches[0].revision = 0;
  assert.match(persistGymDemoProfileJournal(storage, invalid) ?? "", /no válido/i);
  assert.equal(writes.length, 1);

  let gets = 0;
  const source = new Proxy(journal, {
    get() { gets += 1; throw new Error("must not read original"); },
    ownKeys(target) { return Reflect.ownKeys(target); },
    getOwnPropertyDescriptor(target, key) { return Reflect.getOwnPropertyDescriptor(target, key); },
  });
  assert.equal(persistGymDemoProfileJournal(storage, source), null);
  assert.equal(gets, 0);
  assert.equal(writes.length, 2);
});

test("unavailable, read, and quota errors are generic warnings with no payload leak or fallback write", () => {
  const journal = createGymDemoProfileJournalFixture();
  const absent = loadGymDemoProfileJournal(null);
  assert.equal(absent.source, "unavailable");
  assert.match(absent.warning ?? "", /no está disponible/i);
  assert.match(persistGymDemoProfileJournal(null, journal) ?? "", /no está disponible/i);
  const readFailure = {
    getItem() { throw new Error("private raw bytes"); },
    setItem() { throw new Error("quota private bytes"); },
  };
  const loaded = loadGymDemoProfileJournal(readFailure);
  assert.equal(loaded.source, "unavailable");
  assert.match(loaded.warning ?? "", /No se pudo leer/i);
  assert.match(persistGymDemoProfileJournal(readFailure, journal) ?? "", /No se pudieron guardar/i);
});
