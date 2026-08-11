# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/).
This project does not cut versioned releases yet; changes accumulate here under
Unreleased, and link references will be added when a first tag exists.

## [Unreleased]

### Added

- `package.json`: `npm test` runs the same two suites CI runs, and `"dependencies": {}` makes the zero-dependency claim machine-checkable rather than a boast. `engines.node` records the `>=18` floor the README already stated. No lockfile, because there is nothing to lock.
- CI status badge linking to the workflow, plus node / zero-dependency / license badges.
- This changelog.

### Changed

- The negative-control suite now covers all seven finding buckets. The README claimed "one per finding bucket" while two buckets — padding bypass and the latency budget — had no control proving they can fail. Added both, and corrected the count.
- **`test_redos.js` is now described as a shape probe, with its scope stated.** The README said it "feeds pathological long inputs and asserts per-byte cost stays roughly flat, catching the catastrophic-backtracking failure mode specifically" — which reads as a general ReDoS clearance. It grows one input family (long runs of repeated characters), so a matcher that backtracks on a different character class passes it clean. The test now ships its own negative control (a deliberately quadratic matcher, which must breach the shape assertion), so the assertion is falsifiable rather than decorative.
- **The bundled fixtures are now described as a smoke test, not a measurement.** The README previously showed `false-positive rate: 0.0% (0/7)` with nothing qualifying it. Seven hand-picked benign commands cannot establish a false-positive rate, and a repo whose argument is that people report those rates dishonestly should not quote one of its own as evidence. The number still appears — it is real output — but it is now labelled for what it is, with a note on what a real benign corpus would require.
- The companion write-up is now a working link rather than an italic title.

### Fixed

- **A padding fixture label misstated its own construction.** It claimed "400 decoy no-ops (~1.2KB)"; the command contains 316 no-ops and is 1292 bytes. Corrected to the exact figures, and `test_harness.js` now machine-checks any padding label that claims a decoy count, so the label cannot drift from the fixture again.
- **`test_redos.js` normalized per-character cost by the nominal run length.** The input for run length `len` is `2*len + 6` characters, so the printed µs/char figures were double the true values. The input builder is now the single source of truth for both timing and normalization. Neither assertion was affected — the absolute ceiling uses raw medians and the growth ratio is scale-invariant — so no reported pass/fail changes.
