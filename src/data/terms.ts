/* The site's glossary: every technical term explains itself at its first use on
   a page, in a quiet note (src/ui/terms.ts). Plain words, one or two sentences,
   for visitors who don't make music software. A picture can go with a note, from
   own photos and screenshots only (no Ableton product shots or logos).

   `words` are the exact spellings that get marked (whole words, case as written).
   `only` keeps a term to the pages of those project ids, where a word means
   something else elsewhere ("arrangement" in Rearranged and in Session Notes). */

export interface Term {
  id: string;
  words: string[];
  text: string;
  image?: { src: string; alt: string };
  only?: string[];
}

export const GLOSSARY: Term[] = [
  { id: 'midi', words: ['MIDI'], text: 'Music as data: which note, when, how long, how loud. Any synth can play it, every note is editable.' },
  { id: 'mpe', words: ['MPE'], text: 'MIDI Polyphonic Expression: each note carries its own bend and pressure, so a slide on one note leaves the others alone.' },
  { id: 'tuning', words: ['tuning'], text: 'Which pitches count as notes. Standard tuning splits the octave into 12 equal steps. There are tunings with more steps or unequal ones.' },
  { id: 'makam', words: ['makam'], text: 'The system of scales in Turkish classical music. Many of its notes sit between the piano’s keys, so a piano can’t play them in tune.' },
  { id: 'synth', words: ['synth'], text: 'A synthesizer: an instrument that makes its sound electronically. Takes in MIDI, plays the notes.' },
  { id: 'sample', words: ['sample'], text: 'A recorded sound, played back as an instrument.' },
  { id: 'guitar-pro', words: ['Guitar Pro'], text: 'A tab editor. Its files carry the notes, the tuning and how each note is played: bends, slides, hammer-ons.' },
  { id: 'musicxml', words: ['MusicXML'], text: 'The open file format notation apps use to share scores.' },
  { id: 'time-signature', words: ['time signature'], text: 'How a bar is counted: 4/4 is four quarter notes, 7/8 is seven eighth notes, grouped in twos and threes.' },
  { id: 'odd-meters', words: ['Odd meters', 'odd meters'], text: 'Time signatures with an uneven count, like 5/8 or 7/8. They lean and limp in a way 4/4 doesn’t.' },
  { id: 'swing', words: ['swing'], text: 'Every other note played a little late, so a straight beat bounces.' },
  { id: 'push', words: ['Ableton Push 3'], text: 'Ableton’s instrument with 64 pads. Push 3 can also run on its own, without a computer.' },
  { id: 'drum', words: ['drum'], only: ['ysad'], text: 'Drums first, but it sends MIDI, so the same patterns can also play a synth, chop up a sample or drive visuals.' },
  { id: 'arrangement-style', words: ['arrangement'], only: ['rearranged'], text: 'How a song is played: which instruments come in, their rhythms, their registers.' },
  { id: 'arrangement-view', words: ['arrangement'], only: ['session-notes'], text: 'Ableton Live’s timeline view, where a song is laid out from start to end.' },
  { id: 'locators', words: ['locators'], only: ['session-notes'], text: 'Named markers on Ableton Live’s timeline.' },
  { id: 'clips', words: ['clips'], only: ['session-notes'], text: 'Blocks of notes or audio on an Ableton Live track.' },
  { id: 'crate', words: ['crate'], only: ['intentional'], text: 'A DJ’s collection of tracks to play from, named after record crates.' },
];

export type Piece = string | { term: Term; word: string };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Splits one piece of text at the first use of each term still unmarked on this
 * page (`seen` holds the ids marked so far, and is updated). Terms whose `only`
 * doesn't include `page` are left alone. Whole words, as written.
 */
export function marksIn(text: string, page: string, seen: Set<string>, glossary: Term[] = GLOSSARY): Piece[] {
  const out: Piece[] = [];
  let rest = text;
  for (;;) {
    let best: { term: Term; word: string; at: number } | null = null;
    for (const term of glossary) {
      if (seen.has(term.id) || (term.only && !term.only.includes(page))) continue;
      for (const word of term.words) {
        const m = new RegExp(`(?<![\\w-])${escape(word)}(?![\\w-])`).exec(rest);
        if (m && (!best || m.index < best.at)) best = { term, word, at: m.index };
      }
    }
    if (!best) break;
    seen.add(best.term.id);
    if (best.at) out.push(rest.slice(0, best.at));
    out.push({ term: best.term, word: best.word });
    rest = rest.slice(best.at + best.word.length);
  }
  if (rest) out.push(rest);
  return out;
}
