// Re-records the pictures of products that changed, and proposes them as pull requests.
//
// For each loop in visuals/loops.json whose live site has moved on since its picture
// (visuals/sources.json, see scripts/sources.mjs), this re-records the loop
// (scripts/loops.mjs) and the README stills (scripts/stills.mjs) from the live site,
// then opens one pull request on the product's repo (its media/) and one on the
// showcase (visuals/sources.json). A person merges them after a look.
//
// One project failing (say, a repo the token can't reach) doesn't stop the others: they
// are still proposed, the failed one stays out of sources.json and the run ends red.
//
// Recipes CI can't record (a local server, or a file outside this repo) are listed
// for a person instead: `node scripts/loops.mjs <project>` by hand, as before.
//
// Runs in .github/workflows/refresh-visuals.yml every few hours, in two jobs, so the token
// never meets the npm packages recording needs (any one of them could read it):
//   node scripts/refresh-visuals.mjs --record DIR    re-records, writes a hand-off in DIR. No token.
//   node scripts/refresh-visuals.mjs --propose DIR   proposes from the hand-off. Needs
//     VISUALS_PR_TOKEN (Contents and Pull requests write on the product repos and this one)
//     and loads nothing outside Node itself.
// The hand-off comes from a job that ran npm packages, so --propose trusts only a known project
// and two hashes from it, and builds every repo, branch, file name, title, body and sources
// entry itself (readHandoff, mediaFiles, sourcesWith).
// With neither flag it does both in one go, for a run by hand:
//   node scripts/refresh-visuals.mjs [--dry-run]
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

/** Where each project's recorded pictures go: its repo, and its README still's name. */
export const MEDIA = {
  starling: { repo: "swwallowws/starling", still: "studio" },
  rearranged: { repo: "swwallowws/rearranged", still: "lab" },
  "ready-set": { repo: "swwallowws/ready-set", still: "site" },
  "coming-undone": { repo: "swwallowws/coming-undone", still: "full" },
};
const SHOWCASE = "swwallowws/swwallowws.github.io";

/** The files a project's media/ gets, by the names its README uses. */
export const pictureNames = (still) => [
  "loop-paper.mp4", "loop-night.mp4", "loop-paper.gif", "loop-night.gif", "loop-paper.png", "loop-night.png",
  `${still}-paper.png`, `${still}-night.png`,
];

/** Why CI can't record this recipe itself, or null when it can. */
function blocker(loop) {
  if (/^https?:\/\/(localhost|127\.0\.0\.1)/.test(loop.url)) return "needs its local server";
  const steps = [...(loop.setup ?? []), ...(loop.show ?? [])];
  if (steps.some((s) => s.upload && String(s.file).startsWith(".."))) return "uploads a file from outside the showcase repo";
  return null;
}

/**
 * Which pictures to redo. `liveOf(site)` gives the site's current {content, commit}.
 * Returns {redo: [{project, site, live}], manual: [{project, why}]}.
 */
export function plan(loops, sources, liveOf) {
  const redo = [];
  const manual = [];
  for (const loop of loops.filter((l) => l.site)) {
    const live = liveOf(loop.site);
    const had = sources[`${loop.project}/loop`];
    if (had && live && had.content === live.content) continue;
    const why = blocker(loop);
    if (why) manual.push({ project: loop.project, why: `${loop.site} changed, but its recipe ${why}: run node scripts/loops.mjs ${loop.project} by hand` });
    else redo.push({ project: loop.project, site: loop.site, live });
  }
  return { redo, manual };
}

/** `s` with VISUALS_PR_TOKEN masked: clone and push URLs carry it, and a failed command's error repeats its arguments. */
export function hideToken(s) {
  const token = process.env.VISUALS_PR_TOKEN;
  return token ? String(s).split(token).join("***") : String(s);
}

/**
 * Runs a command and gives its trimmed output, or "" when it went straight to the log
 * (stdio: "inherit"). A failure throws with the token masked.
 */
export function run(cmd, args, opts = {}) {
  let out;
  try {
    out = execFileSync(cmd, args, { stdio: ["ignore", "pipe", "inherit"], encoding: "utf8", ...opts });
  } catch (e) {
    throw new Error(hideToken(e?.message ?? e));
  }
  return (out ?? "").trim();
}

/**
 * What to do when a proposal's branch is already pushed, from the state of the pull request
 * on it ("" for none): an open or landed one stands. A branch whose pull request never
 * opened (the push worked, `gh pr create` didn't) gets one now. A closed one fails, since
 * nothing would land those pictures.
 */
export function whenBranchExists(state) {
  if (state === "OPEN" || state === "MERGED") return "skip";
  if (state === "CLOSED") throw new Error("its pull request was closed without landing");
  return "open";
}

/**
 * Runs `step(r)` for each picture to redo. One that throws (a repo the token can't reach,
 * a site that won't load) is logged and skipped, so the other projects still get proposed.
 * `hide` strips secrets from the logged error. Returns {done, failed: [{project, error}]}.
 */
