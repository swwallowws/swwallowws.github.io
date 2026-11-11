import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  plan, run, MEDIA, eachProject, withoutFailed, whenBranchExists, readHandoff, mediaFiles, sourcesWith, pictureNames,
} from "../scripts/refresh-visuals.mjs";

const live = (site: string) => ({ "https://a/": { content: "new", commit: "c2" }, "https://b/": { content: "same", commit: "c1" } })[site];
const loop = (project: string, site: string, extra = {}) => ({ project, site, url: site, show: [], ...extra });

test("a picture whose site moved on is redone; one that matches is left alone", () => {
  const loops = [loop("starling", "https://a/"), loop("rearranged", "https://b/")];
  const sources = { "starling/loop": { content: "old" }, "rearranged/loop": { content: "same" } };
  const p = plan(loops, sources, live);
  assert.deepEqual(p.redo.map((r) => r.project), ["starling"]);
  assert.deepEqual(p.manual, []);
});

test("a picture never recorded is redone", () => {
  const p = plan([loop("starling", "https://b/")], {}, live);
  assert.deepEqual(p.redo.map((r) => r.project), ["starling"]);
});

test("a recipe CI can't record (a local server, or a file outside the repo) is listed for a person", () => {
  const loops = [
    loop("coming-undone", "https://a/", { url: "http://localhost:8002/" }),
    loop("ready-set", "https://a/", { show: [{ upload: "#file", file: "../tabridge/x.gp" }] }),
  ];
  const p = plan(loops, {}, live);
  assert.deepEqual(p.redo, []);
  assert.deepEqual(p.manual.map((m) => m.project), ["coming-undone", "ready-set"]);
  assert.match(p.manual[0].why, /local server/);
  assert.match(p.manual[1].why, /outside the showcase/);
});

test("a command whose output goes straight to the log (stdio inherit) runs without a crash", () => {
  // execFileSync returns null when nothing is piped; the re-record steps run this way.
  assert.equal(run(process.execPath, ["--version"], { stdio: "inherit" }), "");
  assert.match(run(process.execPath, ["--version"]), /^v\d+/);
});

test("one project failing doesn't stop the others; its error is kept with the token hidden", () => {
  const redo = [{ project: "starling" }, { project: "rearranged" }, { project: "ready-set" }];
  const ran: string[] = [];
  const quiet = console.error;
  console.error = () => {};
  try {
    const { done, failed } = eachProject(redo, (r) => {
      ran.push(r.project);
      if (r.project === "rearranged") throw new Error("git clone https://x-access-token:SECRET@github.com/x.git: not found");
    }, (s) => s.split("SECRET").join("***"));
    assert.deepEqual(ran, ["starling", "rearranged", "ready-set"]);
    assert.deepEqual(done.map((r) => r.project), ["starling", "ready-set"]);
    assert.deepEqual(failed.map((f) => f.project), ["rearranged"]);
    assert.doesNotMatch(failed[0].error, /SECRET/);
    assert.match(failed[0].error, /\*\*\*/);
  } finally {
    console.error = quiet;
  }
});

test("a failed project's sources entry goes back to what it was, or away if it had none", () => {
  const before = { "starling/loop": { content: "s0" }, "rearranged/loop": { content: "r0" } };
  const now = { "starling/loop": { content: "s1" }, "rearranged/loop": { content: "r1" }, "ready-set/loop": { content: "y1" } };
  const out = withoutFailed(now, before, [{ project: "rearranged" }, { project: "ready-set" }]);
  assert.deepEqual(out, { "rearranged/loop": { content: "r0" }, "starling/loop": { content: "s1" } });
  assert.deepEqual(now["rearranged/loop"], { content: "r1" }, "the input is left alone");
});

test("a failing command's error never carries the token", () => {
  const was = process.env.VISUALS_PR_TOKEN;
  process.env.VISUALS_PR_TOKEN = "tok_SECRET123";
  try {
    assert.throws(
      () => run(process.execPath, ["--no-such-flag", "https://x-access-token:tok_SECRET123@github.com/x.git"], { stdio: "ignore" }),
      (e: Error) => !e.message.includes("tok_SECRET123") && e.message.includes("***"),
    );
  } finally {
    if (was === undefined) delete process.env.VISUALS_PR_TOKEN;
    else process.env.VISUALS_PR_TOKEN = was;
  }
});

test("a branch already pushed counts only with a live or landed pull request; without one it gets opened", () => {
  assert.equal(whenBranchExists("OPEN"), "skip");
  assert.equal(whenBranchExists("MERGED"), "skip");
  assert.equal(whenBranchExists(""), "open");
  assert.throws(() => whenBranchExists("CLOSED"), /closed without landing/);
});

