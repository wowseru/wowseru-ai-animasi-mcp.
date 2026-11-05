WOWSERU AI ANIMASI v0.4.6 — REVIEW CASES FIXED

Paket ini menggunakan satu format portable Agent Plugins:
- plugin.json di root
- mcp.json di root
- skills/wowseru-ai-animasi/SKILL.md
- assets/

Perbaikan:
- Mempertahankan format brief baku secara persis.
- Mempertahankan alur MULAI -> brief -> konsep -> OK -> LANJUT -> paket produksi lengkap.
- Mengisi tepat 5 positive test cases dan 3 negative test cases di extensions.com.openai.review.test_cases.
- Menambahkan demo_recording_url YouTube dan release_notes.
- Menghapus manifest kompatibilitas tambahan (.codex-plugin, .agent-plugin, .claude-plugin), .mcp.json, dan app.json agar paket submission tidak memiliki beberapa manifest/config yang berpotensi membingungkan importer.

PENTING SEBELUM SUBMIT:
- Setelah upload, periksa apakah dashboard mengimpor 5 test cases dan 3 negative test cases. Jika masih tidak muncul, jangan submit; kirim screenshot hasil upload dan versi paket yang terpilih.
- Video walkthrough: https://www.youtube.com/watch?v=4m8VR_rFOeU. Pastikan akses video Public atau Unlisted.
- URL website/support/privacy/terms yang tercantum di listing sebelumnya harus diverifikasi benar-benar aktif dan sesuai dengan publisher. Jangan submit dengan URL placeholder atau halaman yang tidak tersedia.
- Jalankan semua test case pada server MCP live sebelum submission.
