import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLOSSARY, marksIn, type Piece } from '../src/data/terms.ts';

const words = (pieces: Piece[]) => pieces.map((p) => (typeof p === 'string' ? p : `[${p.word}]`)).join('');

test('a term is marked at its first use on a page, once', () => {
  const seen = new Set<string>();
  assert.equal(words(marksIn('Sing, get MIDI with MPE.', 'voxmpe', seen)), 'Sing, get [MIDI] with [MPE].');
  assert.equal(words(marksIn('More MIDI later.', 'voxmpe', seen)), 'More MIDI later.');
});

test('only whole words, as written', () => {
  assert.equal(words(marksIn('synths and a synth-like thing, then a synth.', 'ysad', new Set())), 'synths and a synth-like thing, then a [synth].');
  assert.equal(words(marksIn('midi, then MIDI', 'x', new Set())), 'midi, then [MIDI]');
});

test('a word with two meanings explains the one of its page', () => {
  const on = (page: string) => marksIn('the arrangement', page, new Set()).find((p) => typeof p !== 'string');
  assert.equal((on('rearranged') as { term: { id: string } }).term.id, 'arrangement-style');
  assert.equal((on('session-notes') as { term: { id: string } }).term.id, 'arrangement-view');
  assert.equal(on('voxmpe'), undefined);
});

test('every term is used somewhere in the site copy, and ids are unique', () => {
  const copy = readFileSync(new URL('../src/data/projects.ts', import.meta.url), 'utf8');
  for (const t of GLOSSARY) assert.ok(t.words.some((w) => copy.includes(w)), `${t.id} is used`);
  assert.equal(new Set(GLOSSARY.map((t) => t.id)).size, GLOSSARY.length);
});

test('the notes are plain prose: no em dashes', () => {
  for (const t of GLOSSARY) assert.ok(!t.text.includes('—'), t.id);
});
