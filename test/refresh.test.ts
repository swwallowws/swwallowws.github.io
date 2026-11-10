import { test } from "node:test";
import assert from "node:assert/strict";
import { plan, run, MEDIA, eachProject, withoutFailed, whenBranchExists } from "../scripts/refresh-visuals.mjs";

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

test("every loop project has a repo and a still name for its media/", () => {
  for (const project of ["starling", "rearranged", "ready-set", "coming-undone"]) {
    assert.ok(MEDIA[project]?.repo.startsWith("swwallowws/"), project);
    assert.ok(MEDIA[project].still, project);
  }
});
