import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("standalone demo presentation stays truthful and scoped", async () => {
  const [banner, demoLayout, landingLayout, previewCss] = await Promise.all([
    source("src/components/DemoBanner.tsx"),
    source("preview/landing/app/demo/layout.tsx"),
    source("preview/landing/app/layout.tsx"),
    source("preview/landing/app/globals.css"),
  ]);

  assert.match(banner, /Modo demo — Sin cambios en datos reales/);
  assert.doesNotMatch(banner, /Los cambios no se guardan/);
  assert.match(demoLayout, /<div data-demo-root className="min-h-screen flex flex-col bg-black">/);
  assert.doesNotMatch(landingLayout, /data-demo-root/);

  assert.ok(
    previewCss.indexOf("@layer base, utilities;") < previewCss.indexOf('@import "tailwindcss/utilities" source(none);'),
    "the base reset must precede Tailwind utilities",
  );
  assert.match(
    previewCss,
    /@layer base \{\s*\[data-demo-root\] button \{\s*background-color: transparent;\s*border: 0 solid;\s*\}\s*\}/,
  );
});
