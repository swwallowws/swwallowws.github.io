// Stills for each project's README (media/, beside the loops): the live product in
// use, in Paper and Night, at 1440 px wide (shown at 720 in the README, sharp on
// retina screens). Coming Undone's still comes from its loop's setup frame instead
// (scripts/loops.mjs), since a run needs its local server.
//   node scripts/stills.mjs [project]
// Out: .local-visuals/<project>/<name>-<theme>.png (gitignored; copied into the
// project's repo, media/).
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = fileURLToPath(new URL("..", import.meta.url));
const STILLS = [
  {
    project: "voxmpe", name: "studio", url: "https://swwallowws.github.io/starling/",
    go: async (p) => {
      await p.click("#sample-link");
      await p.waitForFunction(() => /\d+ notes/.test(document.getElementById("note-count")?.textContent || ""), null, { timeout: 90000 });
      await p.waitForTimeout(800);
    },
  },
  {
    project: "rearranged", name: "lab", url: "https://swwallowws.github.io/rearranged-web/new.html",
    go: async (p) => {
      const dir = join(root, "visuals/staging/rearranged");
      await p.setInputFiles("#song", join(dir, "song-a-house-of-the-rising-sun.mid"));
      await p.waitForSelector("#song-roles:not(.hidden)");
      await p.setInputFiles("#donor", join(dir, "bolero-song-b.mid"));
      await p.waitForSelector("#donor-roles:not(.hidden)");
      await p.setInputFiles("#parts", join(dir, "parts.json"));
      await p.waitForSelector("#parts-strip .seg");
      await p.click("#go");
      await p.waitForSelector("#switches button", { timeout: 120000 });
      await p.waitForTimeout(1500);
    },
  },
  {
    project: "tabridge", name: "site", url: "https://swwallowws.github.io/ready-set/",
    go: async (p) => {
      await p.setInputFiles("#file", join(root, "../tabridge/spike/gp_serenade/serenade.gp"));
      await p.waitForSelector("#preview:not([disabled])", { timeout: 30000 });
      await p.click("#preview");
      await p.waitForSelector("#player-host:not([hidden])", { timeout: 30000 });
      await p.waitForTimeout(1500);
    },
  },
];

const only = process.argv[2];
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
let failed = 0;
for (const s of STILLS.filter((x) => !only || x.project === only)) {
  for (const theme of ["paper", "night"]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: theme === "night" ? "dark" : "light" });
    try {
      await page.goto(`${s.url}?theme=${theme}`, { waitUntil: "networkidle", timeout: 30000 });
      await page.evaluate(() => document.fonts.ready);
      await s.go(page);
      const out = join(root, ".local-visuals", s.project);
      mkdirSync(out, { recursive: true });
      await page.screenshot({ path: join(out, `${s.name}-${theme}.png`) });
      console.log(`still  ${s.project}/${s.name}-${theme}.png`);
    } catch (e) {
      failed++;
      console.error(`${s.project} (${theme}): ${e.message.split("\n")[0]}`);
    }
    await page.close();
  }
}
await browser.close();
process.exitCode = failed ? 1 : 0;
