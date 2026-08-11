'use strict';
// test_redos.js — the catastrophic-backtracking failure mode gets its own test,
// because it is the one that turns a guard into a denial-of-service on itself:
// fed a pathological input, a backtracking matcher hangs, and a hung guard
// blocks nothing. We check that per-byte cost stays roughly flat as input grows
// (a backtracking guard's per-byte cost explodes) AND that an absolute ceiling
// holds. Run:  node test_redos.js
const assert = require('assert');
const { guard } = require('./examples/example_guard');

// The pathological input for a nominal run length `len`. Note the real string is
// 2*len + 6 characters, not len — per-character costs must divide by THIS length,
// so the builder is the single source of truth for both timing and normalization.
const buildInput = len => 'curl ' + 'a'.repeat(len) + ' ' + 'b'.repeat(len);

// Median wall-time (ms) for one guard() call on the input for `len`, measured
// over a batch so a single GC pause or scheduler hiccup can't decide the result.
function medianMs(len, reps) {
  const s = buildInput(len);
  const samples = [];
  for (let i = 0; i < reps; i++) {
    const t0 = process.hrtime.bigint();
    guard(s);
    samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  samples.sort((a, b) => a - b);
  return samples[samples.length >> 1];
}

// Warm up the JIT so the first size isn't penalized.
for (let i = 0; i < 200; i++) medianMs(2000, 1);

const sizes = [2000, 4000, 8000, 16000, 32000];
const reps = 40;
const med = sizes.map(n => medianMs(n, reps));
// Per-byte cost (µs per char), normalized by the ACTUAL input length.
// For a linear guard this is ~flat; for a backtracking one it climbs with size.
const chars = sizes.map(n => buildInput(n).length);
const perByte = sizes.map((n, i) => (med[i] * 1000) / chars[i]);
sizes.forEach((n, i) => console.log(`chars ${String(chars[i]).padStart(6)}: median ${med[i].toFixed(3)}ms  (${perByte[i].toFixed(4)} µs/char)`));

// Absolute ceiling: even 32k chars stays well under a real latency budget.
const budgetMs = 20;
assert.ok(Math.max(...med) < budgetMs, `worst median ${Math.max(...med).toFixed(1)}ms exceeded ${budgetMs}ms`);

// Shape check: per-byte cost at the largest size must not balloon versus the
// smallest. Linear ≈ 1x; we allow generous constant-factor and measurement
// slack (8x) but reject the runaway growth that marks catastrophic backtracking.
const ratio = Math.max(...perByte) / Math.min(...perByte);
assert.ok(ratio < 8, `per-byte cost grew ${ratio.toFixed(1)}x across 16x input growth — possible super-linear/ReDoS behavior`);

// ── Negative control: prove this test can FAIL. ─────────────────────────────
// test_harness.js earns its assertions with negative controls; this one
// should not get a pass. A deliberately quadratic matcher, on the same input
// family, must breach the shape assertion above — otherwise that assertion is
// unfalsifiable decoration. Note the scope this control also fixes in place:
// it demonstrates the probe catches backtracking ON THIS FAMILY, which is the
// only thing the probe claims.
function quadraticGuard(c) {
  /^.*a.*\|\s*(sh|bash)$/.test(c);
  return { action: 'allow', tier: null };
}
const ctlSizes = [2000, 8000];
const ctlMs = ctlSizes.map(n => {
  const s = buildInput(n);
  const t0 = process.hrtime.bigint();
  quadraticGuard(s);
  return Number(process.hrtime.bigint() - t0) / 1e6;
});
const ctlPerByte = ctlSizes.map((n, i) => (ctlMs[i] * 1000) / buildInput(n).length);
const ctlGrowth = ctlPerByte[1] / ctlPerByte[0];
assert.ok(ctlGrowth > 2,
  `negative control only grew ${ctlGrowth.toFixed(1)}x — the shape assertion above proves nothing`);
console.log(`negative control (quadratic matcher): per-byte cost grew ${ctlGrowth.toFixed(1)}x — this test can fail`);

console.log(`\ntest_redos: per-byte cost within ${ratio.toFixed(1)}x across a 16x size range, under budget — passed (negative control: ${ctlGrowth.toFixed(1)}x)`);
