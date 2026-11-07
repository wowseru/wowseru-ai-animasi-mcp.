# WOWSERU AI ANIMASI MCP

Repository layout:

- `worker/` — Cloudflare Worker MCP server source.
- `plugin/` — plugin manifest and skill package.

## Cloudflare Worker

```bash
cd worker
npm install
npm run dev
npm run deploy
```

Worker routes:
- `/` service information
- `/health` health check
- `/mcp` MCP endpoint

Approval state is designed to use a Durable Object binding named `APPROVALS`.

## Important verification before production

The Worker is assembled from the supplied v0.3.2 source and updated skill document. Before relying on it:
1. Run `npm install` and validate dependency versions against the current Cloudflare Agents/MCP SDK.
2. Run local integration tests for `confirm_animation_brief` → `confirm_animation_lanjut` → all three production tools.
3. Confirm that the MCP runtime passes `extra.env` to tool callbacks as expected; if not, adapt handlers to the runtime's supported execution context API.
4. Deploy to a staging Worker and verify persistence across separate requests/isolates.
5. Only then deploy to the production Worker.

The existing plugin manifest schema may require adjustments to match the target platform's current requirements.
