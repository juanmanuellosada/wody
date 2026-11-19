import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getPersonalTrainingActorToken } from "../training/personal-training-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  calculatePersonalBillingDaysRemaining,
  getPersonalBillingDemoActorToken,
  PERSONAL_BILLING_DEMO_SCENARIOS,
  projectPersonalBillingDemoScenario,
  toPersonalBillingViewData,
} from "./personal-billing-demo.ts";

const NOW = new Date("2025-05-10T12:00:00.000Z");
const clock = () => new Date(NOW);
const actor = () => getPersonalBillingDemoActorToken();

test("the closed display-case enum projects deterministic fictional billing states", () => {
  assert.deepEqual(PERSONAL_BILLING_DEMO_SCENARIOS, [
    "trial", "trial-tomorrow", "trial-today", "trial-expired", "exempt",
    "authorized", "paused", "cancelled", "no-subscription",
  ]);
  assert.equal(Object.isFrozen(PERSONAL_BILLING_DEMO_SCENARIOS), true);

  const expectedTrials = new Map([
    ["trial", ["2025-05-17T12:00:00.000Z", 7]],
    ["trial-tomorrow", ["2025-05-11T12:00:00.000Z", 1]],
    ["trial-today", ["2025-05-10T12:00:00.000Z", 0]],
    ["trial-expired", ["2025-05-09T12:00:00.000Z", -1]],
  ]);
  for (const [scenario, [trialEndsAt, daysRemaining]] of expectedTrials) {
    assert.deepEqual(projectPersonalBillingDemoScenario(actor(), scenario, clock), {
      trialEndsAt,
      paymentExempt: false,
      paymentExemptReason: null,
      currentStatus: null,
      nextPaymentDate: null,
      hasSubscription: false,
      daysRemaining,
    });
  }

  assert.deepEqual(projectPersonalBillingDemoScenario(actor(), "exempt", clock), {
    trialEndsAt: null,
    paymentExempt: true,
    paymentExemptReason: "Cuenta de demostración exenta.",
    currentStatus: null,
    nextPaymentDate: null,
    hasSubscription: false,
    daysRemaining: null,
  });
  assert.deepEqual(projectPersonalBillingDemoScenario(actor(), "authorized", clock), {
    trialEndsAt: null,
    paymentExempt: false,
    paymentExemptReason: null,
    currentStatus: "authorized",
    nextPaymentDate: "2030-06-15T12:00:00.000Z",
    hasSubscription: true,
    daysRemaining: null,
  });
  for (const scenario of ["paused", "cancelled"]) {
    const projection = projectPersonalBillingDemoScenario(actor(), scenario, clock);
    assert.equal(projection.currentStatus, scenario);
    assert.equal(projection.hasSubscription, true);
    assert.equal(projection.nextPaymentDate, null);
  }
  assert.deepEqual(projectPersonalBillingDemoScenario(actor(), "no-subscription", clock), {
    trialEndsAt: null,
    paymentExempt: false,
    paymentExemptReason: null,
    currentStatus: null,
    nextPaymentDate: null,
    hasSubscription: false,
    daysRemaining: null,
  });
});

test("trial remaining days exactly match Math.ceil, including fractional expiry and negative zero", () => {
  assert.equal(calculatePersonalBillingDaysRemaining(new Date("2025-05-11T00:00:00.000Z"), new Date("2025-05-10T12:00:00.000Z")), 1);
  assert.equal(calculatePersonalBillingDaysRemaining(new Date("2025-05-10T18:00:00.000Z"), new Date("2025-05-10T12:00:00.000Z")), 1);
  const negativeZero = calculatePersonalBillingDaysRemaining(new Date("2025-05-10T06:00:00.000Z"), new Date("2025-05-10T12:00:00.000Z"));
  assert.equal(Object.is(negativeZero, -0), true);
  assert.equal(calculatePersonalBillingDaysRemaining(new Date("2025-05-09T12:00:00.000Z"), new Date("2025-05-10T12:00:00.000Z")), -1);
  assert.equal(calculatePersonalBillingDaysRemaining(new Date("invalid"), NOW), null);
});

test("only the existing opaque Personal capability reaches scenario, fixture, and clock reads", () => {
  let clockReads = 0;
  const hostileScenario = Object.defineProperty({}, "case", { enumerable: true, get() { throw new Error("scenario read"); } });
  const hostileActors = [
    { id: "personal-student-owner", role: "STUDENT", canCreateOwnRoutines: true },
    Object.freeze({}),
    new Proxy(actor(), {}),
    Proxy.revocable({}, {}).proxy,
  ];
  for (const hostileActor of hostileActors) {
    assert.equal(projectPersonalBillingDemoScenario(hostileActor, hostileScenario, () => { clockReads += 1; return NOW; }), null);
  }
  assert.equal(clockReads, 0);
  assert.equal(getPersonalBillingDemoActorToken(), getPersonalTrainingActorToken());
  assert.equal(Object.isFrozen(getPersonalBillingDemoActorToken()), true);

  assert.equal(projectPersonalBillingDemoScenario(actor(), hostileScenario, () => { clockReads += 1; return NOW; }), null);
  assert.equal(clockReads, 0);
  assert.equal(projectPersonalBillingDemoScenario(actor(), "unknown", () => { clockReads += 1; return NOW; }), null);
  assert.equal(clockReads, 0);
});

test("invalid clock inputs are cleanly rejected while trusted dependency failures remain observable", () => {
  for (const invalidClock of [null, undefined, {}, () => new Date("invalid"), () => new Date(9e15)]) {
    assert.equal(projectPersonalBillingDemoScenario(actor(), "trial", invalidClock), null);
  }
  assert.throws(() => projectPersonalBillingDemoScenario(actor(), "trial", () => { throw new Error("clock failed"); }), /clock failed/);
});

test("view adaptation keeps ISO time intact and returns fresh detached Date DTOs", () => {
  const projection = projectPersonalBillingDemoScenario(actor(), "trial", clock);
  const first = toPersonalBillingViewData(projection);
  const second = toPersonalBillingViewData(projection);
  assert.equal(first.trialEndsAt.toISOString(), "2025-05-17T12:00:00.000Z");
  assert.equal(first.trialEndsAt.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }), "17/5/2025");
  assert.notEqual(first.trialEndsAt, second.trialEndsAt);
  first.trialEndsAt.setUTCFullYear(2040);
  assert.equal(second.trialEndsAt.toISOString(), "2025-05-17T12:00:00.000Z");

  const authorized = projectPersonalBillingDemoScenario(actor(), "authorized", clock);
  const authorizedView = toPersonalBillingViewData(authorized);
  assert.equal(authorizedView.subscriptionNextPaymentDate.toISOString(), "2030-06-15T12:00:00.000Z");
  authorizedView.subscriptionNextPaymentDate.setUTCMonth(0);
  assert.equal(toPersonalBillingViewData(authorized).subscriptionNextPaymentDate.toISOString(), "2030-06-15T12:00:00.000Z");
});

test("the pure fixture model has no operational graph, provider identifiers, URLs, or persistence", () => {
  const source = readFileSync(new URL("./personal-billing-demo.ts", import.meta.url), "utf8");
  for (const forbidden of [
    /from\s+["'][^"']*actions\//, /next\/navigation/, /\bfetch\s*\(/, /window\s*\./,
    /location\s*\./, /localStorage|sessionStorage|indexedDB/, /@\/lib\/(auth|prisma)/,
    /mpPreapprovalId/, /https?:\/\//,
  ]) assert.doesNotMatch(source, forbidden);
  assert.match(source, /Demo — sin cobros ni redirecciones/);
});
