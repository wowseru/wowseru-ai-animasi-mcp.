# WOWSERU AI ANIMASI — Cloudflare Worker v0.3.3

MCP endpoint: `/mcp`

## Deploy configuration
- Cloudflare Root directory: `worker`
- Build command: None
- Deploy command: `npx wrangler deploy`

## Approval persistence
Approval state for `OK` → `LANJUT` → production is stored in the SQLite-backed
Cloudflare Durable Object class `ApprovalStore`, through the `APPROVALS` binding.
Records expire after two hours.

The `wrangler.jsonc` file declares the `APPROVALS` binding and the `v1` migration.
Keep the Durable Object class name `ApprovalStore` stable after deployment.

## MCP tools
1. `confirm_animation_brief`
2. `confirm_animation_lanjut`
3. `create_animation_concept`
4. `create_storyboard`
5. `generate_animation_prompts`

These tools produce concepts, storyboard text, and prompts. They do not render
or export a final video file.
