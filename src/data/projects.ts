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
export type Show = 'live' | 'image' | 'video' | 'flow' | 'shots' | 'keys' | 'clip';

/** One beat of a project page: a heading, a sentence or two, and the visual
    that shows it. Text and visuals alternate, so no part reads as a wall. */
export interface Beat {
  title: string;
  text?: string;
  show?: Show;
  /** With show 'video': which encoded recording (its name, no extension); the first one otherwise. */
  video?: string;
  /** With show 'clip': the URL of a small playable piece of the product, framed with ?embed=1. */
  clip?: string;
  /** Which side a beside visual sits on: the right (text left, visual right) unless set to 'left'. */
  side?: 'left' | 'right';
  /** Consecutive beats with the same row name share one block like the demo: their lines as a rail, one visual at a time. */
  row?: string;
  /** With a visual: several short lines beside it, set like a rail's but all at once (one visual, nothing to choose). */
  lines?: string[];
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
  /** Where the full product is coming, while it has no public home yet: shown
      unlinked in place of the way to the full version ("Full version coming soon"). */
  comingTo?: string;
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
  /** Page path, e.g. "tools/starling/". Absent for "coming" cards. */
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
      vague ("Open the Starling studio"). Empty: "Full version coming".
      `as` is the availableAs format the link opens: the welcome page names
      the link after it. */
  get?: { label: string; href: string; name?: string; as?: string }[];
  /** The welcome page's one line on where a tool runs, in place of its
      formats, when they are one flow rather than separate ways in. */
  ways?: string;
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
  starling: 'https://swwallowws.github.io/starling/try/',
  sessionNotes: 'https://swwallowws.github.io/ableton-session-notes/try/',
  'ready-set': 'https://swwallowws.github.io/ready-set/try/',
  // Its repo is private, so the site carries the demo itself (public/demos/ysad/,
  // copied by scripts/ysad-demo.sh).
  // index.html by name: Vite's dev server answers a bare folder with the welcome page.
  ysad: `${location.origin}${import.meta.env.BASE_URL}demos/ysad/index.html`,
  'coming-undone': 'https://swwallowws.github.io/coming-undone/try/',
  rearranged: 'https://swwallowws.github.io/rearranged-web/try/', // rearranged: tools/deploy-web.sh
} as const;

