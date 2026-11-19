import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  getPersonalBillingDisplayBranch,
  isPausedOrCancelledSubscription,
  PERSONAL_BILLING_EMAIL_REGEX,
  trialHeadline,
} from "../../personal/personal-billing-view-contracts.ts";

test("shared billing branch contracts retain exempt precedence and all trial headlines", () => {
  assert.equal(getPersonalBillingDisplayBranch(true, "authorized"), "exempt");
  assert.equal(getPersonalBillingDisplayBranch(true, "paused"), "exempt");
  assert.equal(getPersonalBillingDisplayBranch(false, "authorized"), "authorized");
  for (const status of [null, "paused", "cancelled", "pending", ""])
    assert.equal(getPersonalBillingDisplayBranch(false, status), "subscribe");

  assert.equal(trialHeadline(null), "Tu suscripción");
  assert.equal(trialHeadline(7), "Tu trial termina en 7 días");
  assert.equal(trialHeadline(2), "Tu trial termina en 2 días");
  assert.equal(trialHeadline(1), "Tu trial termina mañana");
  assert.equal(trialHeadline(0), "Tu trial termina hoy");
  assert.equal(trialHeadline(-0), "Tu trial termina hoy");
  assert.equal(trialHeadline(-1), "Tu trial venció hace 1 días");
  assert.equal(trialHeadline(-3), "Tu trial venció hace 3 días");
});

test("paused and cancelled notices depend on a non-null subscription presence flag", () => {
  for (const status of ["paused", "cancelled"]) {
    assert.equal(isPausedOrCancelledSubscription(true, status), true);
    assert.equal(isPausedOrCancelledSubscription(false, status), false);
  }
  for (const status of [null, "authorized", "pending", ""])
    assert.equal(isPausedOrCancelledSubscription(true, status), false);
});

test("the shared view is free of live infrastructure while its wrapper preserves the public ID presence check", () => {
  const viewSource = readFileSync(new URL("../../personal/PersonalBillingPageView.tsx", import.meta.url), "utf8");
  const wrapperSource = readFileSync(new URL("../../personal/PersonalBillingPage.tsx", import.meta.url), "utf8");
  for (const forbidden of [
    /@\/actions\//, /next\/navigation/, /\buseRouter\b/, /\bfetch\s*\(/,
    /window\s*\./, /location\s*\./, /@\/lib\/(auth|prisma)/,
  ]) assert.doesNotMatch(viewSource, forbidden);
  assert.match(wrapperSource, /hasSubscription=\{mpPreapprovalId !== null\}/);
  assert.match(wrapperSource, /onCancelSubscription=\{cancelMySubscription\}/);
  assert.match(wrapperSource, /onSubscribe=\{subscribePersonal\}/);
  assert.match(wrapperSource, /toast\.success\("Suscripción cancelada\."\);\s*router\.refresh\(\);/);
  assert.match(wrapperSource, /window\.location\.href = initPoint/);
});

test("the exact client-side email validation remains trim-then-regex", () => {
  assert.equal(PERSONAL_BILLING_EMAIL_REGEX.toString(), "/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/");
  for (const email of ["person@example.com", "person+demo@example.co.uk"])
    assert.equal(PERSONAL_BILLING_EMAIL_REGEX.test(email.trim()), true);
  for (const email of ["", "   ", "person", "person@", "person@example", "person @example.com"])
    assert.equal(PERSONAL_BILLING_EMAIL_REGEX.test(email.trim()), false);
});
