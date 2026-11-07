# WOWSERU AI Animasi MCP — Cloudflare Worker adaptation of v0.3.2

Files:
- `server.js`: Worker entry point, 5 MCP tools, health endpoints.
- `package.json`: dependency versions aligned to the successfully deployed Cloudflare build.
- `wrangler.jsonc`: Worker configuration.
- `skills/wowseru-ai-animasi/SKILL.md`: original v0.3.2 skill reference.

## Important limitations before public use

1. Approval state (`OK` → `LANJUT`) is stored in a JavaScript `Map` in memory. Cloudflare Workers may use different isolates and can restart, so this is not durable or a secure proof of human approval. Use Durable Objects or another persistent store bound to an authenticated user/session before treating it as a production gate.
2. This package has been prepared from the supplied v0.3.2 starter and the known working Cloudflare handler pattern, but must be tested in a staging Worker before replacing the current live Worker.
3. Tools generate text concepts and prompts, not rendered images or videos.

## Deploy safely

Deploy first to a separate staging Worker name by changing `name` in `wrangler.jsonc` (for example `wowseru-ai-animasi-staging`), test `/`, `/health`, and `tools/list`, and only then decide whether to deploy to the production Worker.