export const projects: ProjectEntry[] = [
  {
    id: 'starling',
    name: 'Starling',
    categories: ['transcribe'],
    from: 'a sung phrase',
    to: 'expressive MPE MIDI, in any tuning',
    lead: 'Sing a phrase, get MIDI that keeps every glide, in any tuning.',
    line: 'simply sing.',
    summary: 'Your voice as MIDI, every slide and in-between note included.',
    parts: {
      give: 'a recording of your voice.',
      does: 'follows your pitch note by note and keeps the slides, vibrato and loudness, in standard tuning or any other, like the comma tuning of Turkish makam music.',
      get: 'MIDI that keeps every slide (MPE), or an Ableton Live set that’s ready to play.',
    },
    story: [
      {
        title: 'Sing into it',
        text: 'Record a phrase right here, then move the note-split settings while it plays back.',
        show: 'live',
      },
      { title: 'Slides stay slides', text: 'Every slide, vibrato and swell kept, as MPE.', show: 'video', video: 'slides', row: 'clips' },
      { title: 'Any tuning', text: 'Any tuning: standard, 53-EDO for Turkish makam, or your own Scala file.', show: 'video', video: 'tuning', row: 'clips' },
      { title: 'Into Ableton Live', text: 'Saves the MIDI with its tuning, ready to play in Ableton Live.', show: 'video', video: 'live', row: 'clips' },
    ],
    worksWith: ['MIDI / MPE', 'Scala tunings', 'Ableton Live'],
    availableAs: ['Browser studio', 'Command line'],
    worksIn: ['any browser', 'Ableton Live', 'any MPE synth'],
    builtWith: ['Rust', 'CREPE pitch tracking', 'WebAssembly', 'ONNX Runtime Web'],
    page: 'tools/starling/',
    live: { url: DEMOS.starling },
    get: [
      { label: 'Open the studio', href: 'https://swwallowws.github.io/starling/', name: 'Open the Starling studio', as: 'Browser studio' },
      { label: 'GitHub', href: 'https://github.com/swwallowws/starling', name: 'Starling on GitHub' },
    ],
    video: VIDEO_COMING,
    code: { url: 'https://github.com/swwallowws/starling' },
  },
  {
    id: 'coming-undone',
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
      {
        title: 'Every part as MIDI',
        lines: ['Melody, comping, bass and drums, each its own MIDI track.', 'On the beat: the MIDI follows the song’s tempo.'],
        show: 'video',
        video: 'studio-plain',
      },
    ],
    worksWith: ['MP3 / WAV', 'MIDI'],
    availableAs: ['Browser studio', 'Command line'],
    worksIn: ['any music software that opens MIDI'],
    builtWith: ['Python', 'demucs', 'basic-pitch', 'ADT_STR drums'],
    page: 'tools/coming-undone/',
    live: { url: DEMOS['coming-undone'] },
    get: [
      { label: 'Open the studio', href: 'https://swwallowws.github.io/coming-undone/', name: 'Open the Coming Undone studio', as: 'Browser studio' },
      { label: 'GitHub', href: 'https://github.com/swwallowws/coming-undone', name: 'Coming Undone on GitHub' },
    ],
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
      {
        title: 'From two songs to a rearrangement',
        lines: [
          'Two songs in: one gives the chords, the other its arrangement habits.',
          'Change each part while it plays: bass, guitar, drums, feel.',
          'Every choice traces back to a rule you can read.',
        ],
        show: 'video',
        video: 'two-songs-plain',
      },
    ],
    worksWith: ['MIDI'],
    availableAs: ['Browser studio'],
    builtWith: ['Rust', 'WebAssembly', 'spessasynth'],
    page: 'tools/rearranged/',
    live: { url: DEMOS.rearranged },
    get: [{ label: 'Open the studio', href: 'https://swwallowws.github.io/rearranged-web/', name: 'Open the Rearranged studio', as: 'Browser studio' }],
    video: VIDEO_COMING,
    code: { placeholder: 'code: public soon' },
  },
  {
    id: 'ready-set',
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
      get: 'an Ableton Live set or a MIDI file, to jam along, practise at any tempo in your own key, or arrange your way.',
    },
    story: [
      { title: 'Open a file', text: 'Drop in a tab or a score and hear it.', show: 'live' },
      {
        title: 'In the studio',
        text: 'In the studio: search a song or drop in your own, and the set opens in Live, playing.',
        show: 'video',
        video: 'straight-away-plain',
        row: 'clips',
      },
      {
        title: 'In Ableton Live',
        text: 'In Ableton Live: search free, public-domain scores and build the set right there.',
        show: 'video',
        video: 'impromptu-plain',
        row: 'clips',
      },
      {
        title: 'Keeping the slides and bends',
        text: 'Slides and bends survive.',
        show: 'clip',
        clip: 'https://swwallowws.github.io/ready-set/?clip=example',
        row: 'clips',
      },
    ],
    worksWith: ['Guitar Pro', 'MusicXML', 'Ableton Live 12'],
    availableAs: ['Browser studio', 'Ableton Live extension'],
    worksIn: ['Ableton Live 12.4.15 beta or later', 'any music software that opens MIDI'],
    builtWith: ['Rust', 'WebAssembly', 'Ableton Extensions SDK'],
    credit: 'Ece K. T., for the idea that brought a premium karaoke experience.',
    page: 'tools/ready-set/',
    live: { url: DEMOS['ready-set'] },
    video: VIDEO_COMING,
    code: { url: 'https://github.com/swwallowws/ready-set' },
    get: [
      { label: 'Open the studio', href: 'https://swwallowws.github.io/ready-set/', name: 'Open the Ready Set studio', as: 'Browser studio' },
      { label: 'Ableton Live extension', href: 'https://github.com/swwallowws/ready-set/releases/latest', name: 'The Ready Set extension for Ableton Live', as: 'Ableton Live extension' },
      { label: 'GitHub', href: 'https://github.com/swwallowws/ready-set', name: 'Ready Set on GitHub' },
    ],
  },
  {
    id: 'ysad',
    name: 'YSAD',
    fullName: 'You Suck At Drums',
    line: 'simply groove.',
    summary: 'A circular drum sequencer you play live.',
    parts: {
      give: 'a style, and seven knobs to shape it.',
      does: 'plays the beat live and lets you change it hit by hit.',
      get: 'MIDI. The same beat can play a synth, chop up a sample or drive visuals.',
    },
    categories: ['transform'],
    from: 'a style and eight knobs',
    to: 'a beat you play live, as MIDI',
    lead: 'Drum patterns you can play live, in 4/4 and odd meters, around a circle.',
    story: [
      { title: 'Play it', text: 'Pull the kicks out and bring them back, then lean on the swing.', show: 'live' },
      // With `parts`, a page shows each beat as its one line; the title is
      // only the section's anchor.
      // Named, so it keeps showing "video: coming" until a `push` recording exists.
      { title: 'Live on Ableton Push 3', text: 'The Max for Live device plays on Ableton Push 3 like an instrument, no computer needed.', show: 'video', video: 'push' },
      { title: 'Why a circle', text: 'The groove drawn around a circle, one ring per drum.', show: 'video', video: 'why-a-circle', row: 'clips' },
      { title: 'Odd meters', text: '15 styles, in 4/4, 3/4, 6/8, 12/8, 5/8, 7/8 and 9/8.', show: 'video', video: 'odd-meters', row: 'clips' },
      { title: 'Same settings, same beat', text: 'The same settings always give the same beat.', show: 'video', video: 'same-settings-same-beat', row: 'clips' },
    ],
    availableAs: ['Max for Live device', 'VST3 plugin', 'CLAP plugin'],
    worksIn: ['Ableton Live', 'Ableton Push 3 standalone', 'most music software as plugin'],
    builtWith: ['Max', 'Rust', 'nih-plug'],
    credit: 'Music Hackspace for the Lisbon Hackathon and Kirkwood West for the VST3 port.',
    page: 'tools/ysad/',
    live: { url: DEMOS.ysad },
    // VST3 on MuseHub, VST3 and CLAP on Gumroad, the Max for Live device on Gumroad only.
    get: [
      { label: 'VST3 plugin', href: 'https://www.musehub.com/plugin/ysad?utm_medium=PT&utm_source=WS&utm_campaign=MH_WW_PT_WS_WEB_ALL_291026_', name: 'YSAD on MuseHub', as: 'VST3 plugin' },
      { label: 'CLAP plugin', href: 'https://swwallowws.gumroad.com/l/ysad', name: 'YSAD for VST3 and CLAP on Gumroad', as: 'CLAP plugin' },
      { label: 'Max for Live device', href: 'https://swwallowws.gumroad.com/l/ysad-m4l', name: 'YSAD for Max for Live on Gumroad', as: 'Max for Live device' },
      { label: 'Bundle', href: 'https://swwallowws.gumroad.com/l/ysad-bundle', name: 'YSAD bundle on Gumroad: the plugin and the Max for Live device' },
    ],
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
      {
        title: 'Sending a verse to the arrangement in Ableton Live',
        text: 'Send a verse to the arrangement, as locators or as clips.',
        show: 'video',
        video: 'send-a-verse',
      },
      { title: 'What the tags do', text: 'Tagging the first line of a verse is enough.', show: 'keys' },
      {
        title: 'Notes that live with the set',
        text: 'Set notes travel with the set; global notes are in every set.',
        show: 'video',
        video: 'global-notes',
      },
    ],
    availableAs: ['Ableton Live extension'],
    worksIn: ['Ableton Live 12.4.15 beta or later'],
    keys: [
      { code: '[17]', meaning: 'bar 17' },
      { code: '[17.3]', meaning: 'beat 3 of bar 17' },
      { code: '[1:04]', meaning: 'a minute and four seconds in' },
      { code: '[=8*4]', meaning: 'any sum of beats' },
    ],
    worksWith: ['Ableton Live 12', 'Markdown'],
    builtWith: ['TypeScript', 'Ableton Extensions SDK'],
    page: 'tools/session-notes/',
    live: { url: DEMOS.sessionNotes },
    get: [
      { label: 'Download', href: 'https://github.com/swwallowws/ableton-session-notes/releases/latest', name: 'Session Notes releases', as: 'Ableton Live extension' },
      { label: 'GitHub', href: 'https://github.com/swwallowws/ableton-session-notes', name: 'Session Notes on GitHub' },
    ],
    video: VIDEO_COMING,
    code: { url: 'https://github.com/swwallowws/ableton-session-notes' },
  },
  {
    id: 'tagline',
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
      { title: 'Tags that travel with the file', text: 'The tags travel inside the file itself.' },
    ],
    availableAs: ['Command line', 'Obsidian views', 'iOS Shortcut'],
    ways: 'iPhone → Obsidian → DJ software',
    worksIn: ['Obsidian', 'DJ software, like DJUCED', 'iPhone'],
    worksWith: ['Obsidian', 'DJUCED', 'AIFF / MP3 / FLAC', 'iPhone share sheet'],
    builtWith: ['Rust', 'Obsidian Bases', 'iOS Shortcuts', 'ID3 / FLAC'],
    page: 'tools/tagline/',
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
    lead: 'Live visuals that react when the music surprises you.',
    coming: true,
  },
];

export function categoryLabel(id: Category): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
