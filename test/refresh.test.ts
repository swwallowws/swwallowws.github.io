import { test } from "node:test";
import assert from "node:assert/strict";
import { plan, MEDIA } from "../scripts/refresh-visuals.mjs";

const live = (site: string) => ({ "https://a/": { content: "new", commit: "c2" }, "https://b/": { content: "same", commit: "c1" } })[site];
const loop = (project: string, site: string, extra = {}) => ({ project, site, url: site, show: [], ...extra });

test("a picture whose site moved on is redone; one that matches is left alone", () => {
  const loops = [loop("voxmpe", "https://a/"), loop("rearranged", "https://b/")];
  const sources = { "voxmpe/loop": { content: "old" }, "rearranged/loop": { content: "same" } };
  const p = plan(loops, sources, live);
  assert.deepEqual(p.redo.map((r) => r.project), ["voxmpe"]);
  assert.deepEqual(p.manual, []);
});

test("a picture never recorded is redone", () => {
  const p = plan([loop("voxmpe", "https://b/")], {}, live);
  assert.deepEqual(p.redo.map((r) => r.project), ["voxmpe"]);
});

test("a recipe CI can't record (a local server, or a file outside the repo) is listed for a person", () => {
  const loops = [
    loop("stemscribe", "https://a/", { url: "http://localhost:8002/" }),
    loop("tabridge", "https://a/", { show: [{ upload: "#file", file: "../tabridge/x.gp" }] }),
  ];
  const p = plan(loops, {}, live);
  assert.deepEqual(p.redo, []);
  assert.deepEqual(p.manual.map((m) => m.project), ["stemscribe", "tabridge"]);
  assert.match(p.manual[0].why, /local server/);
  assert.match(p.manual[1].why, /outside the showcase/);
});

test("every loop project has a repo and a still name for its media/", () => {
  for (const project of ["voxmpe", "rearranged", "tabridge", "stemscribe"]) {
    assert.ok(MEDIA[project]?.repo.startsWith("swwallowws/"), project);
    assert.ok(MEDIA[project].still, project);
  }
});
