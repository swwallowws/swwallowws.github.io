/* The catalog. One entry per project; a page exists for every entry that has
   a `page`. Empty slots (no live tool, no video, repo still private) render as
   labelled placeholders, so filling one later is a data change only. */

export type Category = 'transcribe' | 'transform' | 'perceive' | 'workflow';

export interface CategoryDef {
  id: Category;
  label: string;
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'transcribe', label: 'Transcribe' },
  { id: 'transform', label: 'Transform and generate' },
  { id: 'perceive', label: 'Perceive and perform' },
  { id: 'workflow', label: 'Workflow tooling' },
];

/** A slot that is either filled or says why it isn't yet. */
export type Slot = { url: string } | { placeholder: string };

export interface Shot {
  /** Image URL, or omitted while the screenshot doesn't exist yet. */
  src?: string;
  caption: string;
}

/** What a story beat shows next to its text. */
export type Show = 'live' | 'image' | 'video' | 'flow' | 'shots' | 'keys';

/** One beat of a project page: a heading, a sentence or two, and the visual
    that shows it. Text and visuals alternate, so no part reads as a wall. */
export interface Beat {
  title: string;
  text?: string;
  show?: Show;
}

export interface ProjectEntry {
  id: string;
  name: string;
  /** One or more categories; the first sets the page's accent colour. */
  categories: Category[];
  /** The representation it starts from and the one it ends in. */
  from: string;
  to: string;
  /** One line under the name. */
  lead: string;
  /** A short tagline shown with the name ("simply sing."), where a tool has one. */
  line?: string;
  /** The long name behind a short one (YSAD): spelled out once under the
      page's title, and revealed on hover on the welcome page's name tag. */
  fullName?: string;
  /** The page head's own summary and parts, where a tool has them: then the
      head shows these in place of the from → to line and the lead. */
  summary?: string;
  /** A silent loop of the real product for the welcome page, in place of the
      still: `public/visuals/<id>/<loop>-paper|night.mp4` with `.png` posters. */
  loop?: string;
  /** Where the full product is coming, while it has no public home yet: shown
      unlinked in place of the way to the full version ("Full version coming soon"). */
  comingTo?: string;
  /** Words that explain themselves on hover or focus, at their first use in
      the summary or the Give it / It / Get rows. */
  terms?: { word: string; text: string }[];
  parts?: { give: string; does: string; get: string };
  /** The page, beat by beat. */
  story?: Beat[];
  /** Formats, apps and hardware a reader would recognise, shown as text
      badges (no logos: several of these marks need permission). */
  worksWith?: string[];
  /** What it ships as and where it runs, as two labelled badge rows on the
      welcome page and the project page. Where set, they replace worksWith. */
  availableAs?: string[];
  worksIn?: string[];
  builtWith?: string[];
  /** Thanks to someone who helped, one plain line under Details. */
  credit?: string;
  /** Page path, e.g. "voxmpe/". Absent for "coming" cards. */
  page?: string;
  live?: Slot;
  video?: Slot;
  code?: Slot;
  image?: { src: string; srcDark?: string; alt: string };
  /** A flow diagram, in order. */
  flow?: { step: string; detail: string }[];
  shots?: Shot[];
  /** A small legend of codes and what they mean. */
  keys?: { code: string; meaning: string }[];
  coming?: boolean;
  /** Where the full product lives, best first (max 2): a studio or website,
      then GitHub. Never a file download (see CLAUDE.md). Shown as outlined buttons opening in a new
      tab, beside "Try it". `name` is the spoken name when the label alone is
      vague ("Open the Starling studio"). Empty: "Full version coming". */
  get?: { label: string; href: string; name?: string }[];
}

/** Badges that link somewhere, wherever they appear. */
export const BADGE_LINKS: Record<string, string> = {
  'Ableton Extensions SDK': 'https://www.ableton.com/en/live/extensions/',
};

const VIDEO_COMING: Slot = { placeholder: 'video: coming' };

/* Demos live in each project's own repo and are framed in here, from their
   hosted pages: a public repo's CI builds and publishes its site to its own
   Pages on every push. Rearranged's code is private, so its built site is pushed
   to rearranged-web; YSAD's is private too, so its built demo is copied into
   public/demos/ and the site carries it. */
const DEMOS = {
  voxmpe: 'https://swwallowws.github.io/starling/try/',
  sessionNotes: 'https://swwallowws.github.io/ableton-session-notes/try/',
  tabridge: 'https://swwallowws.github.io/ready-set/try/',
  // Its repo is private, so the site carries the demo itself (public/demos/ysad/,
  // copied by scripts/ysad-demo.sh).
  // index.html by name: Vite's dev server answers a bare folder with the welcome page.
  ysad: `${location.origin}${import.meta.env.BASE_URL}demos/ysad/index.html`,
  stemscribe: 'https://swwallowws.github.io/coming-undone/try/',
  rearranged: 'https://swwallowws.github.io/rearranged-web/try/', // rearranged: tools/deploy-web.sh
} as const;

