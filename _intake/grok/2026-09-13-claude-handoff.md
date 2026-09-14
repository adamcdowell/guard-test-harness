# Claude Handoff — 2026-09-13

## For Claude (read this first)

1. **GitHub is sparse.** The public repos under adamcdowell only contain a fraction of what lives on the local system. There is good work — agent orchestration, retrieval evals, guard harnesses, MCP wiring — that has not been published. Inventory the local projects, decide what is safe and worth showing, and push the missing pieces. Do not invent content; pull from the actual files.

2. **Antigravity GitHub MCP is a priority.** Codex and Grok are already connected to GitHub. Antigravity is not confirmed. Set it up so the agent can read and push repos directly. Steps:
   - Generate a GitHub PAT at github.com/settings/tokens with `repo`, `read:org`, `read:user` scopes.
   - In Antigravity: Agent panel → `…` → MCP Servers → Manage MCP Servers → View raw config.
   - Add to `~/.gemini/antigravity/mcp_config.json` (macOS/Linux) or the Windows equivalent:
     ```json
     {
       "mcpServers": {
         "github": {
           "serverUrl": "https://api.githubcopilot.com/mcp/",
           "headers": { "Authorization": "Bearer YOUR_GITHUB_PAT" }
         }
       }
     }
     ```
   - Restart Antigravity and verify with "list my repositories."
   - Official guide: github.com/github/github-mcp-server/blob/main/docs/installation-guides/install-antigravity.md

3. **Agent loop is hand-rolled, not LangChain.** verify-stage runs a fleet via Claude Code's `agent()` / `pipeline()` / `parallel()` — safety gate, extraction, adversarial red-team, 24 agents, structured JSON, read-only rules. frozen-ruler is pure Python BM25 + dense + RRF with frozen sha256 benchmarks. guard-test-harness is a zero-dependency Node eval rig. No `langchain` imports anywhere. The pattern (model reasons → calls tools → loops) matches what LangChain wraps, but it is written directly on Claude Code. That is the stronger story for the LangChain Deployed Engineer role.

4. **Set up Codex for LinkedIn.** LinkedIn has no official MCP server. Use the community one that ships a Codex plugin: stickerdaniel/linkedin-mcp-server. It reads your logged-in browser session (no official API keys needed) and exposes job search, profiles, companies, and messaging. Install:
   ```bash
   codex plugin marketplace add stickerdaniel/linkedin-mcp-server
   codex plugin add linkedin-mcp-server@linkedin-mcp-server
   ```
   On first authenticated call it opens a LinkedIn login window; session is cached under `~/.linkedin-mcp`. Disable the bundled MCP independently in `~/.codex/config.toml` if needed:
   ```toml
   [plugins."linkedin-mcp-server".mcp_servers.linkedin]
   enabled = false
   ```
   Alternative (hosted, paid): Linked API — `codex mcp add linkedapi --url "https://mcp.linkedapi.io?linked-api-token=...&identification-token=...&client=codex"`. Prefer the free browser-session plugin first.

## Repos currently on GitHub (public)

- **verify-stage** — agent fleet for vetting untrusted repos. 4 files: workflow.js, README, CASE-STUDY, LICENSE.
- **frozen-ruler** — retrieval eval harness, frozen-benchmark discipline. Python, BM25 + dense + RRF, paired sign tests.
- **guard-test-harness** — zero-dependency Node eval rig for command guards. Fixtures, attacks, accepted gaps.
- **portfolio** — single hand-written HTML file.

## What to do

- Fill the gap between local system and these repos.
- Keep the handoff updated as new work lands.
- This file is the source of truth for the Claude side of the planning loop.
