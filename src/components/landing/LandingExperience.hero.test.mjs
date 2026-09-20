import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

const demoAssets = [
  "./assets/wody-demo-pagos-desktop.webp",
  "./assets/wody-demo-pagos-mobile.webp",
];

test("hero presents the manual seven-day request flow and real demo route", async () => {
  const landing = await source("./LandingExperience.tsx");

  assert.match(landing, /<h1 className=\{styles\.heroHeading\}>Tu gimnasio organizado: cuotas, turnos y rutinas en un solo lugar\.<\/h1>/);
  assert.match(landing, /<button type="button" className=\{styles\.primaryButton\} onClick=\{\(\) => setFormType\("GYM"\)\}>Solicitar una prueba de 7 días<\/button>/);
  assert.match(landing, /href=\{appHref\("\/demo"\)\}>Ver demo<\/a>/);
  assert.match(landing, /7 días · sin tarjeta · activación manual/);
  assert.match(landing, /href=\{appHref\("\/registro-personal"\)\}>Usalo por tu cuenta<\/a>/);
});

test("hero uses static, responsive payment-demo evidence without a live demo tree", async () => {
  const [landing, css, readme, ...assets] = await Promise.all([
    source("./LandingExperience.tsx"),
    source("./LandingExperience.module.css"),
    source("./assets/README.md"),
    ...demoAssets.map((asset) => readFile(new URL(asset, import.meta.url))),
  ]);

  assert.match(landing, /wody-demo-pagos-desktop\.webp/);
  assert.match(landing, /wody-demo-pagos-mobile\.webp/);
  assert.match(landing, /<picture className=\{styles\.demoPicture\}>/);
  assert.match(landing, /media="\(min-width: 700px\)"/);
  assert.match(landing, /srcSet=\{demoPagosDesktop\.src\} width=\{1440\} height=\{608\}/);
  assert.match(landing, /src=\{demoPagosMobile\}[\s\S]*width=\{390\}[\s\S]*height=\{1004\}[\s\S]*unoptimized/);
  assert.match(landing, /Vista de demostración con datos ficticios\. No corresponde a un centro real\./);
  assert.match(landing, /href=\{appHref\("\/demo\/admin\/pagos"\)\}/);
  assert.doesNotMatch(landing, /demoPagosData|<iframe|DemoPagos/);
  assert.match(css, /\.demoPicture \{[^}]*aspect-ratio: 390 \/ 1004/);
  assert.match(css, /\.demoPicture \{ aspect-ratio: 1440 \/ 608; \}/);
  assert.match(readme, /fixture-only/i);
  assert.match(readme, /non-interactive/i);

  for (const asset of assets) {
    assert.equal(asset.subarray(0, 4).toString(), "RIFF");
    assert.equal(asset.subarray(8, 12).toString(), "WEBP");
    assert.ok(asset.byteLength > 20_000);
  }

  for (const assetPath of demoAssets) assert.ok((await stat(new URL(assetPath, import.meta.url))).size > 20_000);
});
