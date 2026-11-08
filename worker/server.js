import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

// Approval state is stored in a Cloudflare Durable Object so it is shared
// across Worker isolates and requests. Approval records expire after 2 hours.
const APPROVAL_TTL_MS = 2 * 60 * 60 * 1000;

function approvalStore(env) {
  if (!env.APPROVALS) throw new Error("Binding Durable Object APPROVALS belum dikonfigurasi.");
  const id = env.APPROVALS.idFromName("wowseru-approval-store");
  return env.APPROVALS.get(id);
}

async function getApproval(env, id) {
  const response = await approvalStore(env).fetch("https://approval-store/get", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ approval_id: id })
  });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`Gagal membaca approval: HTTP ${response.status}`);
  return response.json();
}

async function saveApproval(env, id, state) {
  const response = await approvalStore(env).fetch("https://approval-store/set", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ approval_id: id, state })
  });
  if (!response.ok) throw new Error(`Gagal menyimpan approval: HTTP ${response.status}`);
}

async function markApprovalLanjut(env, id) {
  const response = await approvalStore(env).fetch("https://approval-store/lanjut", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ approval_id: id })
  });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`Gagal memperbarui approval: HTTP ${response.status}`);
  return response.json();
}
function textResult(text, isError = false) {
  return { content: [{ type: "text", text }], ...(isError ? { isError: true } : {}) };
}
function makeServer(env) {
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
    await saveApproval(env, approval_id, { brief: brief.trim(), approvedAt: Date.now() });
    return textResult(`Brief disetujui dan dicatat. approval_id: ${approval_id}. Belum boleh produksi; tunggu pengguna mengetik LANJUT, lalu panggil confirm_animation_lanjut dengan approval_id ini.`);
  });

  server.registerTool("confirm_animation_lanjut", {
    description: "Catat instruksi LANJUT setelah brief yang sama telah disetujui dengan OK.",
    inputSchema: {
      approval_id: z.string().uuid(),
      confirmation_text: z.literal("LANJUT").describe("Harus persis LANJUT setelah persetujuan OK untuk brief yang sama.")
    }
  }, async ({ approval_id, confirmation_text }) => {
    const state = await getApproval(env, approval_id);
    if (!state || confirmation_text !== "LANJUT") return textResult("LANJUT belum diterima untuk approval_id yang valid. Pastikan brief sudah disetujui dengan OK dan gunakan approval_id yang masih berlaku.", true);
    const updated = await markApprovalLanjut(env, approval_id);
    if (!updated) return textResult("LANJUT gagal dicatat: approval tidak ditemukan atau kedaluwarsa.", true);
    return textResult(`LANJUT tercatat untuk brief yang disetujui. approval_id: ${approval_id}. Tool produksi sekarang dapat dipanggil untuk brief ini.`);
  });

  server.registerTool("create_animation_concept", {
    description: "Menyusun konsep animasi WOWSERU berdasarkan brief yang sudah disetujui. Hanya panggil setelah tahap OK dan LANJUT.",
    inputSchema: {
      brief: z.string().min(1), approval_id: z.string().uuid(),
      brand_product: z.string().optional(), product_details: z.string().optional(),
      style: z.string().default("Animasi Objek Bicara (Realistis)"), visual_style: z.string().default("Realistic Cinematic"),
      audience: z.string().optional(), resolution: z.string().default("Vertical 9:16"),
      duration_seconds: z.number().int().positive().max(300).default(30),
      scene_count: z.number().int().min(1).max(12).default(3), narration: z.string().optional(),
      character_mode: z.string().optional(), language: z.string().default("Bahasa Indonesia"),
      mode: z.enum(["Normal", "Deep Research"]).default("Normal"), scene_ideas: z.array(z.string()).optional(), product_link: z.string().optional()
    }
  }, async (a) => {
    const approval = await getApproval(env, a.approval_id);
    if (!approval?.lanjutAt) return textResult("Produksi ditolak: tahap OK dan LANJUT belum tercatat untuk approval_id ini.", true);
    if (a.brief.trim() !== approval.brief) return textResult("Produksi ditolak: brief tidak sama dengan brief yang disetujui. Minta persetujuan ulang untuk brief terbaru.", true);
    const base = Math.floor(a.duration_seconds / a.scene_count), remainder = a.duration_seconds % a.scene_count;
    const scenes = Array.from({ length: a.scene_count }, (_, i) => {
      const seconds = base + (i < remainder ? 1 : 0);
      const from = i * base + Math.min(i, remainder);
      const to = from + seconds;
      const idea = a.scene_ideas?.[i] || `Show ${a.brand_product || "the main subject"} in a clear, engaging visual moment that follows the approved brief`;
      const phase = i === 0 ? "Introduce the subject and establish the visual hook" : i === a.scene_count - 1 ? "Resolve the story and finish on a memorable final frame" : "Develop the action while continuing directly from the previous scene";
      const narrationLine = a.narration && !/^(ya|yes|aktif)$/i.test(a.narration.trim())
        ? a.narration
        : `Lihat ${a.brand_product || "cerita ini"}!`;
      const panelBeats = [
        "Panel 1 (top-left): wide establishing shot; introduce the setting and subject.",
        "Panel 2 (top-right): medium shot; reveal the subject's defining silhouette and expression.",
        "Panel 3 (middle-left): medium close-up; begin the main action.",
        "Panel 4 (middle-right): close-up; show the key reaction or meaningful detail.",
        "Panel 5 (bottom-left): dynamic shot; complete the action and build to the payoff.",
        "Panel 6 (bottom-right): clean hero shot; finish with a memorable final pose and space for a CTA overlay."
      ];
      const imagePrompt = `Create ONE complete storyboard sheet in ${a.resolution}, arranged as EXACTLY 2 COLUMNS x 3 ROWS (six panels total), read left-to-right then top-to-bottom. ${panelBeats.join(" ")} STORY CONCEPT: ${idea}. SCENE PURPOSE: ${phase}. SUBJECT / PRODUCT LOCK: ${a.brand_product || "Use only the subject described in the approved brief"}. PRODUCT FACTS: ${a.product_details || "No product specifications were supplied; do not invent claims or features."}. TARGET AUDIENCE: ${a.audience || "General audience"}. VISUAL STYLE: ${a.visual_style || a.style}. Keep all six panels in one consistent visual style with matching character design, proportions, colors, materials, packaging, labels, accessories, environment, lighting direction, and screen direction. Use clear gutters between panels. No extra panels, no missing panels, no random text, misspelled lettering, fake logos, watermark, deformation, flicker, or unsupported product claims.`;
      const videoPrompt = `Create a ${seconds}-second ${a.style} animation in ${a.resolution}. SCENE CONCEPT: ${idea}. TIMELINE: 0-${(seconds * .2).toFixed(1)}s establish the subject and setting; ${(seconds * .2).toFixed(1)}-${(seconds * .55).toFixed(1)}s perform the main action; ${(seconds * .55).toFixed(1)}-${(seconds * .8).toFixed(1)}s show the key reaction or visual detail; ${(seconds * .8).toFixed(1)}-${seconds}s resolve into a clean final frame. CAMERA: smooth motivated movement, stable horizon, deliberate framing, no abrupt unexplained cuts. SUBJECT LOCK: ${a.brand_product || "the approved brief's subject"}. CONTINUITY LOCK: preserve identity, silhouette, proportions, color, material, supplied labels and accessories, lighting direction, environment layout, and screen direction. NEGATIVE CONSTRAINTS: no identity drift, redesign, deformation, extra/missing parts, flicker, jitter, teleporting, random text, fake logos, watermark, or unsupported claims.`;
      return {
        title: `SCENE ${i + 1}`,
        timing: `${from}-${to}s (${seconds}s)`,
        purpose: phase,
        idea,
        imagePrompt,
        videoPrompt,
        narration: narrationLine
      };
    });
    const hookSubject = a.brand_product || a.scene_ideas?.[0] || "cerita utama";
    const hook = `Pernah lihat ${hookSubject} dengan cara yang berbeda?`;
    const thumbnail = `Create a striking ${a.style} key visual for WOWSERU AI ANIMASI, ${a.resolution}. MAIN SUBJECT: ${hookSubject}. STORY: ${scenes[0].idea}. VISUAL STYLE: ${a.visual_style || a.style}. Create a strong curiosity-driven focal point, expressive readable pose, cinematic composition, polished lighting, uncluttered background, and clear visual hierarchy. Preserve all supplied product and character details. Do not add unsupported claims, invented logos, tiny text, random lettering, or watermark.`;
    const promptBlock = (label, prompt) => `${label}\n\`\`\`text\n${prompt}\n\`\`\``;
    const sceneOutput = scenes.flatMap((scene) => [
      scene.title,
      `Timing: ${scene.timing}`,
      `Tujuan cerita: ${scene.purpose}.`,
      `Ide/aksi: ${scene.idea}`,
      `Narasi/dialog (${a.language}): ${scene.narration}`,
      promptBlock(`Prompt Gambar — ${scene.title} (ENGLISH)`, scene.imagePrompt),
      promptBlock(`Prompt Video — ${scene.title} (ENGLISH)`, scene.videoPrompt)
    ]);
    return textResult([
      "KONSEP ANIMASI WOWSERU AI",
      `Produk/brand: ${a.brand_product || "Tidak disebutkan"}`,
      `Brief disetujui: ${a.brief}`,
      `Detail produk/USP: ${a.product_details || "Tidak diberikan; tidak ada klaim produk yang akan ditambahkan."}`,
      `Target audiens: ${a.audience || "Umum"}`,
      `Style animasi: ${a.style}`,
      `Gaya visual: ${a.visual_style || a.style}`,
      `Durasi total: ${a.duration_seconds} detik`,
      `Resolusi: ${a.resolution}`,
      `Jumlah scene: ${a.scene_count}`,
      `Bahasa: ${a.language}`,
      `Mode: ${a.mode}`,
      "",
      "KONSEP UTAMA DAN HOOK",
      `Konsep: ${scenes.map((scene) => scene.idea).join(" → ")}`,
      `Hook: ${hook}`,
      "Pesan utama: sampaikan ide visual dari brief tanpa menambahkan klaim produk yang tidak diberikan.",
      "",
      promptBlock("PROMPT THUMBNAIL (ENGLISH — READY TO COPY)", thumbnail),
      "",
      "RANGKAIAN SCENE",
      ...sceneOutput,
      "",
      "CTA DAN TEXT OVERLAY",
      `CTA: ${a.brand_product ? `Kenali ${a.brand_product} lebih dekat.` : "Ajak penonton mengenal cerita lebih lanjut."}`,
      "Text overlay: gunakan teks singkat, terbaca, dan hanya berdasarkan informasi yang diberikan; jangan membuat klaim produk baru.",
      "",
      "CONTINUITY CHECKLIST",
      "- Pertahankan identitas, bentuk, warna, proporsi, kemasan, label, logo, aksesori, dan detail yang memang diberikan.",
      "- Scene berikutnya dimulai dari posisi akhir, arah gerak, pencahayaan, dan tata letak scene sebelumnya.",
      "- Hindari anatomi rusak, flicker, jitter, objek muncul/hilang, teks acak, watermark, dan klaim produk yang tidak didukung.",
      `Link produk/konten: ${a.product_link || "Tidak diberikan"}`,
      "",
      "Terima kasih sudah menggunakan Tools AI Animasi WOWSERU.",
      "",
      "Catatan: keluaran ini adalah konsep dan prompt tekstual untuk generator gambar/video, bukan file video hasil render."
    ].join("\n"));
  });

  server.registerTool("create_storyboard", {
    description: "Membuat storyboard enam panel untuk satu scene setelah brief disetujui dengan OK dan pengguna mengetik LANJUT.",
    inputSchema: {
      concept: z.string().min(1), approval_id: z.string().uuid(), style: z.string().default("Animasi Objek Bicara (Realistis)"),
      character: z.string().optional(), brand_product: z.string().optional(), product_details: z.string().optional(),
      scene_idea: z.string().optional(), scene_number: z.number().int().positive().default(1),
      scene_duration_seconds: z.number().positive().default(10), aspect_ratio: z.string().default("9:16"),
      language: z.string().optional(), narration: z.string().optional(),
      visual_style: z.string().optional(), audience: z.string().optional()
    }
  }, async (a) => {
    const approval = await getApproval(env, a.approval_id);
    if (!approval?.lanjutAt) return textResult("Storyboard ditolak: tahap OK dan LANJUT belum tercatat untuk approval_id ini.", true);
    const subject = a.character || a.brand_product || "subject specified in the approved brief";
    const idea = a.scene_idea || a.concept;
    const productFacts = a.product_details || "Only use product details explicitly supplied in the brief.";
    const panels = [
      ["ESTABLISHING SHOT", "Wide shot", `Show ${subject} clearly in a simple setting; establish the scene and lighting.`, "Slow push-in; stable horizon."],
      ["SUBJECT INTRODUCTION", "Medium hero shot", `Reveal ${subject} as the main character; preserve its actual package shape, colors, label and proportions.`, "Gentle lateral slide; keep the front of the package readable."],
      ["PRIMARY ACTION", "Medium close-up", `${subject} comes to life and raises/waves its small cartoon arms to greet the viewer; use a friendly expressive face without changing the package design.`, "Smooth motivated push-in synchronized with the greeting."],
      ["DETAIL / RESPONSE", "Close-up", `Show the character's friendly facial expression and a small greeting gesture; do not invent product features or claims.`, "Subtle rack focus; preserve package identity."],
      ["VISUAL PEAK", "Hero close-up", `${subject} completes its cheerful greeting with a memorable expressive pose.`, "Controlled short push-in, then hold."],
      ["END FRAME / TRANSITION", "Composed end frame", `Return to a clean hero composition of ${subject}, facing the viewer, ready for an editor-added CTA.`, "Ease to a stable final hold."]
    ];
    const panelSecs = a.scene_duration_seconds / 6;
    const output = panels.map((p, i) => {
      const from = (panelSecs * i).toFixed(1), to = (panelSecs * (i + 1)).toFixed(1);
      return `PANEL ${i + 1} — ${p[0]}\nTiming: ${from}-${to} seconds\nFraming: ${p[1]}\nAction: ${p[2]}\nCamera: ${p[3]}`;
    });
    const gridPrompt = `Create ONE complete storyboard sheet, exact 2 columns by 3 rows, exactly SIX separate panels, reading left-to-right then top-to-bottom. Do not create six separate images. STYLE: ${a.visual_style || a.style}. FORMAT: portrait ${a.aspect_ratio}. SUBJECT: ${subject}. PRODUCT FACTS: ${productFacts}. SCENE IDEA: ${idea}. PANEL 1: wide establishing shot of ${subject} in a clean simple setting. PANEL 2: medium hero shot clearly reveals the same package design, shape, colors and label. PANEL 3: the package becomes a cute 3D cartoon character and raises/waves its arms to greet the viewer. PANEL 4: close-up of its friendly expression and greeting gesture. PANEL 5: expressive cheerful hero pose. PANEL 6: clean final hero frame with the character facing the viewer. Keep the exact same package identity, proportions, colors, material, label and facial features in every panel. Each panel must occupy its own cell with clear gutters. No extra panels, no missing panels, no merged cells, no invented logos, no random lettering, no watermark, no product claims not present in the supplied facts. Audience: ${a.audience || "general audience"}.`;
    const spoken = a.narration && !/^(ya|yes)$/i.test(a.narration.trim()) ? a.narration : `${subject}: "Hai! Senang berkenalan denganmu!"`;
    return textResult([
      `STORYBOARD — SCENE ${a.scene_number}`,
      `Konsep: ${a.concept}`,
      `Ide scene: ${idea}`,
      `Produk/karakter: ${subject}`,
      `Detail produk: ${productFacts}`,
      `Style: ${a.visual_style || a.style}`,
      `Durasi: ${a.scene_duration_seconds} detik`,
      `Rasio: ${a.aspect_ratio}`,
      "", "ENAM PANEL STORYBOARD (2 KOLOM × 3 BARIS)", ...output,
      "", "PROMPT GAMBAR STORYBOARD (ENGLISH — ONE COMPLETE 2×3 GRID)", "```text", gridPrompt, "```",
      "", "NARASI / DIALOG", spoken,
      "", "CONTINUITY LOCK",
      `Subject lock: ${subject}. Preserve the exact package silhouette, proportions, colors, material, label, face, arms, and accessories in all six panels.`,
      "Do not invent product specifications, benefits, certifications, logos, or claims.",
      "Catatan: prompt ini menghasilkan instruksi tekstual; gambar storyboard perlu dirender di generator gambar."
    ].join("\n"));
  });

  server.registerTool("generate_animation_prompts", {
    description: "Membuat prompt gambar dan video berbahasa Inggris dengan subject dari nama produk/karakter, gerakan spesifik, timing, narasi tersinkron, continuity lock, dan negative constraints. Hanya setelah OK dan LANJUT.",
    inputSchema: {
      scene: z.string().min(1), approval_id: z.string().uuid(), style: z.string().default("Animasi Objek Bicara (Realistis)"),
      brand_product: z.string().optional(), product_details: z.string().optional(),
      character: z.string().optional(), aspect_ratio: z.string().default("9:16"),
      scene_number: z.number().int().positive().default(1), duration_seconds: z.number().positive().max(60).default(5),
      narration: z.string().optional(), language: z.string().optional(), camera_direction: z.string().optional(),
      continuity_notes: z.string().optional(), negative_prompt: z.string().optional()
    }
  }, async (a) => {
    const approval = await getApproval(env, a.approval_id);
    if (!approval?.lanjutAt) return textResult("Prompt produksi ditolak: tahap OK dan LANJUT belum tercatat untuk approval_id ini.", true);
    const duration = a.duration_seconds;
    const subject = a.brand_product || a.character || "karakter utama sesuai deskripsi scene";
    const productFacts = a.product_details || "Hanya gunakan detail produk yang diberikan; jangan mengarang manfaat atau spesifikasi.";
    const continuity = a.continuity_notes || `Keep the same ${subject} identity, package silhouette, proportions, colors, material, supplied label, face, arms, and accessories consistent in every frame.`;
    const negative = a.negative_prompt || "No identity drift, product deformation, changing colors or labels, extra/missing parts, flicker, jitter, broken anatomy, random text, fake logos, watermark, unexplained object changes, or unsupported claims.";
    const scene = a.scene;
    const lowerScene = scene.toLowerCase();
    let actionTimeline;
    if (/wave|melamba|menyapa|sapa/.test(lowerScene)) {
      actionTimeline = [
        `0.0-${(duration*.2).toFixed(1)}s: ${subject} faces the camera; establish the full package and friendly expression.`,
        `${(duration*.2).toFixed(1)}-${(duration*.55).toFixed(1)}s: the character raises one small cartoon arm and waves clearly toward the viewer; keep the package body stable.`,
        `${(duration*.55).toFixed(1)}-${(duration*.8).toFixed(1)}s: the character smiles, blinks naturally, and finishes the greeting gesture.`,
        `${(duration*.8).toFixed(1)}-${duration.toFixed(1)}s: the arm settles and ${subject} holds a friendly front-facing hero pose.`
      ];
    } else {
      actionTimeline = [
        `0.0-${(duration*.2).toFixed(1)}s: establish ${subject} and the setting in a readable frame.`,
        `${(duration*.2)}-${(duration*.55).toFixed(1)}s: perform the exact main action described here: ${scene}; keep motion clear and physically coherent.`,
        `${(duration*.55).toFixed(1)}-${(duration*.8).toFixed(1)}s: show the key reaction or visual detail without changing subject identity.`,
        `${(duration*.8).toFixed(1)}-${duration.toFixed(1)}s: resolve into a clean final hero frame.`
      ];
    }
    const timeline = actionTimeline;
    const narrationInput = (a.narration || "").trim();
    const narrationDisabled = /^(tidak|no|false|off)$/i.test(narrationInput);
    const narrationText = narrationDisabled ? "Narasi tidak digunakan." :
      (!narrationInput || /^(ya|yes|true|on)$/i.test(narrationInput)
        ? "Hai! Senang berkenalan denganmu!"
        : narrationInput);
    const language = a.language || "Bahasa Indonesia";
    const narrationSection = narrationDisabled ? "Tidak ada narasi atau dialog." :
      `Dialog (${language}): “${narrationText}”\nAudio timing: ${Math.max(0, duration*.28).toFixed(1)}-${Math.min(duration, duration*.68).toFixed(1)}s, while the character performs the greeting. Match mouth movement to the spoken words; do not add extra dialogue.`;
    const camera = a.camera_direction || "Begin with a medium full-package shot, then use a gentle push-in during the wave; keep the front label visible and finish on a stable hero frame.";
    const imagePrompt = `STORY CONCEPT: ${scene}\nSUBJECT / CHARACTER: ${subject}.\nPRODUCT DETAILS: ${productFacts}.\nCONSISTENT TALENT / CHARACTER: depict ${subject} as the same recognizable subject; preserve its package silhouette, proportions, colors, material, supplied label, face, arms, and accessories.\nCONTINUITY LOCK: ${continuity}\nVISUAL COMPOSITION: portrait ${a.aspect_ratio}; clear full subject, readable face and gesture, clean background, coherent lighting and perspective.\nSTYLE: ${a.style}; polished 3D animation look, clear focal point.\nIMPORTANT / NEGATIVE CONSTRAINTS: ${negative} No tiny generated text; add typography during editing.`;
    const videoPrompt = `Animate ${subject} in ${a.style}, portrait ${a.aspect_ratio}, total duration ${duration} seconds.\nSCENE: ${scene}\nSUBJECT LOCK: ${subject}. Product details: ${productFacts}. Preserve the exact package identity and supplied design.\nCAMERA DIRECTION: ${camera}\nTIMED ACTION:\n${timeline.join("\n")}\n${narrationDisabled ? "AUDIO: no narration or dialogue." : `DIALOGUE / AUDIO (${language}): ${narrationText}. ${narrationSection}`}\nLIP SYNC: when dialogue is enabled, synchronize mouth movement naturally to the exact line; do not speak additional words.\nMOTION QUALITY: smooth anticipation, readable wave gesture, natural arm movement, coherent acceleration, stable package body, no teleporting or frame-to-frame shape changes.\nCONTINUITY LOCK: ${continuity}\nIMPORTANT / NEGATIVE CONSTRAINTS: ${negative}`;
    return textResult([
      "WOWSERU AI ANIMASI — PRODUCTION PROMPTS", `Scene ${a.scene_number}: ${scene}`,
      `Style: ${a.style}`, `Subject: ${subject}`, `Product details: ${productFacts}`,
      `Aspect ratio: ${a.aspect_ratio}`, `Duration: ${duration}s`, "",
      "IMAGE PROMPT (ENGLISH — READY TO COPY)", "```text", imagePrompt, "```", "",
      "VIDEO PROMPT (ENGLISH — READY TO COPY)", "```text", videoPrompt, "```", "",
      "TIMING BREAKDOWN", ...timeline, "", "NARASI / DIALOG", narrationSection, "",
      "CONTINUITY CHECKLIST", `- Subject: ${subject}.`, `- Product details: ${productFacts}.`,
      `- Visual lock: ${continuity}.`, `- Negative constraints: ${negative}`,
      "Catatan: tool ini menghasilkan prompt tekstual, bukan file gambar atau video final."
    ].join("\n"));
  });
  return server;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/") return Response.json({ service: "wowseru-ai-animasi", version: "0.3.3", status: "ready", endpoint: "/mcp", tools: 5, approval_storage: "durable-object" });
    if (url.pathname === "/health") return Response.json({ service: "wowseru-ai-animasi", version: "0.3.3", status: "ok", skill_loaded: true, mcp_endpoint: "/mcp", tools: 5, approval_storage: "durable-object" });
    if (url.pathname === "/mcp") {
      const handler = createMcpHandler(() => makeServer(env), {
        onerror: (error) => console.error("MCP ERROR:", error)
      });
      return handler(request, env, ctx);
    }
    return new Response("Not Found", { status: 404 });
  }
};

