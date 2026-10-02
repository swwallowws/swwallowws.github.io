// Which build of each product the showcase's pictures show.
//
// Every tool site publishes version.json ({commit, content}) with each deploy:
// `content` fingerprints what a visitor sees. When scripts/loops.mjs or
// scripts/visuals.mjs records a picture of a product, it keeps the live site's
// fingerprint in visuals/sources.json; scripts/check-visuals.mjs (CI, daily) then
// fails when a live site has moved on since, so a picture never quietly shows an
// older product.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
export const SOURCES = join(root, "visuals/sources.json");

export function readSources() {
  return existsSync(SOURCES) ? JSON.parse(readFileSync(SOURCES, "utf8")) : {};
}

/** The live site's {commit, content}, from `${site}version.json`. */
export async function liveVersion(site) {
  const res = await fetch(new URL("version.json", site), { cache: "no-store" });
  if (!res.ok) throw new Error(`${site}version.json: ${res.status}`);
  return res.json();
}

/** Note that `key` (e.g. "voxmpe/loop") was just recorded from what `site` serves now. */
export async function recordSource(key, site) {
  const v = await liveVersion(site);
  const all = readSources();
  all[key] = { site, content: v.content, commit: v.commit, recorded: new Date().toISOString().slice(0, 10) };
  const sorted = Object.fromEntries(Object.keys(all).sort().map((k) => [k, all[k]]));
  writeFileSync(SOURCES, JSON.stringify(sorted, null, 2) + "\n");
  return all[key];
}
