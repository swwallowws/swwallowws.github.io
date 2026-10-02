// Wait for the newest CI run of each repo's main to finish, then print one line per
// repo and exit non-zero if any failed. For "push, then make sure CI is green".
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

// The newest run on main, or the run for `sha`; waits for it to appear after a push.
async function latest(repo) {
  for (let i = 0; i < 20; i++) {
    const runs = gh("run", "list", "--repo", repo, "--branch", "main", "--limit", "10",
      "--json", "databaseId,headSha,status,conclusion,workflowName,displayTitle,url,createdAt");
    const pick = sha ? runs.find((r) => r.headSha.startsWith(sha)) : runs[0];
    if (pick) return pick;
    await sleep(5000);
  }
  return null;
}

let failed = 0;
const pending = new Map();
for (const repo of repos) pending.set(repo, await latest(repo));
while ([...pending.values()].some((r) => r && r.status !== "completed")) {
  await sleep(20000);
  for (const [repo, run] of pending) {
    if (!run || run.status === "completed") continue;
    try {
      pending.set(repo, { ...run, ...gh("run", "view", String(run.databaseId), "--repo", repo, "--json", "status,conclusion") });
    } catch { /* a network blip: ask again next round */ }
  }
}
for (const [repo, run] of pending) {
  if (!run) { console.log(`?    ${repo}: no run found`); failed++; continue; }
  const ok = run.conclusion === "success";
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${repo}: ${run.workflowName} "${run.displayTitle}" ${run.conclusion}${ok ? "" : `  ${run.url}`}`);
}
process.exitCode = failed ? 1 : 0;
