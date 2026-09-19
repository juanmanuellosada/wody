import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (name) => readFile(new URL(`./${name}`, import.meta.url), "utf8");

test("all production pricing callers use the production request boundary", async () => {
  const [contactForm, pricing, personalPricing, productionForm] = await Promise.all([
    source("ContactForm.tsx"),
    source("PricingSection.tsx"),
    source("PersonalPricingSection.tsx"),
    source("ProductionContactForm.tsx"),
  ]);

  assert.match(contactForm, /\{ mode: "preview"; submitRequest\?: never \}/);
  assert.match(contactForm, /\{ mode\?: "production"; submitRequest: SubmitRequest \}/);
  assert.doesNotMatch(contactForm, /if \(!submitRequest\)/);
  assert.match(pricing, /<ProductionContactForm onClose=\{\(\) => setOpen\(false\)\} \/>/);
  assert.match(personalPricing, /<ProductionContactForm onClose=\{\(\) => setOpen\(false\)\} formType="PERSONAL" \/>/);
  assert.match(productionForm, /fetch\("\/api\/signup-request"/);
});

test("the preview is the only simulated submission path", async () => {
  const [previewLanding, contactForm, productionForm] = await Promise.all([
    source("PreviewLanding.tsx"),
    source("ContactForm.tsx"),
    source("ProductionContactForm.tsx"),
  ]);

  assert.match(previewLanding, /<ContactForm onClose=\{onClose\} formType=\{formType\} mode="preview" \/>/);
  assert.match(contactForm, /if \(props\.mode === "preview"\)/);
  assert.match(contactForm, /successHeadingRef\.current\?\.focus\(\)/);
  assert.match(contactForm, /!dialogRef\.current\.contains\(document\.activeElement\)/);
  assert.doesNotMatch(previewLanding, /fetch\(|\/api\/|ProductionContactForm/);
  assert.match(productionForm, /mode="production"/);
});

test("preview does not render a floating unavailable contact control", async () => {
  const landingExperience = await source("LandingExperience.tsx");

  assert.match(landingExperience, /!formType && !isPreview/);
  assert.doesNotMatch(landingExperience, /Contacto no disponible en la demo/);
});
