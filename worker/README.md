# WOWSERU AI ANIMASI — Cloudflare Worker v0.5.2

MCP endpoint: `/mcp`

## Deploy configuration
- Cloudflare Root directory: `worker` (folder containing this `package.json`, `server.js`, and `wrangler.jsonc`).
- Build command: none.
- Deploy command: `npx wrangler deploy` (or `npm run deploy`).
- Install dependencies from this directory with `npm install` before deploying if the dashboard does not install them automatically.

## Required bindings and migrations
- Durable Object binding: `APPROVALS` → class `ApprovalStore`.
- Migration: `v1` creates the SQLite-backed `ApprovalStore` class.
- Keep the class name and existing migration history stable. Do not create a second `v1` migration or remove an existing production migration.
- Approval records expire after two hours.

## MCP tools
1. `confirm_animation_brief`
2. `confirm_animation_lanjut`
3. `create_animation_concept`
4. `create_storyboard`
5. `generate_animation_prompts`

The server-level MCP instructions are generated from `skills/wowseru-ai-animasi/SKILL.md`; keep these synchronized when editing the skill. These tools produce concepts, storyboard text, and prompts. They do not render or export a final video file.

## Before production deployment
1. Confirm the Cloudflare Worker currently has the `APPROVALS` binding and the `ApprovalStore` migration applied.
2. Deploy to a staging Worker first if available.
3. Verify `/mcp` initialization and all five tools.
4. Test OK → LANJUT persistence across separate requests and Worker isolates.
5. Only then deploy to the production Worker.
