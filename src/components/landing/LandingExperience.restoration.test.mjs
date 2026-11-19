import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");
const previewSource = (path) => readFile(new URL(`../../../preview/landing/${path}`, import.meta.url), "utf8");

test("landing restores the original hero asset, role order, and account presentation", async () => {
  const [landing, page] = await Promise.all([source("./LandingExperience.tsx"), source("../../app/page.tsx")]);

  assert.match(landing, /wodyTexto/);
  assert.match(landing, /width=\{360\} height=\{100\}/);
  assert.equal((landing.match(/unoptimized=\{isPreview\}/g) ?? []).length, 2);
  const studentRole = landing.indexOf('["Ver rutina de hoy", "Historial completo", "Cargar y editar records", "Compartir logros"]');
  const teacherRole = landing.indexOf('["Cargar rutinas por alumno", "Copiar entre fechas y alumnos", "Editor con formato", "Gestión de alumnos"]');
  const adminRole = landing.indexOf('["Crear profes y alumnos", "Asignar alumnos a profes", "Panel de control", "Gestión completa"]');
  assert.ok(studentRole >= 0 && teacherRole > studentRole && adminRole > teacherRole);
  assert.match(landing, /highlight: true/);
  assert.doesNotMatch(landing, /ACCESS|SUPERADMIN/);
  assert.match(landing, /https:\/\/www\.instagram\.com\/wody\.app\//);
  assert.match(landing, /https:\/\/www\.instagram\.com\/marlocomunica\//);
  assert.match(landing, /https:\/\/wa\.me\/5491136178552/);
  for (const route of ["/software-gestion-gimnasios", "/control-de-acceso-gimnasio-qr", "/comparativa", "/blog", "/demo"]) assert.match(landing, new RegExp(route));
  assert.match(landing, /account\.logo/);
  assert.match(landing, /account\.primaryColor/);
  assert.match(page, /logo: true, primaryColor: true/);
});

test("static preview retains verified public accounts, coupons, external routes, and local simulation", async () => {
  const [preview, benefits, layout, globals] = await Promise.all([
    source("./PreviewLanding.tsx"),
    source("./PreviewBenefits.tsx"),
    previewSource("app/layout.tsx"),
    previewSource("app/globals.css"),
  ]);

  for (const [slug, name] of [["unidos-garage", "Unidos Garage CrossFit"], ["rompiendo-limites", "Rompiendo Limites CrossFit"], ["atlas-gym", "Atlas"], ["mila-fit", "Mila Fit"], ["unidos-gap", "Unidos - GAP"], ["fitclub", "FIT CLUB"]]) {
    assert.match(preview, new RegExp(`slug: "${slug}"`));
    assert.match(preview, new RegExp(`name: "${name}"`));
  }
  assert.equal((benefits.slice(benefits.indexOf("const coupons")).match(/title: /g) ?? []).length, 24);
  assert.match(benefits, /https:\/\/www\.wody\.com\.ar\//);
  assert.match(benefits, /2026-09-19T21:24:44-03:00/);
  assert.match(benefits, /\/\#benefits-login/);
  assert.doesNotMatch(benefits, /couponCode|code:/i);
  assert.match(layout, /Barlow_Condensed/);
  assert.match(layout, /Barlow/);
  assert.match(layout, /src\/app\/icon\.png/);
  assert.doesNotMatch(globals, /Arial|system-ui/);
  assert.doesNotMatch(preview, /ProductionContactForm|fetch\(|\/api\/|prisma|auth/);
});
