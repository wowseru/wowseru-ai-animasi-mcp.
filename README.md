# WOWSERU AI ANIMASI

Repository ini mempertahankan paket plugin lengkap dan menyertakan source MCP/Worker.

## Struktur
- `plugin.json`, `.codex-plugin/`, `.claude-plugin/`, `.agent-plugin/`, `.mcp.json`, `app.json`: manifest/integrasi plugin dari paket v0.4.2.
- `assets/`: seluruh logo dan ikon asli dari paket v0.4.2.
- `skills/wowseru-ai-animasi/SKILL.md`: dokumen instruksi terbaru dari pengguna, termasuk koreksi judul List STYLE dan List GAYA.
- `worker/`: adaptasi Cloudflare Worker v0.3.2.
- `starter/`: starter MCP + Fastify TypeScript v0.3.2.

## Menjalankan Worker
```bash
cd worker
npm install
npx wrangler dev
```
Deploy staging terlebih dahulu:
```bash
npx wrangler deploy
```

## Penting: status validasi
Worker source yang disertakan masih berasal dari adaptasi v0.3.2. Status OK/LANJUT disimpan di `Map` dalam memori dan dapat hilang saat isolate berubah/restart. Ini belum merupakan penyimpanan persetujuan tahan lama. Sebelum produksi, implementasikan Durable Objects/KV sesuai desain yang diuji, lalu jalankan integration test untuk lima tool MCP. Jangan menganggap ZIP ini sudah di-deploy atau production-verified.
