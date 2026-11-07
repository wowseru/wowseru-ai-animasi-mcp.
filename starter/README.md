# WOWSERU AI ANIMASI — MCP + Fastify (v0.3.2)

Revisi output tools untuk mendekatkan struktur konsep, storyboard, dan prompt produksi pada skill asli. Fondasi server membawa skill asli dari `WOWSERU ANIMASI.zip` ke metadata instruksi MCP. Skill asli disimpan di `skills/wowseru-ai-animasi/SKILL.md` dan dimuat saat server mulai.

## Yang dipertahankan dari skill
- Pembuka `Mulai`, enam jenis animasi, sebelas gaya visual, dan template brief.
- Konfirmasi eksplisit: brief → `OK` → tunggu `LANJUT`.
- Prompt visual berbahasa Inggris; narasi sesuai bahasa yang diminta.
- Enam panel storyboard per scene, timing, continuity lock, konsistensi produk/karakter, dan negative constraints.
- Tidak mengklaim menghasilkan video final.

## Persyaratan
- Node.js 20 atau lebih baru
- npm

## Jalankan lokal
```bash
npm install
npm run typecheck
npm run dev
```

Health check: http://localhost:8787/health  
MCP endpoint: http://localhost:8787/mcp

## Tools MCP
- `confirm_animation_brief`: catat brief dan terbitkan `approval_id` setelah pengguna menyetujui dengan `OK`.
- `confirm_animation_lanjut`: catat `LANJUT` untuk `approval_id` yang sama.
- `create_animation_concept`
- `create_storyboard`
- `generate_animation_prompts`

Tool produksi sekarang mensyaratkan `approval_id` yang diterbitkan server dan status `LANJUT` yang tercatat. Konsep juga harus menggunakan teks brief yang sama dengan brief yang disetujui. Status disimpan dalam Map di memori proses dengan masa berlaku dua jam; restart server akan menghapusnya. Ini lebih kuat daripada boolean yang bisa dikirim langsung ke tool produksi, tetapi belum membuktikan sendiri bahwa teks `OK`/`LANJUT` benar-benar diketik manusia: MCP client/model masih mengirim nilai konfirmasi. Sebelum publik, ikat status ke identitas sesi/pengguna terautentikasi dan simpan secara persisten (misalnya PostgreSQL), serta tambahkan rate limiting dan pengujian keamanan.

## Perubahan v0.3.2
- Konsep menyertakan hook, prompt thumbnail, timing per scene, dan continuity checklist.
- Storyboard berisi enam panel dengan timing, arahan kamera, dan prompt gambar bahasa Inggris untuk setiap panel.
- Prompt produksi berisi struktur continuity lock, subject/product consistency, dan timing aksi.
- Header menggunakan tanda hubung ASCII agar tidak bergantung pada tampilan em dash di terminal.

## Status dan batasan
Ini adalah starter integrasi, bukan layanan produksi yang sudah terverifikasi. Kode belum berhasil diuji dengan instalasi dependency atau MCP Inspector dalam lingkungan ini. Belum ada database, autentikasi, rate limit, frontend, generator media, atau publikasi ChatGPT. Uji `npm install`, `npm run typecheck`, dan MCP Inspector sebelum deploy.


## v0.3.2 notes
- Storyboard prompts now use ASCII section punctuation to avoid common Windows terminal encoding artifacts.
- Six panels have differentiated visual actions, transition intent, and stronger continuity constraints.
- Includes narration/sound-design notes and explicitly states that storyboard output is text, not rendered images.
