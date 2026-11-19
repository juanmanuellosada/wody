import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("PERSONAL provider owns exactly the two isolated ledgers and hydrates both before callbacks exist", async () => {
  const [provider, trainingStorage] = await Promise.all([
    source("src/components/demo/personal/DemoPersonalProvider.tsx"),
    source("src/components/demo/training/personal-training-demo-storage.ts"),
  ]);
  assert.match(trainingStorage, /PERSONAL_TRAINING_DEMO_STORAGE_KEY = "wody-personal-training-demo-v1"/);
  assert.match(provider, /PERSONAL_RMS_DEMO_STORAGE_KEY = "wody-personal-rms-demo-v1"/);
  assert.match(provider, /const restoredTraining = loadPersonalTrainingDemoState\(storage\);\s*const restoredRms = loadPersonalRms\(storage\);[\s\S]*callbacksRef\.current =/);
  assert.match(provider, /training: createPersonalTrainingCallbackFactory/);
  assert.match(provider, /rms: createDemoRmCallbackFactory/);
  assert.match(provider, /kind: "PERSONAL", ownerIds: \[PERSONAL_DEMO_OWNER_ID\]/);
  assert.match(provider, /callbacksRef\.current\?\.training\.cancelPending\(\);\s*callbacksRef\.current\?\.rms\.cancelPending\(\)/);
  assert.match(provider, /setResetEpoch\(\(epoch\) => epoch \+ 1\)/);
  assert.doesNotMatch(provider, /DemoFinanceProvider|DemoAccessProvider|DemoTrainingProvider|wody-box-|wody-turnos-/);
});

test("PERSONAL routes use shared views with detached own projections and no live operational graph", async () => {
  const [training, rms, billing] = await Promise.all([
    source("src/components/demo/personal/DemoPersonalTrainingRoute.tsx"),
    source("src/components/demo/personal/DemoPersonalRms.tsx"),
    source("src/components/demo/personal/DemoPersonalBilling.tsx"),
  ]);
  assert.match(training, /WodManagerView/);
  assert.match(training, /lockedTarget=\{lockedTarget\}/);
  assert.match(training, /groups=\{\[\]\}/);
  assert.match(training, /students=\{\[\]\}/);
  assert.doesNotMatch(training, /WodManagerClient|onCopy=|TargetSelector/);
  assert.match(rms, /RmsView/);
  assert.match(rms, /rmCore\.projectRms\(rmsState, rmToken\)/);
  assert.match(billing, /PersonalBillingPageView/);
  assert.match(billing, /Demo — sin cobros ni redirecciones/);
  assert.match(billing, /initPoint: ""/);
  assert.match(billing, /if \(initPoint !== ""\) return/);
  for (const value of [training, rms, billing]) {
    const runtimeSource = value.replace(/^import type .*$/gm, "");
    assert.doesNotMatch(runtimeSource, /@\/actions|next\/navigation|router\.|window\.|fetch\s*\(|location\.|localStorage|sessionStorage|mpPreapprovalId|initPointURL/);
  }
});
