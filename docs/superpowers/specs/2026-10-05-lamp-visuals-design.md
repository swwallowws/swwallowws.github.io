# The lamp: showcase visuals made of strings

Date: 2026-10-05. Status: draft for review.

## Why

The showcase's visuals are screenshots of each tool's studio: file names,
piano rolls, knobs and buttons. They read as technical, and they invite clicks
that do nothing: a musician friend, given a minute with the site, went straight
for the knobs in YSAD's picture. The welcome page already patches this with a
"preview" tag; this design replaces the cause.

Who it is for: musicians and producers (who know music but not MIDI files or
piano rolls), music-tech peers (Ableton, SoundBoost and the like, who should
find it musical rather than cold), and everyone else, who should get what each
tool does in a second.

## What changes, in one paragraph

Every project's visual becomes a live card drawn in strings. At rest, the
strings are the music as a musician knows it (a voice, a song, a lead sheet, a
beat). A soft light under the pointer, **the lamp**, pulls the strings it
touches taut into what the tool makes of them, and shows what lies beneath.
Clicking plays it: the card sounds, and everything the playhead passes turns,
then relaxes back. Studio screenshots and recorded loops leave the showcase and
go to each project's README.

## Principles

1. **One material: strings.** Hairlines in the design system's ink, nothing
   else. No dots, outlines, knobs, buttons or drawn controls, so nothing looks
   clickable that is not. Shapes (a hit, a clip, a lane) are made by the strings
   themselves: fanning, gathering, straightening.
2. **One physics: rest and taut.** Each string has a rest form and a taut form;
   everything that happens is a blend between the two (eased, no springs, no
   wobble).
3. **Text lives only in the lamp.** No fixed labels at the edges of a card.
   The lamp names what it is over, beside the pointer; while playing, a short
   label rides with the playhead. Text that is part of the music itself (lyrics,
   chord symbols, hashtags) may sit on the strings, and moves with them.
4. **Colour means "the tool at work".** Strings at rest are muted ink; taut,
   they take the category accent (`--acc`), or the drum colours where drums are
   shown. Paper and Night both work from the tokens.
5. **Simple over clever.** Each card shows one transformation, as plainly as
   possible. When in doubt, take a layer away.

## The lamp

- A soft radial light with a feathered edge and no outline: a radius of 180 px
  on desktop, at most a third of the card's width on narrow cards.
- Inside it, strings blend toward taut by distance from the centre, and the
  card's backdrop (what lies beneath: a staff, clips, a ring's step marks) shows
  through, fading at the edge.
- When the pointer leaves, or rests for 2.5 s, the lamp wanders slowly along
  the music on its own, so the card is never still and the effect is
  discoverable without a hint.
- **Click** plays the card's sound and runs a playhead across it (about 3 s);
  behind the playhead every string turns taut and the backdrop shows, then all
  of it relaxes back over about a second.
- Some cards add their own motion on the same rest/taut blend: YSAD's hand
  turns always; Rearranged's lamp rewrites the top row in place.

## The cards

| Project | At rest | Under the lamp, and while playing | Lamp label (example) |
|---|---|---|---|
| Starling | a voice: a bundle of strings swaying around the sung pitch | the bundle tightens onto the notes it found; slides and vibrato kept | `slide D4 → G4 · kept` |
| Coming Undone | one dense bundle: the whole song | it parts into four lanes in four colours: vocals, keys, bass, drums, each written as its part | `bass · written as notes` |
| Rearranged | two rows of the same chords: before (one press a bar, held) and after (two shorter presses a bar, notes starting and ending at their own times) | the before row's presses split and slide into the after pattern where the lamp is; click a row to hear that version | `before → after · F, one press becomes two` |
| Ready Set | a lead sheet: chord symbols over a five-line staff | the staff's lines become the tracks of an Ableton Live set (chords, bass, drums, with a bar ruler and clip headers); the top line goes into an empty "your part" lane; chord symbols move down into the chords clip; play sounds only the band | `your part · open: sing it, play it, or improvise` |
| YSAD | the circle's four rings (kick inside to hats outside) as loose bundles of seven strings; a hand always turning, one bar per turn | rings pull taut behind the hand and under the lamp; each hit is the ring's strings fanning into a small round disc, sized by probability, in its drum colour | `snare · 100% chance on step 5` |
| Session Notes | the verse's three lines, each at its bar like clips down an arrangement, written as loose strings under the words | each line pulls taut into a clip where it sits; `[1] [5] [9]` show beneath | `[5] · a clip on bar 5` |
| Tagline | six loose captures drifting, tangled | triage: the keepers straighten into lanes and take their hashtags; the drops go slack and fall off the card | `"the bassline at 2:10" · kept #descent #dj-able` |

Odoroki stays a "coming" card with no visual.

Card one-liners (under each card): as in the prototype, for example Session
Notes: "Notes and lyrics, right inside Ableton Live." The final wording comes
from `src/data/projects.ts` (`summary` or `line`), edited there once.

The verse used by Session Notes (and anywhere else lyrics appear):

