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
  assert.match(landing, /srcSet=\{demoPagosDesktop\.src\} width=\{1440\} height=\{800\}/);
  assert.match(landing, /src=\{demoPagosMobile\}[\s\S]*width=\{390\}[\s\S]*height=\{1470\}[\s\S]*unoptimized/);
  assert.match(landing, /Vista de demostración con datos ficticios\. No corresponde a un centro real\./);
  assert.match(landing, /href=\{appHref\("\/demo\/admin\/pagos"\)\}/);
  assert.doesNotMatch(landing, /demoPagosData|<iframe|DemoPagos/);
  assert.match(css, /\.demoPicture \{[^}]*aspect-ratio: 390 \/ 1470/);
  assert.match(css, /\.demoPicture \{ aspect-ratio: 1440 \/ 800; \}/);
  assert.match(readme, /fixture-only/i);
  assert.match(readme, /non-interactive/i);

  for (const asset of assets) {
    assert.equal(asset.subarray(0, 4).toString(), "RIFF");
    assert.equal(asset.subarray(8, 12).toString(), "WEBP");
    assert.ok(asset.byteLength > 20_000);
  }

  for (const assetPath of demoAssets) assert.ok((await stat(new URL(assetPath, import.meta.url))).size > 20_000);
});

/** WebP lossy header: width and height are 14-bit values at byte 26 and 28. */
function webpSize(buffer) {
  assert.equal(buffer.subarray(12, 16).toString(), "VP8 ", "expected a lossy WebP");
  return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
}

test("the shipped captures really have the dimensions the hero and its stylesheet declare", async () => {
  const [landing, css, desktop, mobile] = await Promise.all([
    source("./LandingExperience.tsx"),
    source("./LandingExperience.module.css"),
    ...demoAssets.map((asset) => readFile(new URL(asset, import.meta.url))),
  ]);

  const declared = {
    desktop: /srcSet=\{demoPagosDesktop\.src\} width=\{(\d+)\} height=\{(\d+)\}/.exec(landing),
    mobile: /src=\{demoPagosMobile\}[\s\S]*?width=\{(\d+)\}[\s\S]*?height=\{(\d+)\}/.exec(landing),
  };
  assert.ok(declared.desktop && declared.mobile, "the hero must declare both image sizes");

  assert.deepEqual(webpSize(desktop), { width: Number(declared.desktop[1]), height: Number(declared.desktop[2]) });
  assert.deepEqual(webpSize(mobile), { width: Number(declared.mobile[1]), height: Number(declared.mobile[2]) });

  // The stylesheet repeats those ratios, so a re-crop that updates only the markup letterboxes.
  const ratios = [...css.matchAll(/aspect-ratio: (\d+) \/ (\d+)/g)].map(([, w, h]) => `${w}/${h}`);
  assert.ok(ratios.includes(`${declared.mobile[1]}/${declared.mobile[2]}`), `mobile ratio missing from the stylesheet: ${ratios}`);
  assert.ok(ratios.includes(`${declared.desktop[1]}/${declared.desktop[2]}`), `desktop ratio missing from the stylesheet: ${ratios}`);
});