// The propose job holds the token and reads a hand-off written by a job that ran npm packages.
// These hold that a tampered hand-off can't pick a repo, a branch, a path or a file.

const hash16 = "0123456789abcdef";
const sha = "0bff58027853a394e3670c5009c6b88d140f409b";
const handoff = (done: unknown[], failed: unknown[] = []) => JSON.stringify({ done, failed });

test("a hand-off of known projects and hashes reads back as just those fields", () => {
  const h = readHandoff(handoff([{ project: "rearranged", content: hash16, commit: sha, repo: "evil/x", branch: "main" }], [{ project: "starling", error: "x".repeat(5000) }]));
  assert.deepEqual(h.done, [{ project: "rearranged", content: hash16, commit: sha }]);
  assert.equal(h.failed[0].error.length, 2000);
});

test("a hand-off that names anything but a known project and two hashes is refused", () => {
  const bad: [string, string][] = [
    [handoff([{ project: "not-a-product", content: hash16, commit: sha }]), "unknown project"],
    [handoff([{ project: "__proto__", content: hash16, commit: sha }]), "unknown project"],
    [handoff([{ project: "rearranged", content: "../../.github/workflows/x", commit: sha }]), "content isn't a hash"],
    [handoff([{ project: "rearranged", content: `${hash16} main`, commit: sha }]), "content isn't a hash"],
    [handoff([{ project: "rearranged", content: hash16, commit: "HEAD" }]), "commit isn't a hash"],
    [handoff([{ project: "rearranged", content: hash16, commit: sha }, { project: "rearranged", content: hash16, commit: sha }]), "twice"],
    [JSON.stringify({ done: "all" }), "isn't {done, failed}"],
    [JSON.stringify([]), "isn't {done, failed}"],
  ];
  for (const [text, why] of bad) assert.throws(() => readHandoff(text), new RegExp(why), text);
});

test("a hand-off's pictures are taken only by their known names, and never through a link", () => {
  const dir = mkdtempSync(join(tmpdir(), "handoff-test-"));
  const pics = join(dir, "pictures", "rearranged");
  mkdirSync(join(pics, ".github", "workflows"), { recursive: true });
  writeFileSync(join(pics, "loop-paper.mp4"), "video");
  writeFileSync(join(pics, "lab-night.png"), "still");
  writeFileSync(join(pics, ".github", "workflows", "ci.yml"), "jobs: {}");
  writeFileSync(join(pics, "evil.sh"), "echo");
  writeFileSync(join(dir, "secret.txt"), "not a picture");
  symlinkSync(join(dir, "secret.txt"), join(pics, "loop-night.mp4"));
  const files = mediaFiles(dir, "rearranged");
  assert.deepEqual(files.map(([, to]) => to), ["media/loop-paper.mp4", "media/lab-night.png"]);
  for (const [, to] of files) assert.ok(pictureNames(MEDIA.rearranged.still).includes(to.slice("media/".length)));
});

test("sources entries are rebuilt from this checkout's site and the hand-off's hashes", () => {
  const before = { "starling/loop": { site: "s", content: "old", commit: "c", recorded: "2026-11-01" }, "rearranged/loop": { site: "r", content: "r0", commit: "c0", recorded: "2026-11-01" } };
  const out = sourcesWith(before, [{ project: "rearranged", content: hash16, commit: sha }], (p: string) => `https://site/${p}/`, "2026-11-11");
  assert.deepEqual(Object.keys(out), ["rearranged/loop", "starling/loop"]);
  assert.deepEqual(out["rearranged/loop"], { site: "https://site/rearranged/", content: hash16, commit: sha, recorded: "2026-11-11" });
  assert.deepEqual(out["starling/loop"], before["starling/loop"]);
});

test("the script loads only Node's own modules at the top, so --propose runs no npm package", () => {
  const src = readFileSync(new URL("../scripts/refresh-visuals.mjs", import.meta.url), "utf8");
  const statics = [...src.matchAll(/^import\s[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
  assert.ok(statics.length > 0);
  for (const from of statics) assert.match(from, /^node:/, from);
  const dynamics = [...src.matchAll(/await import\(["']([^"']+)["']\)/g)].map((m) => m[1]);
  assert.deepEqual(dynamics, ["./sources.mjs"], "only record() loads sources.mjs");
  assert.match(src, /async function record\([^]*?await import\("\.\/sources\.mjs"\)[^]*?\n}\n/, "and only inside record()");
});

test("every loop project has a repo and a still name for its media/", () => {
  for (const project of ["starling", "rearranged", "ready-set", "coming-undone"]) {
    assert.ok(MEDIA[project]?.repo.startsWith("swwallowws/"), project);
    assert.ok(MEDIA[project].still, project);
  }
});
