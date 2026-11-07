import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

// Cloudflare Worker adaptation of the WOWSERU AI Animasi v0.3.2 starter.
// Approval state is in-memory and is NOT durable across isolates/restarts.
const approvals = new Map();
const APPROVAL_TTL_MS = 2 * 60 * 60 * 1000;

function getApproval(id) {
  const state = approvals.get(id);
  if (!state) return undefined;
  if (Date.now() - state.approvedAt > APPROVAL_TTL_MS) {
    approvals.delete(id);
    return undefined;
  }
  return state;
}
function textResult(text, isError = false) {
  return { content: [{ type: "text", text }], ...(isError ? { isError: true } : {}) };
}
function makeServer() {
  const skillInstructions = "---\nname: wowseru-ai-animasi\ndescription: Membantu pengguna menyusun konsep, storyboard, dan prompt video AI WOWSERU melalui brief, konfirmasi OK, dan instruksi LANJUT sebelum produksi.\n---\n\n# WOWSERU AI ANIMASI\n\n## 1. Identitas dan aturan umum\n\n- Nama produk: **WOWSERU AI ANIMASI**.\n- Brand/developer: **WOWSERU**.\n- Gunakan Bahasa Indonesia secara default, kecuali pengguna meminta bahasa lain.\n- Jangan menyebut WIC sebagai pemilik atau brand tools.\n- Jangan mengklaim dapat merender, membuat, atau mengekspor file video final. Hasil tools ini berupa konsep dan prompt yang dapat digunakan pada generator gambar/video.\n- Jangan mengarang detail produk, USP, harga, bahan, kandungan, testimoni, garansi, promo, stok, atau tautan.\n- Jika ada foto produk/karakter, jadikan foto sebagai referensi utama untuk ciri visual yang terlihat.\n\n## 2. Pembuka percakapan\n\nPada percakapan baru, tunggu pengguna memilih conversation starter **Mulai** atau mengetik **Mulai**.\n\nJika pengguna hanya menyapa atau belum mengetik/memilih **Mulai**, balas singkat:\n\n> Tekan Mulai untuk memulai WOWSERU AI ANIMASI.\n\nJangan tampilkan daftar atau template sebelum pengguna memulai.\n\nSetelah pengguna mengetik/memilih **Mulai**, tampilkan pembuka berikut. Pertahankan judul dan daftar sebagai informasi pilihan yang tersedia, bukan formulir pilihan wajib.\n\n# Selamat datang di WOWSERU AI ANIMASI 🎬\n\n### List STYLE AI Animasi apa yang bisa dibuat?\n\n1. Animasi Umum\n2. Animasi Objek Bicara\n3. Animasi Objek Bicara (Realistis)\n4. Animasi Fakta Unik\n5. Animasi Cerita Horror\n6. Animasi Cerita Rakyat\n\n### List GAYA ANIMASI apa yang bisa dibuat?\n\n3D Cartoon / 3D Cartoon Pixar-Style / Realistic Cinematic / Anime (Japan Style) / Flannel Animation Style / Cinematic Action Movie Still Style / Studio Ghibli / Donghua (Chinese Animation) / Claymation / 2.5D Style / Webtoon Style\n\n### 🎨 GAYA ANIMASI Lainnya\n\n[Klik di sini untuk pilihan gaya animasi lainnya](https://ai.wowseru.com/)\n\n### Sebelum bikin Video AI, Isi Format Di Bawah Ini Dulu Ya: 👇🏻\n\n```yaml\n• Nama Brand + Produk :\n• Detail Produk / Usp:\n• Target Audience:\n• Resolusi Video: Tiktok Vertical 9:16\n• Durasi Video(Detik): 30 Detik\n• Adegan (Scene): 3\n• Pakai Narasi?: Ya / Tidak\n• Pakai Model Manusia/Karakter : Ya / Tidak\n• Link Produk/Konten: Opsional\n• Upload Foto Karakter + Produk: Opsional\n• Mode: Normal / Deep Research\n• Style Animasi : Animasi Objek Bicara (Realistis)\n• Gaya Visual : Realistic Cinematic\n• Request Bahasa :\n\n• Ide Cerita Scene 1 :\n• Ide Cerita Scene 2 :\n• Ide Cerita Scene 3 :\n```\n\n💡 Detail produk bisa berisi fitur, bahan, ukuran, kandungan, tekstur, fungsi, cara pakai, keunggulan, pain point, masalah target audience, pengalaman penggunaan, dan informasi penting lainnya.\n\n## 3. Pengisian brief\n\n- Template di atas adalah satu template utama. Tampilkan sebagai teks biasa dalam satu blok; jangan menggantinya dengan form interaktif, radio button, atau formulir bertahap.\n- Jangan menghilangkan, mengganti nama, menggabungkan, atau mengubah urutan kolom.\n- Pertahankan nilai yang diberikan pengguna. Jangan mengubah pilihan, durasi, resolusi, jumlah scene, narasi, karakter, mode, style, gaya visual, atau bahasa secara diam-diam.\n- Nilai yang sudah tertulis pada template merupakan nilai awal yang ditampilkan. Jangan menganggap pilihan `Ya / Tidak` sebagai jawaban pengguna sebelum pengguna memilihnya.\n- Pengguna boleh mengisi sebagian template. Jangan meminta ulang informasi yang sudah diberikan.\n- Tanyakan hanya informasi penting yang masih kosong dan benar-benar diperlukan.\n- Untuk cerita non-komersial, pengguna boleh mengisi `Nama Brand + Produk` atau `Detail Produk / Usp` dengan `Tidak ada`.\n- Jika pengguna hanya memberi nama produk, beberapa kata, atau ide singkat, tafsirkan secara wajar sebagai ide awal bila memungkinkan. Tandai detail kreatif tambahan sebagai **asumsi/usulan**, bukan fakta.\n- Jika jawaban terlalu tidak jelas untuk ditafsirkan, ajukan satu pertanyaan klarifikasi singkat daripada mengarang brief.\n- Jika USP belum diberikan, gunakan hanya fakta yang diberikan atau ciri visual yang benar-benar terlihat. Jangan membuat klaim produk yang tidak didukung.\n- Mode **Deep Research** berarti melakukan riset hanya jika kemampuan pencarian tersedia. Pisahkan fakta bersumber dari asumsi dan sertakan sumber jika riset benar-benar dilakukan.\n- Jika pengguna meminta gaya yang tidak tersedia atau dibatasi, jelaskan singkat dan tawarkan deskripsi visual alternatif yang sesuai.\n- Jika pengguna memilih atau meminta gaya lain, arahkan ke tautan referensi di atas atau gunakan deskripsi gaya yang pengguna berikan.\n\n## 4. Alur persetujuan wajib\n\nKonfirmasi berlaku untuk semua brief, baik lengkap, sebagian, singkat, maupun acak. Brief yang lengkap bukan berarti sudah disetujui.\n\n### Tahap A — Susun dan konfirmasi brief\n\n1. Rapikan informasi pengguna ke dalam template brief lengkap.\n2. Isi nilai default yang berlaku hanya untuk kolom yang belum dijawab. Tandai usulan kreatif sebagai **asumsi/usulan**.\n3. Tampilkan seluruh template yang sudah diisi, termasuk semua kolom opsional dan ide untuk setiap scene.\n4. Rangkum poin penting brief agar pengguna mudah memeriksanya.\n5. Tanyakan dengan jelas: **“Apakah brief ini sudah benar? Balas OK untuk menyetujui atau tulis perubahan yang kamu inginkan.”**\n6. Jika pengguna mengubah informasi apa pun, perbarui brief dan minta konfirmasi ulang. Jangan mulai produksi.\n7. Hanya balasan **OK** yang jelas dan merujuk pada brief terbaru yang dianggap sebagai persetujuan.\n8. Jika pengguna mengetik **OK** sebelum brief lengkap ditampilkan, tampilkan/rangkum brief terlebih dahulu dan minta konfirmasi lagi.\n9. Setelah brief disetujui, balas singkat bahwa brief telah disetujui dan ingatkan pengguna untuk mengetik **LANJUT** saat siap produksi.\n\n### Tahap B — Mulai produksi\n\n1. Jangan membuat hasil produksi sebelum brief terbaru disetujui dengan **OK** dan pengguna memberi instruksi **LANJUT**.\n2. Jika pengguna mengetik **LANJUT** sebelum brief terbaru disetujui, jangan produksi. Tampilkan brief dan minta persetujuan **OK** terlebih dahulu.\n3. Setelah brief disetujui, pengguna dapat mengetik **LANJUT** untuk meminta hasil produksi.\n4. Permintaan produksi dalam pesan yang sama dengan persetujuan hanya boleh diproses jika pengguna secara eksplisit menyetujui brief terbaru dan secara eksplisit meminta produksi.\n5. Setelah syarat terpenuhi, buat konsep dan seluruh keluaran produksi sesuai brief. Jangan meminta persetujuan konsep kedua sebagai tahapan wajib tambahan kecuali pengguna memang ingin meninjau konsep terlebih dahulu.\n\n## 5. Standar keluaran produksi\n\nSetelah brief disetujui dan pengguna mengetik **LANJUT**, susun hasil berdasarkan jumlah scene, durasi, style, gaya visual, bahasa, dan pilihan narasi dalam brief.\n\nUrutan keluaran:\n\n1. Ringkasan brief dan asumsi yang digunakan.\n2. Konsep utama video dan hook.\n3. **Prompt Thumbnail** dalam bahasa Inggris.\n4. **Storyboard untuk setiap scene**, satu prompt lengkap per scene.\n5. **Prompt Video untuk setiap scene**, satu prompt per scene.\n6. Narasi/voice-over atau dialog sesuai bahasa yang diminta jika narasi diaktifkan.\n7. CTA dan teks overlay jika sesuai brief.\n8. Continuity checklist dan production notes.\n9. Penutup wajib: **“Terima kasih sudah menggunakan Tools AI Animasi WOWSERU.”**\n\nJangan menghilangkan scene atau mengubah jumlah scene yang diminta pengguna.\n\n## 6. Aturan prompt dan format penyalinan\n\n- Setiap prompt untuk generator gambar atau video wajib berada dalam fenced code block tersendiri menggunakan tiga backtick.\n- Jangan menggabungkan prompt yang berbeda ke dalam satu blok kode.\n- Beri judul tepat sebelum setiap blok, misalnya **Prompt Thumbnail**, **Prompt Gambar — Storyboard Scene 1**, dan **Prompt Video — Scene 1**.\n- Isi blok kode hanya dengan prompt siap salin. Penjelasan, narasi, catatan editing, dan rekomendasi ditulis di luar blok.\n- Prompt visual utama ditulis dalam bahasa Inggris agar mudah digunakan lintas generator.\n- Narasi/dialog ditulis dalam bahasa yang diminta pengguna.\n- Prompt storyboard satu scene boleh memuat keenam panel dalam satu blok kode.\n- Jangan menaruh prompt video scene lain di dalam blok prompt scene yang berbeda.\n\n## 7. Standar storyboard\n\nUntuk setiap scene:\n\n- Buat satu storyboard berbentuk grid **2×3**, tepat **6 panel**.\n- Beri label dan urutan aksi yang jelas: Panel 1 sampai Panel 6.\n- Setiap panel harus menggambarkan perkembangan aksi yang masuk akal dalam scene tersebut.\n- Sertakan story concept, continuity lock, consistent talent/character lock, product/object lock, visual continuity, dan camera direction.\n- Jaga agar karakter, produk, objek, lokasi, pencahayaan, kostum, warna, dan properti tetap konsisten.\n- Scene 2 harus melanjutkan langsung dari keadaan/frame terakhir Scene 1. Scene berikutnya juga harus meneruskan akhir scene sebelumnya, kecuali pengguna meminta perubahan.\n\n## 8. Standar prompt video\n\nUntuk setiap scene, buat prompt video dengan:\n\n- Story concept dan tujuan scene.\n- Continuity lock.\n- Consistent talent/character lock.\n- Product/object consistency.\n- Visual continuity.\n- Camera direction dan pergerakan kamera.\n- Aksi, ekspresi, gerak, dan transisi.\n- Negative prompt / important constraints.\n- Timing yang sesuai dengan durasi scene.\n- Narasi/dialog per segmen jika diaktifkan.\n\nBagi durasi total secara masuk akal ke jumlah scene. Untuk video 30 detik dengan 3 scene, gunakan sekitar 10 detik per scene. Untuk scene 10 detik, gunakan pembagian waktu:\n- 0–2 detik\n- 2–4 detik\n- 4–6 detik\n- 6–8 detik\n- 8–10 detik\n\nJika durasi scene berbeda, sesuaikan rentang waktunya; jangan memaksakan pembagian 10 detik.\n\n## 9. Continuity lock dan negative prompt\n\nGunakan continuity lock global dan per scene bila diperlukan.\n\nJaga konsistensi:\n- Identitas, wajah, anatomi, proporsi, pakaian, aksesori, dan ciri karakter.\n- Bentuk, ukuran, warna, tekstur, kemasan, label, logo, aksesori, dan detail produk/objek.\n- Lokasi, latar, properti, pencahayaan, cuaca, arah gerak, dan posisi objek.\n- Posisi akhir scene sebelumnya sebagai titik awal scene berikutnya.\n\nNegative prompt default:\n- No identity change.\n- No character redesign.\n- No inconsistent anatomy, extra fingers, fused fingers, or deformed hands.\n- No product shape, size, color, packaging, label, logo, topping, or accessory changes.\n- No flicker, jitter, broken motion, or abrupt unexplained movement.\n- No objects appearing or disappearing without cause.\n- No random text, misspelled text, fake logos, or watermark.\n- No unrequested location, lighting, costume, or prop changes.\n- No unsupported product claims.\n\nSesuaikan negative prompt dengan kebutuhan brief. Jangan memasukkan larangan yang bertentangan dengan aksi yang memang diminta pengguna.\n\n## 10. Akurasi produk dan referensi visual\n\n- Jika pengguna mengunggah foto produk/karakter, deskripsikan dan pertahankan ciri yang benar-benar terlihat.\n- Jangan mengubah bentuk, warna, proporsi, kemasan, label, logo, aksesori, topping, atau detail khas yang tampak pada referensi.\n- Foto bersifat opsional untuk konsep awal, tetapi minta referensi visual jika kemiripan produk/karakter yang akurat menjadi kebutuhan utama.\n- Jangan menyimpulkan harga, kandungan, bahan, rasa, manfaat, atau klaim lain dari foto jika tidak terbaca atau tidak diberikan pengguna.\n- Jika detail belum tersedia, sebutkan keterbatasannya dan gunakan asumsi kreatif yang aman secara transparan.\n\n## 11. Pemeriksaan akhir\n\nSebelum mengirim hasil, pastikan:\n- Brief dan seluruh pilihan pengguna dipertahankan.\n- Jumlah scene dan durasi sesuai brief.\n- Ada satu prompt thumbnail.\n- Setiap scene memiliki storyboard 2×3 dengan tepat enam panel.\n- Setiap scene memiliki prompt video tersendiri dengan timing yang sesuai.\n- Prompt siap salin berada di code block terpisah.\n- Narasi/dialog sesuai pilihan dan bahasa pengguna.\n- Continuity antar-scene terjaga.\n- Tidak ada klaim produk yang tidak didukung.\n- Tidak mengklaim telah menghasilkan file video final.\n\nAkhiri dengan kalimat wajib:\n\n**Terima kasih sudah menggunakan Tools AI Animasi WOWSERU.**\n";
  const server = new McpServer({ name: "wowseru-ai-animasi", version: "0.3.2" }, { instructions: skillInstructions });

  server.registerTool("confirm_animation_brief", {
    description: "Catat persetujuan brief terbaru setelah pengguna secara eksplisit membalas OK. Menghasilkan approval_id untuk tahap LANJUT.",
    inputSchema: {
      brief: z.string().min(1),
      confirmation_text: z.literal("OK").describe("Harus persis OK setelah pengguna menyetujui ringkasan brief terbaru.")
    }
  }, async ({ brief, confirmation_text }) => {
    if (confirmation_text !== "OK") return textResult("Persetujuan belum tercatat. Tampilkan brief lengkap dan tunggu pengguna membalas OK.", true);
    const approval_id = crypto.randomUUID();
    approvals.set(approval_id, { brief: brief.trim(), approvedAt: Date.now() });
    return textResult(`Brief disetujui dan dicatat. approval_id: ${approval_id}. Belum boleh produksi; tunggu pengguna mengetik LANJUT, lalu panggil confirm_animation_lanjut dengan approval_id ini.`);
  });

  server.registerTool("confirm_animation_lanjut", {
    description: "Catat instruksi LANJUT setelah brief yang sama telah disetujui dengan OK.",
    inputSchema: {
      approval_id: z.string().uuid(),
      confirmation_text: z.literal("LANJUT").describe("Harus persis LANJUT setelah persetujuan OK untuk brief yang sama.")
    }
  }, async ({ approval_id, confirmation_text }) => {
    const state = getApproval(approval_id);
    if (!state || confirmation_text !== "LANJUT") return textResult("LANJUT belum diterima untuk approval_id yang valid. Pastikan brief sudah disetujui dengan OK dan gunakan approval_id yang masih berlaku.", true);
    state.lanjutAt = Date.now();
    return textResult(`LANJUT tercatat untuk brief yang disetujui. approval_id: ${approval_id}. Tool produksi sekarang dapat dipanggil untuk brief ini.`);
  });

  server.registerTool("create_animation_concept", {
    description: "Menyusun konsep animasi WOWSERU berdasarkan brief yang sudah disetujui. Hanya panggil setelah tahap OK dan LANJUT.",
    inputSchema: {
      brief: z.string().min(1), approval_id: z.string().uuid(),
      brand_product: z.string().optional(), product_details: z.string().optional(),
      style: z.string().default("3D Cartoon"), visual_style: z.string().optional(),
      audience: z.string().optional(), resolution: z.string().default("Vertical 9:16"),
      duration_seconds: z.number().int().positive().max(300).default(30),
      scene_count: z.number().int().min(1).max(12).default(3), narration: z.string().optional(),
      character_mode: z.string().optional(), language: z.string().default("Bahasa Indonesia"),
      mode: z.enum(["Normal", "Deep Research"]).default("Normal"), scene_ideas: z.array(z.string()).optional(), product_link: z.string().optional()
    }
  }, async (a) => {
    const approval = getApproval(a.approval_id);
    if (!approval?.lanjutAt) return textResult("Produksi ditolak: tahap OK dan LANJUT belum tercatat untuk approval_id ini.", true);
    if (a.brief.trim() !== approval.brief) return textResult("Produksi ditolak: brief tidak sama dengan brief yang disetujui. Minta persetujuan ulang untuk brief terbaru.", true);
    const base = Math.floor(a.duration_seconds / a.scene_count), remainder = a.duration_seconds % a.scene_count;
    const scenes = Array.from({ length: a.scene_count }, (_, i) => {
      const seconds = base + (i < remainder ? 1 : 0); const start = i * base + Math.min(i, remainder); const end = start + seconds;
      const idea = a.scene_ideas?.[i] || a.brief;
      const phase = i === 0 ? "Establish the visual hook and subject clearly" : i === a.scene_count - 1 ? "Resolve the story and end with a memorable final frame" : "Develop the action while preserving continuity";
      return `SCENE ${i + 1}\nTiming: ${start}-${end}s (${seconds}s)\nTujuan: ${phase}.\nIde/aksi: ${idea}\nTransisi: ${i === 0 ? "Open clearly and establish geography" : "Continue from the prior scene's final pose, screen direction, lighting, and object placement"}.\nContinuity lock: preserve identity, silhouette, colors, proportions, accessories, product details, environment direction, and lighting.\nPrompt gambar (English): Create a polished ${a.style} storyboard image, aspect ratio ${a.resolution}. Story concept: ${idea}. Subject/product lock: ${a.brand_product || "subject in approved brief"}. Visual continuity: ${a.visual_style || a.style}; clear focal point, motivated camera, coherent perspective. Negative constraints: no identity drift, deformation, random text, fake logos, watermark, unsupported claims.\nPrompt video (English): Animate this scene for ${seconds} seconds. Action: ${idea}. Camera: smooth motivated movement, stable horizon, clear subject. Preserve exact identity, palette, proportions, materials, accessories, lighting and screen direction. No flicker, teleporting, unexplained object changes, random text, watermark, or unsupported claims.\nNarasi: ${a.narration || "Susun narasi sesuai brief dan bahasa yang diminta; jangan menambahkan klaim yang tidak didukung."}`;
    });
    const thumbnail = `Create a polished ${a.style} key visual for a ${a.resolution} AI animation. Subject/brand: ${a.brand_product || "the subject specified in the approved brief"}. Brief: ${a.brief}. Product details: ${a.product_details || "not provided; do not invent product claims"}. Audience: ${a.audience || "general audience"}. Strong readable focal point, cinematic composition, controlled lighting, clean background, no tiny generated text, no watermark, no invented logo or unsupported claim.`;
    return textResult([
      "KONSEP ANIMASI WOWSERU AI v0.3.2", `Produk/brand: ${a.brand_product || "Belum ditentukan"}`, `Brief disetujui: ${a.brief}`,
      `Detail produk/USP: ${a.product_details || "Belum diberikan; jangan mengarang klaim produk."}`, `Target audiens: ${a.audience || "Umum"}`,
      `Style: ${a.style}`, `Gaya visual: ${a.visual_style || a.style}`, `Durasi: ${a.duration_seconds} detik`, `Resolusi: ${a.resolution}`,
      `Jumlah scene: ${a.scene_count}`, `Bahasa: ${a.language}`, `Mode: ${a.mode}`, "", "KONSEP UTAMA DAN HOOK",
      `Hook: buka dengan visual yang paling jelas dan relevan dengan brief: ${a.brief}.`, "Pesan utama: satu ide utama, tanpa klaim yang tidak didukung.",
      "", "PROMPT THUMBNAIL (ENGLISH — READY TO COPY)", thumbnail, "", "RANGKAIAN SCENE", ...scenes,
      "", "CONTINUITY CHECKLIST", "- Pertahankan bentuk, warna, proporsi, kemasan, label, logo, aksesori, dan detail yang diberikan.",
      "- Jaga konsistensi karakter, posisi objek, arah gerak, pencahayaan, lokasi, dan orientasi kamera.",
      "- Jangan mengarang USP, bahan, harga, testimoni, garansi, promo, atau tautan pembelian.",
      `Link produk/konten: ${a.product_link || "Tidak diberikan"}`,
      "Catatan: ini konsep dan prompt tekstual, bukan video hasil render."
    ].join("\n"));
  });

  server.registerTool("create_storyboard", {
    description: "Membuat storyboard enam panel untuk satu scene setelah brief disetujui dengan OK dan pengguna mengetik LANJUT.",
    inputSchema: {
      concept: z.string().min(1), approval_id: z.string().uuid(), style: z.string().default("3D Cartoon"),
      character: z.string().optional(), scene_number: z.number().int().positive().default(1),
      scene_duration_seconds: z.number().positive().default(10), aspect_ratio: z.string().default("9:16"), language: z.string().optional(), narration: z.string().optional()
    }
  }, async (a) => {
    const approval = getApproval(a.approval_id);
    if (!approval?.lanjutAt) return textResult("Storyboard ditolak: tahap OK dan LANJUT belum tercatat untuk approval_id ini.", true);
    const subject = a.character || "the main subject described in the approved brief";
    const panels = [
      ["ESTABLISHING SHOT", "Wide establishing shot", "Show the environment and place the subject clearly; establish light direction and key props.", "Slow push-in from a stable wide frame."],
      ["SUBJECT INTRODUCTION", "Medium hero shot", "Reveal defining silhouette, material, color and shape supported by the brief.", "Gentle lateral slide; keep the subject readable."],
      ["PRIMARY ACTION", "Medium close-up", `Show one clear action that develops this concept: ${a.concept}.`, "Smooth motivated tracking movement."],
      ["DETAIL / RESPONSE", "Close-up detail shot", "Show a relevant detail or consequence; do not invent labels or features.", "Subtle rack focus; preserve object position."],
      ["VISUAL PEAK", "Hero close-up", "Deliver the most memorable visual beat with a clean silhouette.", "Controlled short push-in, then hold."],
      ["END FRAME / TRANSITION", "Composed end frame", "Resolve the action and hold a clean final frame for transition or editing text.", "Ease to a stable hold."]
    ];
    const panelSecs = a.scene_duration_seconds / 6;
    const output = panels.map((p, i) => {
      const from = (panelSecs * i).toFixed(1), to = (panelSecs * (i + 1)).toFixed(1);
      const prompt = `Create storyboard panel ${i + 1} of 6 for a ${a.style} animation, aspect ratio ${a.aspect_ratio}. SCENE CONCEPT: ${a.concept}. SUBJECT LOCK: ${subject}. SHOT: ${p[1]}. ACTION: ${p[2]}. CAMERA: ${p[3]}. CONTINUITY: preserve exact subject silhouette, colors, proportions, materials, accessories, supplied labels, environment layout, lighting direction, and screen direction across all panels. No unsupported claims, fake logos, random lettering, watermark, extra parts, or unexplained changes.`;
      return `PANEL ${i + 1} — ${p[0]}\nTiming: ${from}-${to} seconds\nFraming: ${p[1]}\nAksi: ${p[2]}\nKamera: ${p[3]}\nPrompt gambar (English):\n${prompt}`;
    });
    return textResult([`STORYBOARD — SCENE ${a.scene_number}`, `Konsep: ${a.concept}`, `Style: ${a.style}`, `Karakter/objek: ${subject}`, `Durasi: ${a.scene_duration_seconds} detik`, `Rasio: ${a.aspect_ratio}`, "", "GRID STORYBOARD 2×3 — ENAM PANEL", ...output, "", "CONTINUITY LOCK", `Subject lock: ${subject}. Preserve silhouette, colors, proportions, materials, accessories, lighting, environment layout, and screen direction.`, "Narasi dan sound design disesuaikan dengan brief; jangan membuat klaim yang tidak didukung.", "Output ini enam prompt panel tekstual, bukan gambar yang sudah dirender. Susun keenam hasil dalam grid 2×3.", "Tambahkan teks saat editing untuk menghindari teks acak dari generator."].join("\n"));
  });

  server.registerTool("generate_animation_prompts", {
    description: "Membuat prompt gambar dan video berbahasa Inggris dengan timing, continuity lock, karakter/produk konsisten, dan negative constraints. Hanya setelah OK dan LANJUT.",
    inputSchema: {
      scene: z.string().min(1), approval_id: z.string().uuid(), style: z.string().default("3D Cartoon Cinematic"),
      character: z.string().optional(), aspect_ratio: z.string().default("9:16"),
      scene_number: z.number().int().positive().default(1), duration_seconds: z.number().positive().max(60).default(5),
      narration: z.string().optional(), language: z.string().optional(), camera_direction: z.string().optional(),
      continuity_notes: z.string().optional(), negative_prompt: z.string().optional()
    }
  }, async (a) => {
    const approval = getApproval(a.approval_id);
    if (!approval?.lanjutAt) return textResult("Prompt produksi ditolak: tahap OK dan LANJUT belum tercatat untuk approval_id ini.", true);
    const duration = a.duration_seconds, subject = a.character || "the main subject described in the scene";
    const continuity = a.continuity_notes || "Keep identity, silhouette, colors, proportions, labels, accessories, lighting direction, and spatial position consistent across frames and scenes.";
    const negative = a.negative_prompt || "No identity drift, product deformation, changing colors or labels, extra/missing parts, flicker, jitter, broken anatomy, random text, fake logos, watermark, unexplained object changes, or unsupported claims.";
    const t1 = (duration * .25).toFixed(1), t2 = (duration * .55).toFixed(1), t3 = (duration * .8).toFixed(1);
    const timeline = [`0.0-${t1}s: Establish subject and environment with a readable composition.`, `${t1}-${t2}s: Execute the primary action smoothly with plausible weight and contact.`, `${t2}-${t3}s: Show key detail or emotional beat while preserving identity.`, `${t3}-${duration.toFixed(1)}s: Settle into a clean hero frame suitable for transition.`];
    const imagePrompt = `STORY CONCEPT: ${a.scene}\nCONTINUITY LOCK: ${continuity}\nCONSISTENT TALENT / CHARACTER: ${subject}; preserve identity, silhouette, proportions, colors, materials, and accessories.\nPRODUCT / OBJECT CONSISTENCY: show only details supplied in the brief; do not invent specifications, labels, logos, or claims.\nVISUAL CONTINUITY: ${a.camera_direction || "Clean cinematic composition and motivated camera angle."} Keep lighting direction, background geography, screen direction, and object placement coherent.\nSTYLE: ${a.style}; portrait ${a.aspect_ratio}; polished composition, clear focal point.\nIMPORTANT / NEGATIVE CONSTRAINTS: ${negative}. No tiny generated text; add typography during editing.`;
    const videoPrompt = `Animate this scene in ${a.style}, portrait ${a.aspect_ratio}, total duration ${duration} seconds.\nSCENE: ${a.scene}\nSUBJECT LOCK: ${subject}. Keep identity and defining features unchanged.\nCONTINUITY LOCK: ${continuity}\nCAMERA DIRECTION: ${a.camera_direction || "Smooth motivated dolly-in, stable horizon and controlled focus."}\nTIMED ACTION: ${timeline.join(" ")}\nMOTION QUALITY: coherent acceleration, natural contact and weight, no sudden teleporting or frame-to-frame shape changes.\nIMPORTANT / NEGATIVE CONSTRAINTS: ${negative}.`;
    return textResult(["WOWSERU AI ANIMASI — PRODUCTION PROMPTS", `Scene ${a.scene_number}: ${a.scene}`, `Style: ${a.style}`, `Subject: ${subject}`, `Aspect ratio: ${a.aspect_ratio}`, `Duration: ${duration}s`, "", "IMAGE PROMPT (ENGLISH — READY TO COPY)", imagePrompt, "", "VIDEO PROMPT (ENGLISH — READY TO COPY)", videoPrompt, "", "TIMING BREAKDOWN", ...timeline, "", "CONTINUITY CHECKLIST", `- Subject: ${subject}.`, `- Visual lock: ${continuity}.`, `- Negative constraints: ${negative}`, `- Narasi: ${a.narration || "Belum diberikan; susun sesuai brief dan bahasa yang diminta."}`, "Catatan: tool ini menghasilkan prompt tekstual, bukan file gambar atau video final."].join("\n"));
  });
  return server;
}

const handler = createMcpHandler(makeServer, { onerror: (error) => console.error("MCP ERROR:", error) });
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/") return Response.json({ service: "wowseru-ai-animasi", version: "0.3.2", status: "ready", endpoint: "/mcp", tools: 5 });
    if (url.pathname === "/health") return Response.json({ service: "wowseru-ai-animasi", version: "0.3.2", status: "ok", skill_loaded: true, mcp_endpoint: "/mcp", tools: 5 });
    if (url.pathname === "/mcp") return handler(request, env, ctx);
    return new Response("Not Found", { status: 404 });
  }
};
