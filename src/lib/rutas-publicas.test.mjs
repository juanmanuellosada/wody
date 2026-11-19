import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

function quoted(block) {
  return [...block.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

/** robots.txt wildcards span slashes, so `/*​/admin` also matches `/demo/gym/admin`. */
function patternMatches(pattern, url) {
  const source = `^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$")}`;
  return new RegExp(source).test(url);
}

/** Google resolves conflicts by pattern length; an equal-length tie goes to allow. */
function crawlVerdict({ allow, disallow }, url) {
  const longest = (patterns) => patterns.filter((pattern) => patternMatches(pattern, url))
    .reduce((best, pattern) => Math.max(best, pattern.length), -1);
  const allowed = longest(allow);
  const denied = longest(disallow);
  return denied < 0 || allowed >= denied ? "allowed" : "disallowed";
}

test("every sitemap route stays crawlable under the robots rules", async () => {
  const [robots, rutas] = await Promise.all([read("src/app/robots.ts"), read("src/lib/rutas-publicas.ts")]);
  const allow = quoted(/allow:\s*(\[[^\]]*\]|"[^"]*")/.exec(robots)[1]);
  const disallow = quoted(/disallow:\s*\[([\s\S]*?)\]/.exec(robots)[1]);
  const sitemap = [...rutas.matchAll(/path:\s*"([^"]+)"/g)].map((match) => match[1]);

  assert.ok(sitemap.length > 0, "the sitemap route list must not be empty");
  assert.ok(disallow.length > 0, "the robots disallow list must not be empty");

  const blocked = sitemap.filter((route) => crawlVerdict({ allow, disallow }, route) === "disallowed");
  assert.deepEqual(blocked, [], `the sitemap declares routes that robots.txt blocks: ${blocked.join(", ")}`);
});

test("the tenant disallow patterns still block the gym routes they exist for", async () => {
  const robots = await read("src/app/robots.ts");
  const allow = quoted(/allow:\s*(\[[^\]]*\]|"[^"]*")/.exec(robots)[1]);
  const disallow = quoted(/disallow:\s*\[([\s\S]*?)\]/.exec(robots)[1]);

  for (const route of ["/mi-gimnasio/admin", "/mi-gimnasio/caja", "/mi-gimnasio/turnos", "/mi-gimnasio/cuotas"]) {
    assert.equal(crawlVerdict({ allow, disallow }, route), "disallowed", route);
  }
});
