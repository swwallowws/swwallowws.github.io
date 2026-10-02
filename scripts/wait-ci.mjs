// Wait for every workflow run on the newest commit of each repo's main (or on
// --sha) to finish, then print one line per run and exit non-zero if any failed.
// For "push, then make sure CI is green".
//   node scripts/wait-ci.mjs swwallowws/ready-set swwallowws/starling ...
//   node scripts/wait-ci.mjs --sha <commit> swwallowws/ready-set   (that commit's run)
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const shaAt = args.indexOf("--sha");
const sha = shaAt >= 0 ? args.splice(shaAt, 2)[1] : null;
const repos = args;
if (!repos.length) { console.error("usage: node scripts/wait-ci.mjs [--sha <commit>] <owner/repo>..."); process.exit(2); }

const gh = (...a) => JSON.parse(execFileSync("gh", a, { encoding: "utf8" }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Every run for the newest commit on main (or for `sha`); waits for them to appear after a push.
async function runsFor(repo) {
  for (let i = 0; i < 20; i++) {
    const runs = gh("run", "list", "--repo", repo, "--branch", "main", "--limit", "20",
      "--json", "databaseId,headSha,status,conclusion,workflowName,displayTitle,url");
    const head = sha ? runs.find((r) => r.headSha.startsWith(sha))?.headSha : runs[0]?.headSha;
    if (head) return runs.filter((r) => r.headSha === head).map((r) => ({ repo, ...r }));
    await sleep(5000);
  }
  return [{ repo, missing: true }];
}

let failed = 0;
const all = [];
for (const repo of repos) all.push(...(await runsFor(repo)));
while (all.some((r) => !r.missing && r.status !== "completed")) {
  await sleep(20000);
  for (const run of all) {
    if (run.missing || run.status === "completed") continue;
    try {
      Object.assign(run, gh("run", "view", String(run.databaseId), "--repo", run.repo, "--json", "status,conclusion"));
    } catch { /* a network blip: ask again next round */ }
  }
}
for (const run of all) {
  if (run.missing) { console.log(`?    ${run.repo}: no run found`); failed++; continue; }
  const ok = run.conclusion === "success";
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${run.repo}: ${run.workflowName} "${run.displayTitle}" ${run.conclusion}${ok ? "" : `  ${run.url}`}`);
}
process.exitCode = failed ? 1 : 0;