```
low sun, high tide
swallow whole the off-key hums
then slowly fade from sight
```

## Sound

Web Audio, synthesised in the page: simple tones for melodies and chords,
noise and a pitched sine for drums. No audio files, so nothing to fetch and no
copyright question (the tools' own test songs stay out). Audio starts only on a
click or tap, as browsers require. A real recording per project can replace a
card's synth later without changing anything else.

## Where it goes

### Welcome page

The lamp card replaces `visual()` beside each project's summary
(`src/ui/home.ts`). Today the whole visual is a link to the project page; a
card needs its own click (to play), so:

- the canvas is no longer inside the link;
- the existing cue button ("Try the demo →" or "Read how it works →") becomes
  the card's only link, placed beside or under it;
- the "preview" tag and the hover veil go (nothing is a recording any more);
- the name tag on the corner stays as it is.

### Project pages

Each project page shows its lamp card on its own, wide, between the head (name,
summary, Give it / It / Get) and the first story beat.
The live demo beat (the real product, framed) stays: it is the tool itself, so
its controls are real. Beats that show a recording (`show: 'video'`,
`'image'`, `'shots'`) are reviewed one by one; a studio still can stay where a
beat is about the studio itself, but not as decoration.

### Social and share cards

`card-og`, `card-square`, `card-story` and `card-thumb` stay images. Their
picture becomes a still of the lamp card (at rest, with the lamp over a telling
spot, in Paper and Night), captured by `npm run visuals` in place of the studio
screenshot.

### READMEs

The studio screenshots and recorded loops leave the showcase (deleted from
`public/visuals/` once each repo has them) and go to each project's own repo,
where engineers expect them and where they are easy to grab for sharing on
other platforms: the files in a `media/` folder (loops as `.mp4` in Paper and
Night, stills as `.png`), and the README showing a still that links to its
loop:

| Project | Repo | Status |
|---|---|---|
| Starling | swwallowws/starling | public: add |
| Session Notes | swwallowws/ableton-session-notes | public: add |
| Ready Set | swwallowws/ready-set | public: add |
| Coming Undone | swwallowws/coming-undone | public: add |
| Rearranged | private | add to the private repo's README; public later |
| YSAD | private | add to the private repo's README; public later |
| Tagline | no repo yet | waits for its repo |

Each README change is its own commit in its own repo, pushed only when asked.

## Building it

- **Engine:** `src/lamp/engine.ts`, ported from the prototype's `lamp.js`:
  canvas 2D, a card definition per project (`rest`, `tight`, `backdrop`,
  `label`, `playLabel`, `audio`, plus the optional hooks the prototype grew:
  `when`, `lift`, `intensity`, `wander`, `sweepMask`, `playhead`, `surface`,
  `over`). Colours through the design system's `tokens.js` `cssColor`.
- **Cards:** one file each in `src/lamp/cards/`, ported from the prototype's
  `cards/*.js`.
- **Sound:** `src/lamp/sound.ts` (tones and drum hits).
- **Performance:** a card draws only while on screen (IntersectionObserver),
  at device pixel ratio, with strings batched into a few paths per frame.
- **Theme:** colours re-read when the theme switch or the system mode changes.

## Phones, keyboard, reduced motion

- **Touch:** no hover, so the lamp follows a finger dragging on the card
  (`touch-action: pan-y` so a vertical swipe still scrolls the page); a tap
  plays. While untouched, the lamp wanders as on desktop.
- **Keyboard:** each card is focusable; Enter or Space plays it; the lamp
  wanders while focused.
- **Screen readers:** the canvas has an `aria-label` with the card's one-liner;
  the cue button carries the link.
- **Reduced motion:** no wander, no turning hand, no sway; the card shows its
  taut form still, and play runs without the playhead sweep.

## Checking it

- `npm run check` and `npm run build` pass.
- Headless screenshots per card, at rest, under the lamp and mid-play, in
  Paper and Night, at desktop and phone widths (the prototype's `hold.mjs`
  becomes `scripts/lamp-check.mjs`), reviewed by eye.
- In Chrome (claude-in-chrome): the welcome page and two project pages,
  moving the lamp, clicking to play, theme switch, and a phone-width pass.
- CI green on the push before it counts as done.

## Out of scope

- Real audio recordings per project.
- Odoroki's card (it keeps "coming").
- Changing the live demos themselves.

## Settled during review

- Project pages: the lamp card sits on its own, wide, between the head and
  the first story beat.
- Recorded loops and studio stills are deleted from the showcase once each
  project's repo has them (see READMEs).
- After the first build: a project page shows its card only when it has no
  live demo (the demo shows the tool itself), which today is Tagline's alone.
- The welcome page's cards are silent: a click plays the picture, sound is
  left to the demos. Enter on a focused card opens the tool's demo (or page),
  and Space is left to scroll the page.
- The way in ("Try the demo" or "Read how it works") is the first button in
  the row beside each summary, with "Full version" and "GitHub".

## Reference

The prototype: `.peek/brainstorm/all-lamp.html` (gitignored), with the engine
in `lamp.js` and one card per file in `cards/`.