export function eachProject(redo, step, hide = (s) => s) {
  const done = [];
  const failed = [];
  for (const r of redo) {
    try {
      step(r);
      done.push(r);
    } catch (e) {
      const error = hide(String(e?.message ?? e));
      console.error(`FAILED ${r.project}: ${error}`);
      failed.push({ project: r.project, error });
    }
  }
  return { done, failed };
}

/**
 * sources.json as recorded (`now`), with each failed project's loop entry put back to what
 * it was (`before`), or dropped if it had none. Recording a loop writes its entry even when
 * the media pull request then fails. The showcase must never claim a picture whose media
 * wasn't proposed. Keys come out sorted, as recordSource writes them.
 */
export function withoutFailed(now, before, failed) {
  const out = { ...now };
  for (const { project } of failed) {
    const key = `${project}/loop`;
    if (key in before) out[key] = before[key];
    else delete out[key];
  }
  return Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
}

/**
 * The hand-off from --record, read for --propose. Throws unless it's {done, failed} with each
 * done project one of MEDIA's, once, and its content and commit hashes. Failed entries are only
 * logged, so they're cut to short strings.
 */
export function readHandoff(text) {
  const h = JSON.parse(text);
  if (!h || typeof h !== "object" || !Array.isArray(h.done) || !Array.isArray(h.failed)) {
    throw new Error("the hand-off isn't {done, failed}");
  }
  const done = h.done.map((d) => {
    if (!d || typeof d !== "object" || !Object.hasOwn(MEDIA, d.project)) {
      throw new Error(`the hand-off names an unknown project: ${JSON.stringify(d?.project ?? d).slice(0, 80)}`);
    }
    if (typeof d.content !== "string" || !/^[0-9a-f]{8,64}$/.test(d.content)) throw new Error(`the hand-off's ${d.project} content isn't a hash`);
    if (typeof d.commit !== "string" || !/^[0-9a-f]{7,40}$/.test(d.commit)) throw new Error(`the hand-off's ${d.project} commit isn't a hash`);
    return { project: d.project, content: d.content, commit: d.commit };
  });
  if (new Set(done.map((d) => d.project)).size !== done.length) throw new Error("the hand-off names a project twice");
  const failed = h.failed.map((f) => ({ project: String(f?.project ?? "?").slice(0, 80), error: String(f?.error ?? "").slice(0, 2000) }));
  return { done, failed };
}

/** The pictures in the hand-off for `project`: its known names only, regular files only (no links). */
export function mediaFiles(dir, project) {
  return pictureNames(MEDIA[project].still)
    .map((n) => [join(dir, "pictures", project, n), `media/${n}`])
    .filter(([from]) => existsSync(from) && lstatSync(from).isFile());
}

/**
 * sources.json as it is (`before`) with a fresh loop entry for each project proposed, built from
 * this checkout's site for it and the hand-off's hashes. Keys come out sorted, as recordSource
 * writes them.
 */
export function sourcesWith(before, proposed, siteOf, today) {
  const out = { ...before };
  for (const d of proposed) out[`${d.project}/loop`] = { site: siteOf(d.project), content: d.content, commit: d.commit, recorded: today };
  return Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
}

/** Commits `files` ([from, to-in-repo]) to a new branch of `repo` and opens a pull request. */
function propose(repo, branch, files, title, body) {
  const token = process.env.VISUALS_PR_TOKEN;
  if (!token) throw new Error("VISUALS_PR_TOKEN is not set");
  const url = `https://x-access-token:${token}@github.com/${repo}.git`;
  const gh = { env: { ...process.env, GH_TOKEN: token } };
  const openPr = () => console.log(`${repo}: ${run("gh", ["pr", "create", "--repo", repo, "--head", branch, "--base", "main", "--title", title, "--body", body], gh)}`);
  if (run("git", ["ls-remote", "--heads", url, branch])) {
    const state = run("gh", ["pr", "list", "--repo", repo, "--head", branch, "--state", "all", "--json", "state", "--jq", '.[0].state // ""'], gh);
    if (whenBranchExists(state) === "skip") console.log(`${repo}: ${branch} already proposed (${state.toLowerCase()})`);
    else openPr();
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), "visuals-"));
  run("git", ["clone", "--quiet", "--depth", "1", url, dir]);
  run("git", ["-C", dir, "checkout", "-q", "-b", branch]);
  for (const [from, to] of files) copyFileSync(from, join(dir, to));
  run("git", ["-C", dir, "add", ...files.map(([, to]) => to)]);
  if (!run("git", ["-C", dir, "status", "--porcelain"])) {
    console.log(`${repo}: pictures unchanged, nothing to propose`);
    return;
  }
  const who = ["-c", "user.name=github-actions[bot]", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com"];
  run("git", ["-C", dir, ...who, "commit", "-q", "-m", title]);
  run("git", ["-C", dir, "push", "-q", "origin", branch]);
  openPr();
}

/**
 * Re-records what changed and writes the hand-off to `out`: handoff.json ({done: [{project,
 * content, commit}], failed}) and pictures/<project>/<name>. Returns false on --dry-run.
 */
