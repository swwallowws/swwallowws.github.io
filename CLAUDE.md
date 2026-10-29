# showcase

Portfolio showcase site. Plain TypeScript and Vite, vanilla DOM (no framework),
the shared design system (`~/Playground/design`, synced via `sync.sh`).
Multi-page build: a welcome page plus one page per project.

## How the catalog works

- All catalog copy and slots live in `src/data/projects.ts`; the welcome
  page's wants list is `WANTS` in `src/ui/home.ts`.
- Empty slots (live demo, video, code) render as labelled placeholders
  ("video: coming", "code: public soon"). Filling one is a data change only.
- The site never hosts or links straight to downloadable files. It
  demonstrates the work and links out to where each product lives: its
  studio or website first, GitHub as the fallback (`get` in
  `src/data/projects.ts`).
- Project pages are story beats: a one-line lead, then short heading + text
  pairs, each with the visual that shows it: text on the left, visual on the
  right, on every page (a beat can opt out with `side: 'left'`).
- Brands appear as text badges only, never logos.

## Demos

- Each demo lives in its own project's repo, on its own page (e.g.
  `<project-site>/try/`), and is built and deployed from there. The showcase
  only holds its URL (`DEMOS` in `src/data/projects.ts`) and frames it.
- Demos are guided like a tutorial level in a game: a step rail beside the
  smallest live piece of the real product, one point per demo, each step
  lights up in turn and ticks itself off when done, free play at the end.
- Every demo is static, framable with `?embed=1` and `?theme=paper|night`,
  and on the design system.

## Checking and visuals

- Verify UI in Chrome (claude-in-chrome) when connected; otherwise
  `npm run peek -- <url> [hover-selector]`.
- `npm run visuals` captures shots from `visuals/manifest.json` and encodes
  raw recordings from `visuals/raw/<project>/`.
- Welcome-page carousel hooks (`visuals/raw/<project>/hook.mp4`) show the
  product itself and nothing else: crop its own panels out of a take (no
  captions, help text, desktop or other apps unless the product lives there,
  e.g. building into an Ableton Live set), re-lay them to fill the open band's
  near-square frame (rows that run across get stacked), and show the one
  flow that sells it. Cut them with `python3 scripts/hook.py
  visuals/edits/<project>-hook.json`, then `npm run visuals`.

See `CLAUDE.local.md` (not committed) for where private planning lives.
