// Unit tests for the lamp's pure helpers (src/lamp/core.ts). Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  behind, clamp, hz, lampRadius, lampWeight, mixRgb, nameOf, parseRgb, playState, rgba, smooth,
} from '../src/lamp/core.ts';

const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;

test('clamp and smooth hold their ends', () => {
  assert.equal(clamp(-1, 0, 1), 0);
  assert.equal(clamp(2, 0, 1), 1);
  assert.equal(smooth(0), 0);
  assert.equal(smooth(1), 1);
  assert.equal(smooth(0.5), 0.5);
});

test('the lamp is 180 px at most, and a third of a narrow card', () => {
  assert.equal(lampRadius(1200), 180);
  assert.ok(near(lampRadius(300), 102));
});

test('the lamp is full at its centre and gone at its edge', () => {
  assert.equal(lampWeight(0, 0, 100), 1);
  assert.equal(lampWeight(100, 0, 100), 0);
  assert.equal(lampWeight(0, 250, 100), 0);
  assert.equal(lampWeight(50, 0, 100), 0.5);
});

test('before any click nothing plays', () => {
  assert.deepEqual(playState(5000, -1, 3200), { p: -1, playing: false, sweep: -1, keep: 1 });
});

test('a click scheduled ahead has not started yet', () => {
  const s = playState(900, 1000, 3200);
  assert.equal(s.playing, false);
  assert.equal(s.sweep, -1);
});

test('halfway through, the reveal reaches halfway', () => {
  const s = playState(1000 + 1600, 1000, 3200);
  assert.equal(s.playing, true);
  assert.equal(s.sweep, 0.5);
  assert.equal(s.keep, 1);
});

test('after the end it holds, relaxes, then lets go', () => {
  const end = 1000 + 3200;
  const a = playState(end + 1, 1000, 3200, 1200);
  assert.equal(a.playing, false);
  assert.equal(a.sweep, 1);
  assert.ok(a.keep > 0.99);
  assert.equal(playState(end + 600, 1000, 3200, 1200).keep, 0.5);
  assert.equal(playState(end + 1200, 1000, 3200, 1200).sweep, -1);
});

test('a new click starts the sweep over', () => {
  const s = playState(5010, 5000, 3200);
  assert.equal(s.playing, true);
  assert.ok(s.sweep < 0.01);
});

test('behind the playhead strings turn, ahead they wait', () => {
  assert.equal(behind(0.6, 0.5, 1), 0);
  assert.equal(behind(0.4, 0.5, 1), 1);
  assert.ok(near(behind(0.48, 0.5, 1), 0.5));
  assert.equal(behind(0.4, 0.5, 0.5), 0.5);
  assert.equal(behind(0.1, -1, 1), 0);
});

test('note names and pitches', () => {
  assert.equal(nameOf(60), 'C4');
  assert.equal(nameOf(61), 'C#4');
  assert.equal(nameOf(57), 'A3');
  assert.equal(hz(69), 440);
});

test('colours parse from the browser and mix', () => {
  assert.deepEqual(parseRgb('rgb(12, 34, 56)'), [12, 34, 56]);
  assert.deepEqual(parseRgb('rgba(1, 2, 3, 0.5)'), [1, 2, 3]);
  assert.deepEqual(parseRgb(''), [0, 0, 0]);
  assert.deepEqual(mixRgb([0, 0, 0], [100, 200, 50], 0.5), [50, 100, 25]);
  assert.equal(rgba([1, 2, 3], 0.5), 'rgba(1, 2, 3, 0.5)');
});
