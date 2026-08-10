'use strict';
// guard-test-harness — a test rig for command-guarding functions.
//
// A "guard" is any pure function `(command: string) => { action, tier }` where
// action is exactly 'block' or 'allow'. This harness does NOT ship a real guard;
// plug in your own. It runs four fixture classes against it and reports:
//   - attacks:  must be blocked (a miss is a HOLE)
//   - benign:   must be allowed (a block is a FALSE POSITIVE)
//   - padding:  attacks wrapped in decoy noise, must still block (budget-exhaustion probe)
//   - gaps:     documented known-misses, asserted to STAY missed (drift tripwire)
//
// It also measures per-call latency against a budget. NOTE: the guard runs
// synchronously in-process, so this is a POST-CALL measurement, not a timeout —
// a guard that hangs forever hangs the harness. For untrusted or backtracking-
// prone guards, isolate calls in a worker/subprocess with a real timeout. The
// budget here catches "measurably too slow", which is what a linear guard needs.
//
// Zero dependencies. Node >= 18.

const VALID_ACTIONS = new Set(['block', 'allow']);

function runClass(guard, cases, label) {
  if (!Array.isArray(cases)) {
    throw new Error(`fixture class "${label}" must be an array (got ${cases === undefined ? 'undefined' : typeof cases})`);
  }
  const results = [];
  for (const c of cases) {
    let verdict, error = null, ms = 0;
    const t0 = process.hrtime.bigint();
    try {
      verdict = guard(c.command);
    } catch (e) {
      error = String((e && e.message) || e);
    }
    ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const action = verdict && verdict.action;
    // A verdict whose action is neither 'block' nor 'allow' is a contract
    // violation — surface it, never treat it as a silent pass.
    const invalid = !error && !VALID_ACTIONS.has(action);
    results.push({ ...c, action, tier: verdict && verdict.tier, error, invalid, ms });
  }
  return results;
}

// Evaluate a guard against a full fixture set.
// fixtures = { attacks, benign, padding, gaps } — each an ARRAY (may be empty)
//            of { label, command, [tier] }. All four keys are required so a
//            typo can't silently drop a whole class and still report clean.
// opts = { budgetMs } per-call latency ceiling (default 50)
function evaluate(guard, fixtures, opts = {}) {
  const budgetMs = opts.budgetMs != null ? opts.budgetMs : 50;
  for (const k of ['attacks', 'benign', 'padding', 'gaps']) {
    if (!(k in fixtures)) throw new Error(`fixtures is missing required class "${k}" (use an empty array to skip it)`);
  }
  const attacks = runClass(guard, fixtures.attacks, 'attacks');
  const benign = runClass(guard, fixtures.benign, 'benign');
  const padding = runClass(guard, fixtures.padding, 'padding');
  const gaps = runClass(guard, fixtures.gaps, 'gaps');

  // Errors are their own failing bucket — never folded into holes/FP counts,
  // because an exception is a broken guard, not a verdict.
  const errored = [...attacks, ...benign, ...padding, ...gaps].filter(r => r.error);
  const invalid = [...attacks, ...benign, ...padding, ...gaps].filter(r => r.invalid);

  // An attack/padding item is a HOLE when the guard did not cleanly block it.
  const holes = attacks.filter(r => !r.error && r.action !== 'block');
  const paddingHoles = padding.filter(r => !r.error && r.action !== 'block');
  // A benign item is a FALSE POSITIVE only when the guard actually blocked it
  // (an exception is counted under `errored`, not here — that was a real bug).
  const falsePositives = benign.filter(r => !r.error && r.action === 'block');
  // A documented gap that now blocks is progress to RE-DOCUMENT deliberately.
  const closedGaps = gaps.filter(r => !r.error && r.action === 'block');

  const all = [...attacks, ...benign, ...padding, ...gaps];
  const slow = all.filter(r => r.ms > budgetMs);
  const maxMs = all.reduce((m, r) => Math.max(m, r.ms), 0);

  // FP rate is over benign items that produced a clean verdict; errors are
  // reported separately so a thrown guard doesn't masquerade as 100% FP.
  const benignScored = benign.filter(r => !r.error);
  const fpRate = benignScored.length ? falsePositives.length / benignScored.length : 0;

  return {
    counts: {
      attacks: attacks.length, benign: benign.length,
      padding: padding.length, gaps: gaps.length,
    },
    holes, paddingHoles, falsePositives, closedGaps, slow, errored, invalid,
    falsePositiveRate: fpRate,
    maxLatencyMs: maxMs, budgetMs,
    // clean = every bucket empty. Errors and contract violations fail it too.
    clean: holes.length === 0 && falsePositives.length === 0 &&
           paddingHoles.length === 0 && slow.length === 0 &&
           closedGaps.length === 0 && errored.length === 0 && invalid.length === 0,
  };
}

function report(res) {
  const L = [];
  L.push(`attacks ${res.counts.attacks} · benign ${res.counts.benign} · padding ${res.counts.padding} · gaps ${res.counts.gaps}`);
  L.push(`false-positive rate: ${(res.falsePositiveRate * 100).toFixed(1)}%  (${res.falsePositives.length}/${res.counts.benign})`);
  L.push(`max latency: ${res.maxLatencyMs.toFixed(3)}ms  (budget ${res.budgetMs}ms, post-call)`);
  const line = (label, arr, fmt) => {
    if (!arr.length) return;
    L.push(`\n${label} (${arr.length}):`);
    arr.forEach(r => L.push(`  - ${r.label}: ${fmt(r)}`));
  };
  line('HOLES (attack not blocked)', res.holes, r => `action=${r.action}`);
  line('PADDING BYPASS', res.paddingHoles, r => `action=${r.action}`);
  line('FALSE POSITIVES (benign blocked)', res.falsePositives, r => `action=${r.action}`);
  line('GAP CLOSED (re-document deliberately)', res.closedGaps, r => `action=${r.action}`);
  line('ERRORED (guard threw)', res.errored, r => `error=${r.error}`);
  line('INVALID VERDICT (not block/allow)', res.invalid, r => `action=${JSON.stringify(r.action)}`);
  line('OVER LATENCY BUDGET', res.slow, r => `${r.ms.toFixed(1)}ms`);
  L.push(res.clean ? '\n✓ clean' : '\n✗ findings above');
  return L.join('\n');
}

module.exports = { evaluate, report, runClass };
