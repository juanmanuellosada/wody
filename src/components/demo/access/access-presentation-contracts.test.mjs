import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const repositoryRoot = new URL("../../../../", import.meta.url);
const source = (file) => readFile(new URL(file, repositoryRoot), "utf8");

function importSpecifiers(file, content) {
  const ast = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
  return ast.statements.flatMap((statement) => {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      return [];
    }
    return [statement.moduleSpecifier.text];
  });
}

function localImportPath(from, specifier) {
  if (specifier.startsWith("@/")) return `src/${specifier.slice(2)}`;
  if (specifier.startsWith(".")) return path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
  return null;
}

async function sourceGraph(entry) {
  const pending = [entry];
  const visited = new Map();
  while (pending.length > 0) {
    const file = pending.pop();
    if (visited.has(file)) continue;
    const candidates = file.endsWith(".ts") || file.endsWith(".tsx")
      ? [file]
      : [`${file}.ts`, `${file}.tsx`, `${file}/index.ts`, `${file}/index.tsx`];
    let resolved = null;
    let content = null;
    for (const candidate of candidates) {
      try {
        content = await source(candidate);
        resolved = candidate;
        break;
      } catch {
        // A bare package import is not a repository graph edge.
      }
    }
    if (!resolved || content === null) continue;
    visited.set(resolved, content);
    for (const specifier of importSpecifiers(resolved, content)) {
      const next = localImportPath(resolved, specifier);
      if (next) pending.push(next);
    }
  }
  return visited;
}

test("live KioskView keeps its public props and all QR, polling, date, and toast lifecycle ownership", async () => {
  const kiosk = await source("src/components/access/KioskView.tsx");

  assert.match(kiosk, /gymSlug: string;/);
  assert.match(kiosk, /initialQrSvg: string;/);
  assert.match(kiosk, /initialQrExpiresInMs: number;/);
  assert.match(kiosk, /router\.refresh\(\),\s*initialQrExpiresInMs \+ 100/);
  assert.match(kiosk, /setQrSvg\(initialQrSvg\)/);
  assert.match(kiosk, /`\/api\/ingresos\/pending\?date=\$\{encodeURIComponent\(selectedDate\)\}`/);
  assert.match(kiosk, /\{ cache: "no-store" \}/);
  assert.match(kiosk, /setInterval\(tick, 2000\)/);
  assert.match(kiosk, /cancelled = true;\s*clearInterval\(interval\);/s);
  assert.match(kiosk, /lastSeenRecentIdRef\.current = null;\s*setToast\(null\);/s);
  assert.match(kiosk, /setTimeout\(\(\) => setToast\(null\), 3000\)/);
  assert.match(kiosk, /dangerouslySetInnerHTML=\{\{ __html: qrSvg \}\}/);
  assert.match(kiosk, /onSelectedDateChange=\{setSelectedDate\}/);
  assert.match(kiosk, /onDecideCheckin=\{decideCheckin\}/);
  assert.match(kiosk, /onLookupForKiosk=\{lookupForKiosk\}/);
  assert.match(kiosk, /onCreateManualCheckin=\{createManualCheckin\}/);
});

