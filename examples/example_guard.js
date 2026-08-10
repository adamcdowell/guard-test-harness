'use strict';
// example_guard.js — a DELIBERATELY SMALL, ILLUSTRATIVE guard so the harness is
// runnable out of the box. This is NOT a production guard, and it deliberately
// shares no rule text with any real one. It knows exactly one attack shape
// (a downloader token feeding a shell token through a pipe) and is easy to fool;
// that is the point — it gives the harness something to find.
//
// Publish the HARNESS, not the rules. A real guard belongs in your own repo.
//
// Contract: (command: string) => { action: 'block'|'allow', tier: string|null }

// Structural, token-based detector (not a monolithic regex): tokenize on
// whitespace and pipes, then look for a downloader token that reaches a shell
// token with a pipe in between. Intentionally flat: it only sees the top-level
// token stream, so anything tucked inside $(...) or backticks is invisible.
const DOWNLOADERS = new Set(['curl', 'wget', 'fetch', 'aria2c']);
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash']);

function guard(command) {
  if (typeof command !== 'string' || command === '') return { action: 'allow', tier: null };

  // Strip a shell comment (# to end of line) the way a shell would, so a
  // trailing "# note" after a piped shell doesn't hide the invocation.
  const stripped = command.replace(/#.*$/s, '');

  // Split into pipe segments; a pipe-to-shell needs a downloader in some segment
  // and a bare shell invocation in a LATER segment.
  const segments = stripped.split('|');
  let sawDownloader = false;
  for (const seg of segments) {
    const tokens = seg.trim().split(/\s+/);
    if (sawDownloader) {
      // A shell as the FIRST real token of a later segment = piped into a shell.
      // Skip a leading `sudo`. Ignore shells that carry a script path argument
      // (e.g. `bash ./install.sh` reads a local file, not the piped stream) by
      // only flagging a shell with no positional script (bare, or `-s`/`-c`).
      let i = 0;
      if (tokens[i] === 'sudo') i++;
      const head = tokens[i];
      const rest = tokens.slice(i + 1);
      const readsStdin = rest.length === 0 || rest.every(t => t.startsWith('-'));
      if (SHELLS.has(head) && readsStdin) return { action: 'block', tier: '1' };
    }
    if (tokens.some(t => DOWNLOADERS.has(t))) sawDownloader = true;
  }
  return { action: 'allow', tier: null };
}

module.exports = { guard };