export const projects: ProjectEntry[] = [
  {
    id: 'voxmpe',
    name: 'Starling',
    categories: ['transcribe'],
    from: 'a sung phrase',
    to: 'expressive MPE MIDI, in any tuning',
    lead: 'Sing a phrase, get MIDI that keeps every glide, in any tuning.',
    line: 'simply sing.',
    summary: 'Your voice as MIDI, every slide and in-between note included.',
    parts: {
      give: 'a recording of your voice.',
      does: 'follows your pitch note by note and keeps the slides, vibrato and loudness, in standard tuning or any other, like Turkish makam.',
      get: 'MIDI that keeps every slide (MPE), or an Ableton Live set that’s ready to play.',
    },
    story: [
      {
        title: 'Sing into it',
        text: 'Record a phrase right here, then move the note-split settings while it plays back.',
        show: 'live',
      },
      { title: 'Slides stay slides', text: 'Your voice slides between notes; the MIDI slides with it.' },
      { title: 'Any tuning', text: 'Not stuck in standard tuning: Turkish makam, or any tuning you bring.' },
      { title: 'One take, start to finish', text: 'From singing to MIDI in Ableton Live, in one take.', show: 'video' },
    ],
    worksWith: ['MIDI / MPE', 'Scala tunings', 'Ableton Live'],
    availableAs: ['Browser studio', 'Command line'],
    worksIn: ['any browser', 'Ableton Live', 'any MPE synth'],
    builtWith: ['Rust', 'CREPE pitch tracking', 'WebAssembly', 'ONNX Runtime Web'],
    page: 'voxmpe/',
    live: { url: DEMOS.voxmpe },
    get: [
      { label: 'Open the studio', href: 'https://swwallowws.github.io/starling/', name: 'Open the Starling studio' },
      { label: 'GitHub', href: 'https://github.com/swwallowws/starling', name: 'Starling on GitHub' },
    ],
    loop: 'loop',
    video: VIDEO_COMING,
    code: { url: 'https://github.com/swwallowws/starling' },
  },
  {
    id: 'stemscribe',
    name: 'Coming Undone',
    categories: ['transcribe'],
    from: 'a recording',
    to: 'stems and labelled MIDI',
    lead: 'Split a recording into its parts and write each one down as MIDI.',
    line: 'simply split.',
    summary: 'A song split into parts you can adjust.',
    parts: {
      give: 'a recording of a song.',
      does: 'separates drums, bass, vocals and the rest and writes each one down as notes.',
      get: 'a named MIDI track per part.',
    },
    story: [
      {
        title: 'Hear the parts come apart',
        text: 'Solo each part of the demo song and see the MIDI written from it.',
        show: 'live',
      },
      { title: 'Every part as MIDI', text: 'Every part, written down as MIDI.' },
      { title: 'On the beat', text: 'Aligned, in-tempo MIDI.' },
      { title: 'From a recording to MIDI', text: 'From a recording to MIDI.', show: 'video' },
    ],
    worksWith: ['MP3 / WAV', 'MIDI'],
    availableAs: ['Browser studio', 'Command line'],
    worksIn: ['any music software that opens MIDI'],
    builtWith: ['Python', 'demucs', 'basic-pitch', 'ADT_STR drums'],
    page: 'stemscribe/',
    live: { url: DEMOS.stemscribe },
    get: [
      { label: 'Open the studio', href: 'https://swwallowws.github.io/coming-undone/', name: 'Open the Coming Undone studio' },
      { label: 'GitHub', href: 'https://github.com/swwallowws/coming-undone', name: 'Coming Undone on GitHub' },
    ],
    loop: 'loop',
    video: VIDEO_COMING,
    code: { url: 'https://github.com/swwallowws/coming-undone' },
  },
  {
    id: 'rearranged',
    name: 'Rearranged',
    categories: ['transform'],
    from: 'two songs',
    to: 'one song in the other’s style',
    lead: 'Rearrange a song in the style of another.',
    line: 'simply cover.',
    summary: 'Rearrange a song in the style of another.',
    parts: {
      give: 'two songs as MIDI.',
      does: 'plays the first song’s chords with the second’s arrangement habits.',
      get: 'the whole song rearranged as MIDI.',
    },
    story: [
      {
        title: 'Hear one song played another way',
        text: 'Switch between versions of the same part and listen.',
        show: 'live',
      },
      { title: 'Arrangement habits', text: 'It extracts a song’s arrangement habits.' },
      { title: 'Rules you can read', text: 'Every choice traces back to a simple rule.' },
      { title: 'From two songs to a rearrangement', text: 'From two songs to a rearrangement.', show: 'video' },
    ],
    worksWith: ['MIDI'],
    availableAs: ['Browser studio', 'Command line'],
    builtWith: ['Python', 'pretty_midi', 'numpy', 'spessasynth'],
    page: 'rearranged/',
    live: { url: DEMOS.rearranged },
    get: [{ label: 'Open the studio', href: 'https://swwallowws.github.io/rearranged-web/', name: 'Open the Rearranged studio' }],
    loop: 'loop',
    video: VIDEO_COMING,
    code: { placeholder: 'code: public soon' },
  },
  {
    id: 'tabridge',
    name: 'Ready Set',
    categories: ['transform'],
    from: 'a tab or a score',
    to: 'a playable Ableton Live set',
    lead: 'Open a tab or a score as a playable Ableton Live set.',
    line: 'simply jam.',
    summary: 'From a tab to a set you can jam with.',
    parts: {
      give: 'a tab or a score.',
      does: 'builds a set that plays straight away, slides and bends kept, in the key you pick.',
      get: 'an Ableton Live set, or a MIDI file.',
    },
    story: [
      { title: 'Open a file', text: 'Drop in a tab or a score and hear it.', show: 'live' },
      { title: 'A set that plays straight away', text: 'A set that plays straight away.' },
      { title: 'Keeping the slides and bends', text: 'Slides and bends survive.' },
      {
        title: 'From a tab to an Ableton Live set',
        text: 'From a tab to a set you can play along with.',
        show: 'video',
      },
    ],
    worksWith: ['Guitar Pro', 'MusicXML', 'Ableton Live 12'],
    // The extension isn't released yet: its website says "coming soon" too.
    availableAs: ['Browser studio', 'Ableton Live extension (coming soon)'],
    worksIn: ['Ableton Live 12', 'any music software that opens MIDI'],
    builtWith: ['Rust', 'WebAssembly', 'Ableton Extensions SDK'],
    credit: 'Ece K. T., for the idea that brought a premium karaoke experience.',
    page: 'tabridge/',
    live: { url: DEMOS.tabridge },
    loop: 'loop',
    video: VIDEO_COMING,
    code: { url: 'https://github.com/swwallowws/ready-set' },
    get: [
      { label: 'Open the website', href: 'https://swwallowws.github.io/ready-set/', name: 'Open the Ready Set website' },
      { label: 'GitHub', href: 'https://github.com/swwallowws/ready-set', name: 'Ready Set on GitHub' },
    ],
  },
  {
    id: 'ysad',
    name: 'YSAD',
    fullName: 'You Suck At Drums',
    line: 'simply groove.',
    summary: 'A drum pattern generator you play live.',
    terms: [{ word: 'drum', text: 'Drums first, but it sends MIDI, so the same patterns can also play a synth, chop up a sample or drive visuals.' }],
    parts: {
      give: 'a style, and how busy each drum should be.',
      does: 'plays the beat live, lets you change it hit by hit, and draws it around a circle.',
      get: 'MIDI. The same beat can play a synth, chop up a sample or drive visuals.',
    },
    categories: ['transform'],
    from: 'a style and eight knobs',
    to: 'a beat you play live, as MIDI',
    lead: 'Drum patterns you can play live, in any time signature, around a circle.',
    story: [
      { title: 'Play it', text: 'Pull the kicks out and bring them back, then lean on the swing.', show: 'live' },
      // With `parts`, a page shows each beat as its one line; the title is
      // only the section's anchor.
      { title: 'Live on Ableton Push 3', text: 'Play it like an instrument on Ableton Push 3.', show: 'video' },
      { title: 'Why a circle', text: 'A circle is the intuitive way to see a groove.' },
      { title: 'Same settings, same beat', text: 'The same settings always give the same beat.' },
      { title: 'Odd meters', text: 'Every style has its own time signature, from 4/4 to 5/8, 7/8 and 9/8.' },
    ],
    availableAs: ['Max for Live device', 'VST3 plugin', 'CLAP plugin'],
    worksIn: ['Ableton Live', 'Ableton Push 3 standalone', 'most music software as plugin'],
    builtWith: ['Max', 'Rust', 'nih-plug'],
    credit: 'Kirkwood West, for the VST3 port.',
    page: 'ysad/',
    live: { url: DEMOS.ysad },
    // Until the full version's store pages exist, both pages say "Full version
    // coming soon"; then add them here, e.g.
    // get: [{ label: 'Full version', href: '<store page>', name: 'YSAD, full version' }],
    // and set the demo's FULL_PRODUCT and FULL_LIVE.
    loop: 'loop',
    video: VIDEO_COMING,
    code: { placeholder: 'code: coming' },
  },
  {
    id: 'session-notes',
    name: 'Session Notes',
    categories: ['workflow'],
    from: 'lyrics and notes',
    to: 'Ableton Live arrangement',
    lead: 'Notes that live with the set. Lyrics that land on the arrangement.',
    line: 'simply sketch.',
    summary: 'Notes that live with the set. Lyrics that land on the arrangement.',
    terms: [{ word: 'locators', text: 'Named markers on Ableton Live’s timeline.' }],
    parts: {
      give: 'lyrics, ideas and to-dos, typed inside Ableton Live.',
      does: 'keeps them with the set; a line tagged [17] or [1:04] goes to that bar or time.',
      get: 'locators or clips on the arrangement.',
    },
    story: [
      {
        title: 'Tag a line, watch it land',
        text: 'Tag a lyric line with where it goes. The lines under it follow a bar apart.',
        show: 'live',
      },
      { title: 'What the tags do', text: 'Tagging the first line of a verse is enough.', show: 'keys' },
      { title: 'Notes that live with the set', text: 'Set notes travel with the set; global notes are in every set.' },
      {
        title: 'Sending a verse to the arrangement in Ableton Live',
        text: 'Send a verse to the arrangement, as locators or as clips.',
        show: 'video',
      },
    ],
    availableAs: ['Ableton Live extension'],
    worksIn: ['Ableton Live 12'],
    keys: [
      { code: '[17]', meaning: 'bar 17' },
      { code: '[17.3]', meaning: 'beat 3 of bar 17' },
      { code: '[1:04]', meaning: 'a minute and four seconds in' },
      { code: '[=8*4]', meaning: 'any sum of beats' },
    ],
    worksWith: ['Ableton Live 12', 'Markdown'],
    builtWith: ['TypeScript', 'Ableton Extensions SDK'],
    page: 'session-notes/',
    live: { url: DEMOS.sessionNotes },
    get: [
      { label: 'Download', href: 'https://github.com/swwallowws/ableton-session-notes/releases/latest', name: 'Session Notes releases' },
      { label: 'GitHub', href: 'https://github.com/swwallowws/ableton-session-notes', name: 'Session Notes on GitHub' },
    ],
    video: VIDEO_COMING,
    code: { url: 'https://github.com/swwallowws/ableton-session-notes' },
  },
  {
    id: 'intentional',
    name: 'Tagline',
    categories: ['workflow'],
    from: 'a track you just heard',
    to: 'a tagged file in a DJ crate',
    lead: 'A plain-text music crate whose tags travel inside the audio files.',
    line: 'simply tag.',
    summary: 'Tag music once, find it again while you DJ.',
    parts: {
      give: 'tracks captured from your phone, tagged in Obsidian.',
      does: 'writes your tags into each music file.',
      get: 'tags your DJ software can search.',
    },
    story: [
      {
        title: 'From a link on the phone to your DJ crate',
        text: 'From a link on your phone to your DJ crate, in six steps.',
        show: 'flow',
      },
      { title: 'What it looks like along the way', text: 'What it looks like along the way.', show: 'shots' },
      { title: 'Tags that travel with the file', text: 'The tags travel inside the file itself.' },
    ],
    availableAs: ['Command line', 'Obsidian views', 'iOS Shortcut'],
    worksIn: ['Obsidian', 'DJ software, like DJUCED', 'iPhone'],
    worksWith: ['Obsidian', 'DJUCED', 'AIFF / MP3 / FLAC', 'iPhone share sheet'],
    builtWith: ['Rust', 'Obsidian Bases', 'iOS Shortcuts', 'ID3 / FLAC'],
    page: 'intentional/',
    code: { placeholder: 'code: no public repo yet' },
    flow: [
      { step: 'Capture', detail: 'Phone share sheet: a link and a few words on why it caught you, saved to GitHub.' },
      { step: 'Inbox', detail: '`tagline inbox` looks up title and artist and turns each capture into a note.' },
      { step: 'Triage', detail: 'In Obsidian, tag each track and keep it, or drop it.' },
      { step: 'Own', detail: 'Get the files for the keepers and point each note at its file.' },
      { step: 'Sync', detail: '`tagline sync` writes the tags into each file as hashtags, leaving the music untouched.' },
      { step: 'Play', detail: 'In your DJ software (DJUCED, for one), search #descent or #dj-able across the whole crate.' },
    ],
    shots: [
      { caption: 'Capture from the phone share sheet' },
      { caption: 'The Inbox view in Obsidian' },
      { caption: 'Searching tags in the DJ software' },
    ],
  },
  {
    id: 'odoroki',
    name: 'Odoroki',
    categories: ['perceive'],
    from: 'music',
    to: 'live visuals',
    lead: 'Stay in awe of music, visually too.',
    coming: true,
  },
];

export function categoryLabel(id: Category): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