async function record(out, dry) {
  const { readSources, liveVersion, SOURCES } = await import("./sources.mjs");
  const before = readSources();
  const loops = JSON.parse(readFileSync(join(root, "visuals/loops.json"), "utf8")).loops;
  const versions = {};
  for (const site of new Set(loops.map((l) => l.site).filter(Boolean))) {
    try { versions[site] = await liveVersion(site); } catch (e) { console.error(`${site}: ${e.message}`); }
  }
  const { redo, manual } = plan(loops, before, (s) => versions[s]);
  for (const m of manual) console.log(`manual ${m.project}: ${m.why}`);
  if (redo.length) console.log(`redo: ${redo.map((r) => r.project).join(", ")}`);
  else console.log("every picture CI can record is up to date");
  if (dry) return false;

  const { done, failed } = eachProject(redo, (r) => {
    run("node", [join(root, "scripts/loops.mjs"), r.project], { stdio: "inherit" });
    run("node", [join(root, "scripts/stills.mjs"), r.project], { stdio: "inherit" });
    mkdirSync(join(out, "pictures", r.project), { recursive: true });
    for (const n of pictureNames(MEDIA[r.project].still)) {
      const from = join(root, ".local-visuals", r.project, n);
      if (existsSync(from)) copyFileSync(from, join(out, "pictures", r.project, n));
    }
  });
  // The hashes recordSource wrote for each recorded loop, which is what the pictures show. A
  // loop that left none counts as failed, so the hand-off only ever carries real hashes.
  const recorded = readSources();
  const handed = [];
  for (const r of done) {
    const entry = recorded[`${r.project}/loop`];
    if (entry?.content && entry?.commit && entry.content !== before[`${r.project}/loop`]?.content) {
      handed.push({ project: r.project, content: entry.content, commit: entry.commit });
    } else failed.push({ project: r.project, error: "recording left no new entry in sources.json" });
  }
  writeFileSync(SOURCES, JSON.stringify(withoutFailed(recorded, before, failed), null, 2) + "\n");
  const handoff = { done: handed, failed };
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "handoff.json"), JSON.stringify(handoff, null, 2) + "\n");
  return true;
}

/** Proposes everything in the hand-off at `dir`. Returns the failures, recording's included. */
function proposeAll(dir) {
  const { done, failed } = readHandoff(readFileSync(join(dir, "handoff.json"), "utf8"));
  for (const f of failed) console.error(`FAILED ${f.project}, while recording: ${f.error}`);
  const loops = JSON.parse(readFileSync(join(root, "visuals/loops.json"), "utf8")).loops;
  const siteOf = (project) => loops.find((l) => l.project === project)?.site ?? "its live site";
  const proposed = eachProject(done, (d) => {
    propose(MEDIA[d.project].repo, `visuals/${d.content}`, mediaFiles(dir, d.project), "README media: today's product",
      `The product changed since its README pictures were recorded (build ${d.commit.slice(0, 7)}), so the showcase re-recorded them from ${siteOf(d.project)}.\n\nLook at the loop and stills, then merge. Proposed by the showcase's refresh-visuals workflow.`);
  }, hideToken);
  const all = [...failed, ...proposed.failed];
  if (proposed.done.length) {
    const before = JSON.parse(readFileSync(join(root, "visuals/sources.json"), "utf8"));
    const sources = join(mkdtempSync(join(tmpdir(), "sources-")), "sources.json");
    writeFileSync(sources, JSON.stringify(sourcesWith(before, proposed.done, siteOf, new Date().toISOString().slice(0, 10)), null, 2) + "\n");
    const key = proposed.done.map((d) => d.content.slice(0, 8)).join("-");
    try {
      propose(SHOWCASE, `visuals/sources-${key}`, [[sources, "visuals/sources.json"]],
        "Pictures: record which builds they show",
        `Re-recorded: ${proposed.done.map((d) => d.project).join(", ")}. Merge together with the media pull requests on those repos.`);
    } catch (e) {
      all.push({ project: "showcase sources", error: hideToken(e?.message ?? e) });
    }
  }
  return all;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const after = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  const recordTo = after("--record");
  const proposeFrom = after("--propose");
  if ((args.includes("--record") && !recordTo) || (args.includes("--propose") && !proposeFrom)) {
    console.error("usage: node scripts/refresh-visuals.mjs [--record DIR | --propose DIR | --dry-run]");
    process.exit(2);
  }
  let failed = [];
  if (proposeFrom) failed = proposeAll(proposeFrom);
  else {
    const dir = recordTo ?? mkdtempSync(join(tmpdir(), "handoff-"));
    const recorded = await record(dir, args.includes("--dry-run"));
    // --record stops at the hand-off; its failures travel in it to --propose, which ends red.
    if (recorded && !recordTo) failed = proposeAll(dir);
  }
  if (failed.length) {
    console.error(`\n${failed.length} project(s) failed, the rest were proposed:`);
    for (const f of failed) console.error(`- ${f.project}: ${f.error}`);
    process.exit(1);
  }
}
