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

- **The bundled fixtures are now described as a smoke test, not a measurement.** The README previously showed `false-positive rate: 0.0% (0/7)` with nothing qualifying it. Seven hand-picked benign commands cannot establish a false-positive rate, and a repo whose argument is that people report those rates dishonestly should not quote one of its own as evidence. The number still appears — it is real output — but it is now labelled for what it is, with a note on what a real benign corpus would require.
- The companion write-up is now a working link rather than an italic title.
