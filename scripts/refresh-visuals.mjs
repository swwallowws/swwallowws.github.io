// Re-records the pictures of products that changed, and proposes them as pull requests.
//
// For each loop in visuals/loops.json whose live site has moved on since its picture
// (visuals/sources.json, see scripts/sources.mjs), this re-records the loop
// (scripts/loops.mjs) and the README stills (scripts/stills.mjs) from the live site,
// then opens one pull request on the product's repo (its media/) and one on the
// showcase (visuals/sources.json). A person merges them after a look.
//
// Recipes CI can't record (a local server, or a file outside this repo) are listed
// for a person instead: `node scripts/loops.mjs <project>` by hand, as before.
//
// Runs in .github/workflows/refresh-visuals.yml every few hours. Needs
// VISUALS_PR_TOKEN: a fine-grained token with Contents and Pull requests write on
// the product repos and this one.
//   node scripts/refresh-visuals.mjs [--dry-run]
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

/** Where each project's recorded pictures go: its repo, and its README still's name. */
export const MEDIA = {
  voxmpe: { repo: "swwallowws/starling", still: "studio" },
  rearranged: { repo: "swwallowws/rearranged", still: "lab" },
  tabridge: { repo: "swwallowws/ready-set", still: "site" },
  stemscribe: { repo: "swwallowws/coming-undone", still: "full" },
};
const SHOWCASE = "swwallowws/swwallowws.github.io";

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

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { stdio: ["ignore", "pipe", "inherit"], encoding: "utf8", ...opts }).trim();
}

/** Commits `files` ([from, to-in-repo]) to a new branch of `repo` and opens a pull request. */
function propose(repo, branch, files, title, body) {
  const token = process.env.VISUALS_PR_TOKEN;
  if (!token) throw new Error("VISUALS_PR_TOKEN is not set");
  const url = `https://x-access-token:${token}@github.com/${repo}.git`;
  if (run("git", ["ls-remote", "--heads", url, branch])) {
    console.log(`${repo}: ${branch} already proposed`);
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
  const pr = run("gh", ["pr", "create", "--repo", repo, "--head", branch, "--base", "main", "--title", title, "--body", body],
    { env: { ...process.env, GH_TOKEN: token } });
  console.log(`${repo}: ${pr}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dry = process.argv.includes("--dry-run");
  const { readSources, liveVersion } = await import("./sources.mjs");
  const loops = JSON.parse(readFileSync(join(root, "visuals/loops.json"), "utf8")).loops;
  const versions = {};
  for (const site of new Set(loops.map((l) => l.site).filter(Boolean))) {
    try { versions[site] = await liveVersion(site); } catch (e) { console.error(`${site}: ${e.message}`); }
  }
  const { redo, manual } = plan(loops, readSources(), (s) => versions[s]);
  for (const m of manual) console.log(`manual ${m.project}: ${m.why}`);
  if (!redo.length) { console.log("every picture CI can record is up to date"); process.exit(0); }
  console.log(`redo: ${redo.map((r) => r.project).join(", ")}`);
  if (dry) process.exit(0);

  for (const r of redo) {
    run("node", [join(root, "scripts/loops.mjs"), r.project], { stdio: "inherit" });
    run("node", [join(root, "scripts/stills.mjs"), r.project], { stdio: "inherit" });
    const { repo, still } = MEDIA[r.project];
    const names = ["loop-paper.mp4", "loop-night.mp4", "loop-paper.png", "loop-night.png", `${still}-paper.png`, `${still}-night.png`];
    const files = names.map((n) => [join(root, ".local-visuals", r.project, n), `media/${n}`]).filter(([from]) => existsSync(from));
    propose(repo, `visuals/${r.live.content}`, files, "README media: today's product",
      `The product changed since its README pictures were recorded (build ${r.live.commit.slice(0, 7)}), so the showcase re-recorded them from ${r.site}.\n\nLook at the loop and stills, then merge. Proposed by the showcase's refresh-visuals workflow.`);
  }
  const key = redo.map((r) => r.live.content.slice(0, 8)).join("-");
  propose(SHOWCASE, `visuals/sources-${key}`, [[join(root, "visuals/sources.json"), "visuals/sources.json"]],
    "Pictures: record which builds they show",
    `Re-recorded: ${redo.map((r) => r.project).join(", ")}. Merge together with the media pull requests on those repos.`);
}
