// Fail when a recorded picture shows an older product than the live one: the
// loops kept in each project's repo (media/), and any showcase shot naming a site.
// Compares each entry in visuals/sources.json (written when the picture was
// recorded, see scripts/sources.mjs) with the live site's version.json, and checks
// that every recipe naming a `site` has an entry. Runs in CI on every push and daily.
//   node scripts/check-visuals.mjs
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { liveVersion, readSources } from "./sources.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const loops = JSON.parse(readFileSync(join(root, "visuals/loops.json"), "utf8")).loops;
const shots = JSON.parse(readFileSync(join(root, "visuals/manifest.json"), "utf8")).shots;
const sources = readSources();

// Every picture that says which site it shows, and how to re-record it.
const expected = [
  ...loops.filter((l) => l.site).map((l) => ({ key: `${l.project}/loop`, site: l.site, redo: `node scripts/loops.mjs ${l.project}` })),
  ...shots.filter((s) => s.site).map((s) => ({ key: `${s.project}/${s.name}`, site: s.site, redo: `npm run visuals -- ${s.project}` })),
];

const problems = [];
for (const { key, site, redo } of expected) {
  const had = sources[key];
  if (!had) { problems.push(`${key}: never recorded against ${site}: ${redo}`); continue; }
  let live;
  try { live = await liveVersion(site); } catch (e) { problems.push(`${key}: ${e.message}`); continue; }
  if (live.content !== had.content) {
    problems.push(`${key}: ${site} changed since the picture (${had.recorded}, build ${had.commit.slice(0, 7)} -> ${live.commit.slice(0, 7)}): ${redo}`);
  } else {
    console.log(`ok   ${key} (${site}, recorded ${had.recorded})`);
  }
}
if (problems.length) {
  console.error(`\n${problems.length} picture(s) out of date:\n- ${problems.join("\n- ")}`);
  process.exitCode = 1;
}