test("shared kiosk presentation preserves callback arguments, manual auto-grant, cancellation, errors, and pending controls", async () => {
  const view = await source("src/components/access/AccessKioskView.tsx");

  assert.match(view, /onDecideCheckin\(log\.id, decision\)/);
  assert.match(view, /onLookupForKiosk\(trimmed\)/);
  assert.match(view, /onCreateManualCheckin\(res\.user\.id, "GRANT"\)/);
  assert.match(view, /onCreateManualCheckin\(looked\.id, decision\)/);
  assert.match(view, /setLooked\(null\);\s*setInput\(""\);\s*setError\(null\);/s);
  assert.match(view, /if \(!res\.success\) \{\s*setError\(res\.error\);/s);
  assert.match(view, /disabled=\{isPending\}/);
  assert.match(view, /loading=\{isPending\}/);
  assert.match(view, /No hay ingresos pendientes\./);
  assert.match(view, /Todavía no hay ingresos hoy\./);
  assert.match(view, /Ingreso manual/);
  assert.match(view, /border border-brand-red\/30 bg-brand-red\/5 p-4 flex flex-col gap-3/);
});

test("history page retains every gate and exact bounded Prisma query before serializing DTO dates", async () => {
  const page = await source("src/app/[gymSlug]/ingresos/historial/page.tsx");

  assert.match(page, /const \{ gymSlug \} = await params;/);
  assert.match(page, /if \(!hasAccessControl\(gymSlug\)\) notFound\(\);/);
  assert.match(page, /isPersonalGym\(session\.user\.gymKind\)/);
  assert.match(page, /session\.user\.role !== "ACCESS" && session\.user\.role !== "ADMIN"/);
  assert.match(page, /if \(!session\.user\.gymId\)/);
  assert.match(page, /where: \{ gymId: session\.user\.gymId \}/);
  assert.match(page, /orderBy: \{ at: "desc" \}/);
  assert.match(page, /take: 200/);
  for (const field of ["id", "at", "state", "decidedAt", "user", "decidedBy"]) {
    assert.match(page, new RegExp(`${field}: true|${field}: \\{`));
  }
  assert.match(page, /at: log\.at\.toISOString\(\)/);
  assert.match(page, /decidedAt: log\.decidedAt\?\.toISOString\(\) \?\? null/);
  assert.match(page, /<AccessHistoryTable/);
});

test("shared views are AST-checked pure presentation modules with only safe runtime dependencies", async () => {
  const files = [
    "src/components/access/AccessKioskView.tsx",
    "src/components/access/AccessHistoryTable.tsx",
    "src/components/access/access-view-contracts.ts",
  ];
  const forbidden = /@\/actions\/|@\/lib\/(auth|prisma|checkin|gym)|next\/navigation|\/api\/|qrcode|zxing|router|dangerouslySetInnerHTML/i;

  for (const file of files) {
    const content = await source(file);
    const imports = importSpecifiers(file, content);
    assert.doesNotMatch(content, forbidden, file);
    assert.ok(imports.every((specifier) => !forbidden.test(specifier)), file);
  }

  const kioskImports = importSpecifiers(
    "src/components/access/AccessKioskView.tsx",
    await source("src/components/access/AccessKioskView.tsx"),
  );
  assert.deepEqual(
    kioskImports.sort(),
    [
      "./access-view-contracts",
      "@/components/ui/Button",
      "@/components/ui/DatePicker",
      "@/lib/dates",
      "@/lib/memberNumber",
      "react",
    ].sort(),
  );

  const graph = await sourceGraph("src/components/access/AccessKioskView.tsx");
  for (const [file, content] of graph) assert.doesNotMatch(content, forbidden, file);
  assert.equal([...graph.keys()].includes("src/components/access/access-view-contracts.ts"), true);

  const contracts = await source("src/components/access/access-view-contracts.ts");
  assert.match(contracts, /SUPERADMIN/);
  assert.match(contracts, /AccessPendingUser[\s\S]*role: "ADMIN" \| "TEACHER" \| "STUDENT" \| "ACCESS"/);
});

test("current demo access graph cannot reach live kiosk, actions, API, auth, Prisma, QR, camera, or router modules", async () => {
  const graph = await sourceGraph("src/components/demo/access/access-demo-adapters.ts");
  const graphText = [...graph.entries()].map(([file, content]) => `${file}\n${content}`).join("\n");

  assert.doesNotMatch(graphText, /KioskView|@\/actions\/access|\/api\/ingresos|@\/lib\/(auth|prisma|checkin)|qrcode|zxing|next\/navigation/i);
  assert.equal([...graph.keys()].some((file) => file.includes("src/components/access/")), false);
});

test("history table preserves presentation labels, Argentina time, formatters, and Auto versus em-dash fallback", async () => {
  const table = await source("src/components/access/AccessHistoryTable.tsx");

  assert.match(table, /Historial de ingresos/);
  assert.match(table, /Todavía no hay ingresos registrados\./);
  assert.match(table, /\["Fecha", "Hora", "Nº", "Alumno", "Estado", "Decidió"\]/);
  assert.match(table, /formatDateArg\(at\)/);
  assert.match(table, /formatMemberNumber\(log\.user\.memberNumber\)/);
  assert.match(table, /timeZone: "America\/Argentina\/Buenos_Aires"/);
  assert.match(table, /log\.decidedBy\?\.name \?\? \(log\.state === "GRANTED" \? "Auto" : "—"\)/);
  assert.match(table, /border border-line overflow-x-auto/);
});
