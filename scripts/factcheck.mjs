#!/usr/bin/env node
/**
 * Opt-in stub — full automated fact-checking is not reliable without curated
 * sources and human review. This script does NOT call LLMs and must not block
 * merge. Use `npm run factcheck` or workflow_dispatch only.
 *
 * Practical substitute in CI: `npm run check:citations` (structural sources).
 */
console.log(`nabecco factcheck (stub)
-----------------------
Automated claim verification is out of scope for default CI.
Use:
  - npm run check:citations   # require links / 出典 in substantial sections
  - human review before publish (POLICY.md)

No API keys required; exiting 0.`);
process.exit(0);