// Durable Object: persistent, shared approval state for OK -> LANJUT -> production.
export class ApprovalStore {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
    const body = await request.json();

    if (url.pathname === "/set") {
      const { approval_id, state } = body;
      if (!approval_id || !state?.brief || !state?.approvedAt) {
        return Response.json({ error: "Invalid approval record" }, { status: 400 });
      }
      await this.ctx.storage.put(`approval:${approval_id}`, state);
      return Response.json({ ok: true });
    }

    if (url.pathname === "/get") {
      const { approval_id } = body;
      if (!approval_id) return Response.json({ error: "Missing approval_id" }, { status: 400 });
      const state = await this.ctx.storage.get(`approval:${approval_id}`);
      if (!state) return Response.json({ error: "Not found" }, { status: 404 });
      if (Date.now() - state.approvedAt > APPROVAL_TTL_MS) {
        await this.ctx.storage.delete(`approval:${approval_id}`);
        return Response.json({ error: "Expired" }, { status: 404 });
      }
      return Response.json(state);
    }

    if (url.pathname === "/lanjut") {
      const { approval_id } = body;
      if (!approval_id) return Response.json({ error: "Missing approval_id" }, { status: 400 });
      const key = `approval:${approval_id}`;
      const state = await this.ctx.storage.get(key);
      if (!state || Date.now() - state.approvedAt > APPROVAL_TTL_MS) {
        if (state) await this.ctx.storage.delete(key);
        return Response.json({ error: "Not found or expired" }, { status: 404 });
      }
      state.lanjutAt = Date.now();
      await this.ctx.storage.put(key, state);
      return Response.json(state);
    }

    return new Response("Not Found", { status: 404 });
  }
}
