import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

// WOWSERU AI ANIMASI v0.3.2
// Approval disimpan dalam memori dan tidak permanen.
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
  return {
    content: [{ type: "text", text }],
    ...(isError ? { isError: true } : {}),
  };
}

function isPositiveFeedback(text) {
  const normalized = String(text ?? "")
    .toLocaleLowerCase("id-ID")
    .replace(/[.,!?…]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return false;

  const negativePhrases = [
    "kurang cocok",
    "belum cocok",
    "tidak cocok",
    "nggak cocok",
    "gak cocok",
    "kurang bagus",
    "belum bagus",
    "kurang menarik",
    "tidak suka",
    "nggak suka",
    "gak suka",
    "kurang pas",
    "belum pas",
    "coba ide lain",
    "coba alternatif",
    "ganti ",
    "ubah ",
    "revisi",
    "tapi ending",
    "tapi bagian",
    "tapi ganti",
  ];

  if (
    negativePhrases.some((phrase) => normalized.includes(phrase)) ||
    normalized.includes(" tapi ")
  ) {
    return false;
  }

  const positivePhrases = [
    "ok",
    "oke",
    "cocok",
    "bagus",
    "mantap",
    "keren",
    "setuju",
    "deal",
    "gas",
    "gaskeun",
    "lanjut",
    "lanjutkan",
    "sip",
    "mantul",
    "boleh",
    "suka",
    "aku suka",
    "saya suka",
    "gue suka",
    "ini yang saya mau",
    "ini yang aku mau",
    "pas banget",
    "bagus banget",
  ];

  return positivePhrases.some(
    (phrase) =>
      normalized === phrase ||
      normalized.startsWith(phrase + " ") ||
      normalized.includes(" " + phrase + " ") ||
      normalized.endsWith(" " + phrase)
  );
}

function makeServer() {
  const skillInstructions = `# WOWSERU AI ANIMASI v0.3.2

## IDENTITAS
- Nama: WOWSERU AI ANIMASI
- Bahasa default: Bahasa Indonesia.
- Output utama: konsep cerita, storyboard, dan prompt gambar/video.
- Jangan mengklaim telah merender video atau gambar final.

## PEMBUKA
Jika pengguna mengetik "Mulai", tampilkan pesan teks biasa berikut.
Jangan memanggil tool apa pun pada tahap pembuka.

🎬 Selamat datang di WOWSERU AI ANIMASI!

Pilihan STYLE AI Animasi apa yang ingin dibuat:

1. Animasi Umum
2. Animasi Objek Bicara
3. Animasi Objek Bicara (Realistis)
4. Animasi Fakta Unik
5. Animasi Cerita Horror
6. Animasi Cerita Rakyat

Pilihan GAYA ANIMASI:

3D Cartoon / 3D Cartoon Pixar-Style / Realistic Cinematic /
Anime (Japan Style) / Flannel Animation Style /
Cinematic Action Movie Still Style / Studio Ghibli /
Donghua (Chinese Animation) / Claymation / 2.5D Style / Webtoon Style

🎨 GAYA ANIMASI LAINNYA

[Lihat pilihan gaya animasi lainnya](https://wic-ai-video.hai-epple.chatgpt.site?utm_source=chatgpt.com)

Sebelum bikin Video AI, isi format di bawah ini dulu ya 👇🏻

• Nama Brand + Produk:
• Detail Produk / USP:
• Target Audience:
• Resolusi Video: TikTok Vertical 9:16
• Durasi Video (Detik): 30 Detik
• Adegan (Scene): 3
• Pakai Narasi?: Ya / Tidak
• Pakai Model Manusia/Karakter: Ya / Tidak
• Link Produk/Konten: Opsional
• Upload Foto Karakter + Produk: Opsional
• Mode: Normal / Deep Research
• Style Animasi: Animasi Objek Bicara (Realistis)
• Gaya Visual: Realistic Cinematic
• Request Bahasa:

• Ide Cerita Scene 1:
• Ide Cerita Scene 2:
• Ide Cerita Scene 3:

Detail produk dapat mencakup fitur, bahan, ukuran, fungsi,
keunggulan, masalah target audiens, dan informasi relevan lainnya.

## SETELAH BRIEF DIKIRIM
- Jangan tampilkan ulang template kosong jika pengguna sudah
  mengirim informasi produk atau cerita.
- Pertahankan seluruh pilihan yang telah diberikan pengguna.
- Rangkum brief dan rekomendasikan alur scene sesuai durasi.
- Setiap scene harus memiliki judul, aksi, dialog bila relevan,
  serta transisi ke scene berikutnya.
- Jangan mengarang USP atau klaim produk yang belum diberikan.
- Akhiri dengan meminta pengguna menilai konsep.
- Jangan memanggil tool storyboard atau produksi saat tahap ini.

## FEEDBACK PENGGUNA
Pahami maksud kalimat berdasarkan konteks, bukan kata kunci saja.

Jika pengguna tidak puas, misalnya "kurang cocok", "kurang bagus",
"jelek", "kurang menarik", "belum pas", atau meminta ide lain:
- Jika meminta alternatif, berikan 5 konsep berbeda.
- Jika meminta revisi spesifik, ubah bagian tersebut saja.
- Jangan membuat prompt produksi sebelum konsep revisi disetujui.

Jika pengguna menyetujui, misalnya "cocok", "bagus", "mantap",
"keren", "oke", "setuju", "gas", atau "lanjut":
- Pastikan persetujuan itu merujuk pada konsep terbaru.
- Jika jelas, lanjutkan ke paket produksi tanpa meminta brief diulang.
- Jika pujian disertai permintaan revisi, revisi dahulu dan tunggu
  persetujuan atas hasil revisi.

## PAKET PRODUKSI
Setelah persetujuan yang diperlukan terpenuhi, buat:
1. Prompt thumbnail dalam bahasa Inggris.
2. Prompt storyboard enam panel untuk setiap scene.
3. Prompt video dengan timing sesuai durasi scene.
4. Dialog dan narasi dalam bahasa pilihan pengguna.
5. Camera direction dan continuity lock.
6. Negative prompt untuk mencegah perubahan karakter, bentuk
   produk, flicker, objek duplikat, teks acak, dan watermark.
7. Checklist kontinuitas dan catatan produksi.

Setiap prompt siap salin harus berada dalam blok kode terpisah.
Scene berikutnya harus menyambung secara visual dari scene sebelumnya.

## PEMANGGILAN TOOL — PENTING
- Jangan memanggil tool saat pengguna hanya mengetik "Mulai".
- Jangan mengarang nama parameter atau approval_id.
- Panggil setiap tool hanya sesuai deskripsi dan skema input-nya.
- Jangan mengubah tujuan pemanggilan tool melalui parameter.
- Jangan memanggil tool storyboard atau produksi sebelum konsep
  disetujui dan tahapan persetujuan yang diwajibkan terpenuhi.
- Jangan mengklaim tool berhasil jika hasilnya menunjukkan error.
- Jika tool gagal, jelaskan kegagalannya dan jangan mengulang
  pemanggilan yang sama secara membabi buta.
- Gunakan brief terbaru dari percakapan aktif, bukan brief lama
  yang tidak sedang dibahas.

## KONSISTENSI MEREK
- Selalu gunakan nama WOWSERU AI ANIMASI.
- Pertahankan produk, karakter, gaya visual, durasi, dan bahasa
  yang dipilih pengguna.
- Tandai cerita tokoh publik dalam iklan sebagai fiksi/parodi;
  jangan menyiratkan endorsement nyata tanpa dasar.
`;

  const server = new McpServer(
    { name: "wowseru-ai-animasi", version: "0.3.2" },
    { instructions: skillInstructions }
  );
  
  server.registerTool(
    "confirm_animation_brief",
    {
      description:
        "Catat persetujuan konsep terbaru setelah pengguna memberi feedback positif yang jelas (misalnya cocok, bagus, oke, mantap, atau setuju). Menghasilkan approval_id untuk tahap produksi.",
      inputSchema: {
        brief: z.string().min(1),
        confirmation_text: z
          .string()
          .min(1)
          .describe(
            "Ungkapan persetujuan pengguna, misalnya cocok, bagus, oke, mantap, setuju, gas, atau LANJUT."
          ),
      },
    },
    async ({ brief, confirmation_text }) => {
      if (!isPositiveFeedback(confirmation_text)) {
        return textResult(
          "Persetujuan belum tercatat. Feedback belum menunjukkan persetujuan yang jelas terhadap konsep terbaru.",
          true
        );
      }

      const approval_id = crypto.randomUUID();

      approvals.set(approval_id, {
        brief: brief.trim(),
        approvedAt: Date.now(),
      });

      return textResult(
        `Konsep disetujui dan dicatat. approval_id: ${approval_id}. ` +
          "Lanjutkan ke tahap produksi dengan memanggil confirm_animation_lanjut menggunakan persetujuan yang sama; jangan meminta pengguna mengetik LANJUT lagi."
      );
    }
  );

  server.registerTool(
    "confirm_animation_lanjut",
    {
      description:
        "Catat persetujuan untuk mulai produksi berdasarkan feedback positif yang sama, tanpa meminta pengguna mengulang kata LANJUT.",
      inputSchema: {
        approval_id: z.string().uuid(),
        confirmation_text: z
          .string()
          .min(1)
          .describe(
            "Ungkapan persetujuan/lanjut pengguna yang jelas, misalnya cocok, oke, bagus, mantap, gas, setuju, atau LANJUT."
          ),
      },
    },
    async ({ approval_id, confirmation_text }) => {
      const state = getApproval(approval_id);

      if (!state || !isPositiveFeedback(confirmation_text)) {
        return textResult(
          "Persetujuan produksi belum tercatat. Pastikan feedback pengguna jelas menyetujui konsep terbaru dan approval_id masih berlaku.",
          true
        );
      }

      state.lanjutAt = Date.now();

      return textResult(
        `Persetujuan produksi tercatat. approval_id: ${approval_id}. ` +
          "Tool produksi sekarang dapat dipanggil untuk brief dan konsep yang sama."
      );
    }
  );

  server.registerTool(
    "create_animation_concept",
    {
      description:
        "Membuat ringkasan produksi setelah pengguna menyetujui konsep terbaru; gunakan brief yang sama persis dan approval_id yang telah disetujui.",
      inputSchema: {
        brief: z.string().min(1),
        approval_id: z.string().uuid(),
        brand_product: z.string().optional(),
        product_details: z.string().optional(),
        style: z.string().default("3D Cartoon"),
        visual_style: z.string().optional(),
        audience: z.string().optional(),
        resolution: z.string().default("Vertical 9:16"),
        duration_seconds: z.number().int().positive().max(300).default(30),
        scene_count: z.number().int().min(1).max(12).default(3),
        narration: z.string().optional(),
        character_mode: z.string().optional(),
        language: z.string().default("Bahasa Indonesia"),
        mode: z.enum(["Normal", "Deep Research"]).default("Normal"),
        scene_ideas: z.array(z.string()).optional(),
        product_link: z.string().optional(),
      },
    },
    async (a) => {
      const approval = getApproval(a.approval_id);

      if (!approval?.lanjutAt) {
        return textResult(
          "Produksi ditolak: tahap OK dan LANJUT belum tercatat untuk approval_id ini.",
          true
        );
      }

      if (a.brief.trim() !== approval.brief) {
        return textResult(
          "Produksi ditolak: brief tidak sama dengan brief yang disetujui. Minta persetujuan ulang untuk brief terbaru.",
          true
        );
      }

      const base = Math.floor(a.duration_seconds / a.scene_count);
      const remainder = a.duration_seconds % a.scene_count;

      const scenes = Array.from({ length: a.scene_count }, (_, i) => {
        const seconds = base + (i < remainder ? 1 : 0);
        const start = i * base + Math.min(i, remainder);
        const end = start + seconds;
        const idea = a.scene_ideas?.[i] || a.brief;

        const phase =
          i === 0
            ? "Establish the visual hook and subject clearly"
            : i === a.scene_count - 1
              ? "Resolve the story and end with a memorable final frame"
              : "Develop the action while preserving continuity";

        return [
          `SCENE ${i + 1}`,
          `Timing: ${start}-${end}s (${seconds}s)`,
          `Tujuan: ${phase}.`,
          `Ide/aksi: ${idea}`,
          `Transisi: ${
            i === 0
              ? "Open clearly and establish geography"
              : "Continue from the prior scene's final pose, screen direction, lighting, and object placement"
          }.`,
          "Continuity lock: preserve identity, silhouette, colors, proportions, accessories, product details, environment direction, and lighting.",
          `Prompt gambar (English): Create a polished ${a.style} storyboard image, aspect ratio ${a.resolution}. Story concept: ${idea}. Subject/product lock: ${a.brand_product || "subject in approved brief"}. Visual continuity: ${a.visual_style || a.style}; clear focal point, motivated camera, coherent perspective. Negative constraints: no identity drift, deformation, random text, fake logos, watermark, unsupported claims.`,
          `Prompt video (English): Animate this scene for ${seconds} seconds. Action: ${idea}. Camera: smooth motivated movement, stable horizon, clear subject. Preserve exact identity, palette, proportions, materials, accessories, lighting and screen direction. No flicker, teleporting, unexplained object changes, random text, watermark, or unsupported claims.`,
          `Narasi: ${
            a.narration ||
            "Susun narasi sesuai brief dan bahasa yang diminta; jangan menambahkan klaim yang tidak didukung."
          }`,
        ].join("\n");
      });

      const thumbnail = `Create a polished ${a.style} key visual for a ${a.resolution} AI animation. Subject/brand: ${a.brand_product || "the subject specified in the approved brief"}. Brief: ${a.brief}. Product details: ${a.product_details || "not provided; do not invent product claims"}. Audience: ${a.audience || "general audience"}. Strong readable focal point, cinematic composition, controlled lighting, clean background, no tiny generated text, no watermark, no invented logo or unsupported claim.`;

      return textResult(
        [
          "KONSEP ANIMASI WOWSERU AI v0.3.2",
          `Produk/brand: ${a.brand_product || "Belum ditentukan"}`,
          `Brief disetujui: ${a.brief}`,
          `Detail produk/USP: ${
            a.product_details || "Belum diberikan; jangan mengarang klaim produk."
          }`,
          `Target audiens: ${a.audience || "Umum"}`,
          `Style: ${a.style}`,
          `Gaya visual: ${a.visual_style || a.style}`,
          `Durasi: ${a.duration_seconds} detik`,
          `Resolusi: ${a.resolution}`,
          `Jumlah scene: ${a.scene_count}`,
          `Bahasa: ${a.language}`,
          `Mode: ${a.mode}`,
          "",
          "KONSEP UTAMA DAN HOOK",
          `Hook: buka dengan visual yang paling jelas dan relevan dengan brief: ${a.brief}.`,
          "Pesan utama: satu ide utama, tanpa klaim yang tidak didukung.",
          "",
          "PROMPT THUMBNAIL (ENGLISH — READY TO COPY)",
          "```text",
          thumbnail,
          "```",
          "",
          "RANGKAIAN SCENE",
          ...scenes,
          "",
          "CONTINUITY CHECKLIST",
          "- Pertahankan bentuk, warna, proporsi, kemasan, label, logo, aksesori, dan detail yang diberikan.",
          "- Jaga konsistensi karakter, posisi objek, arah gerak, pencahayaan, lokasi, dan orientasi kamera.",
          "- Jangan mengarang USP, bahan, harga, testimoni, garansi, promo, atau tautan pembelian.",
          `Link produk/konten: ${a.product_link || "Tidak diberikan"}`,
          "Catatan: ini konsep dan prompt tekstual, bukan video hasil render.",
        ].join("\n")
      );
    }
  );

  server.registerTool(
    "create_storyboard",
    {
      description:
        "Membuat storyboard enam panel untuk satu scene setelah pengguna menyetujui konsep.",
      inputSchema: {
        concept: z.string().min(1),
        approval_id: z.string().uuid(),
        style: z.string().default("3D Cartoon"),
        character: z.string().optional(),
        scene_number: z.number().int().positive().default(1),
        scene_duration_seconds: z.number().positive().default(10),
        aspect_ratio: z.string().default("9:16"),
        language: z.string().optional(),
        narration: z.string().optional(),
      },
    },
    async (a) => {
      const approval = getApproval(a.approval_id);

      if (!approval?.lanjutAt) {
        return textResult(
          "Storyboard ditolak: tahap OK dan LANJUT belum tercatat untuk approval_id ini.",
          true
        );
      }

      const subject =
        a.character || "the main subject described in the approved brief";

      const panels = [
        [
          "Wide establishing shot",
          "Show the environment and establish light direction and key props",
          "Slow push-in from a stable wide frame",
        ],
        [
          "Medium hero shot",
          "Reveal defining silhouette, materials, colors and shape",
          "Gentle lateral slide; keep the subject readable",
        ],
        [
          "Medium close-up",
          `Show the primary action: ${a.concept}`,
          "Smooth motivated tracking movement",
        ],
        [
          "Close-up detail",
          "Show a relevant detail or reaction without inventing features",
          "Subtle rack focus while preserving object position",
        ],
        [
          "Hero close-up",
          "Deliver the most memorable visual beat with a clean silhouette",
          "Controlled short push-in, then hold",
        ],
        [
          "Composed end frame",
          "Resolve the action and hold a clean frame for transition",
          "Ease to a stable hold",
        ],
      ];

      const panelSeconds = a.scene_duration_seconds / 6;

      const panelDirections = panels
        .map((p, i) => {
          const from = (panelSeconds * i).toFixed(1);
          const to = (panelSeconds * (i + 1)).toFixed(1);

          return `PANEL ${i + 1} (${from}-${to} seconds): SHOT: ${p[0]}. ACTION: ${p[1]}. CAMERA: ${p[2]}.`;
        })
        .join("\n");

      const storyboardPrompt = `Create a polished 2x3 storyboard grid with six connected panels for Scene ${a.scene_number} of a ${a.style} animation, aspect ratio ${a.aspect_ratio}.
STORY CONCEPT: ${a.concept}.
CONTINUITY LOCK: preserve the same subject identity, silhouette, colors, proportions, materials, accessories, environment layout, lighting direction, screen direction, scale, and object placement across all six panels.
CONSISTENT TALENT / CHARACTER: ${subject}. Keep the same face, clothing, hairstyle, body proportions, and expression style throughout.
PRODUCT / OBJECT CONSISTENCY: show only product details supplied in the brief; do not invent labels, logos, materials, or claims. Preserve the same shape and placement of any eyes or mouth on a talking object.
VISUAL CONTINUITY: use motivated camera angles and coherent perspective; each panel must progress naturally from the prior panel. The final panel must create a natural bridge into the next scene.
${panelDirections}
IMPORTANT / NEGATIVE CONSTRAINTS: no identity drift, deformation, duplicate subjects, changing clothing or product shape, extra parts, flicker, random text, fake logos, watermark, unsupported claims, or unexplained scene changes.`;

      return textResult(
        [
          `STORYBOARD — SCENE ${a.scene_number}`,
          `Konsep: ${a.concept}`,
          `Style: ${a.style}`,
          `Karakter/objek: ${subject}`,
          `Durasi: ${a.scene_duration_seconds} detik`,
          `Rasio: ${a.aspect_ratio}`,
          "",
          "PROMPT GAMBAR STORYBOARD (ENGLISH — READY TO COPY)",
          "```text",
          storyboardPrompt,
          "```",
          "",
          "CATATAN ENAM PANEL",
          ...panels.map(
            (p, i) =>
              `Panel ${i + 1}: ${p[0]} — ${p[1]}. Kamera: ${p[2]}.`
          ),
          "",
          "CONTINUITY LOCK",
          `Subject lock: ${subject}. Preserve identity, silhouette, colors, proportions, materials, accessories, lighting, environment layout, and screen direction.`,
          "Output adalah prompt tekstual untuk membuat grid 2×3, bukan gambar yang sudah dirender. Tambahkan teks saat editing untuk menghindari teks acak.",
        ].join("\n")
      );
    }
  );

  server.registerTool(
    "generate_animation_prompts",
    {
      description:
        "Membuat prompt gambar dan video berbahasa Inggris dengan timing, continuity lock, karakter/produk konsisten, dan negative constraints setelah konsep disetujui.",
      inputSchema: {
        scene: z.string().min(1),
        approval_id: z.string().uuid(),
        style: z.string().default("3D Cartoon Cinematic"),
        character: z.string().optional(),
        aspect_ratio: z.string().default("9:16"),
        scene_number: z.number().int().positive().default(1),
        duration_seconds: z.number().positive().max(60).default(5),
        narration: z.string().optional(),
        language: z.string().optional(),
        camera_direction: z.string().optional(),
        continuity_notes: z.string().optional(),
        negative_prompt: z.string().optional(),
      },
    },
    async (a) => {
      const approval = getApproval(a.approval_id);

      if (!approval?.lanjutAt) {
        return textResult(
          "Prompt produksi ditolak: tahap OK dan LANJUT belum tercatat untuk approval_id ini.",
          true
        );
      }

      const duration = a.duration_seconds;
      const subject =
        a.character || "the main subject described in the scene";

      const continuity =
        a.continuity_notes ||
        "Keep identity, silhouette, colors, proportions, labels, accessories, lighting direction, and spatial position consistent across frames and scenes.";

      const negative =
        a.negative_prompt ||
        "No identity drift, product deformation, changing colors or labels, extra/missing parts, flicker, jitter, broken anatomy, random text, fake logos, watermark, unexplained object changes, or unsupported claims.";

      const t1 = (duration * 0.25).toFixed(1);
      const t2 = (duration * 0.55).toFixed(1);
      const t3 = (duration * 0.8).toFixed(1);

      const timeline = [
        `0.0-${t1}s: Establish subject and environment with a readable composition.`,
        `${t1}-${t2}s: Execute the primary action smoothly with plausible weight and contact.`,
        `${t2}-${t3}s: Show key detail or emotional beat while preserving identity.`,
        `${t3}-${duration.toFixed(1)}s: Settle into a clean hero frame suitable for transition.`,
      ];

      const imagePrompt = `STORY CONCEPT: ${a.scene}
CONTINUITY LOCK: ${continuity}
CONSISTENT TALENT / CHARACTER: ${subject}; preserve identity, silhouette, proportions, colors, materials, and accessories.
PRODUCT / OBJECT CONSISTENCY: show only details supplied in the brief; do not invent specifications, labels, logos, or claims.
VISUAL CONTINUITY: ${a.camera_direction || "Clean cinematic composition and motivated camera angle."} Keep lighting direction, background geography, screen direction, and object placement coherent.
STYLE: ${a.style}; portrait ${a.aspect_ratio}; polished composition, clear focal point.
IMPORTANT / NEGATIVE CONSTRAINTS: ${negative}. No tiny generated text; add typography during editing.`;

      const videoPrompt = `Animate this scene in ${a.style}, portrait ${a.aspect_ratio}, total duration ${duration} seconds.
SCENE: ${a.scene}
SUBJECT LOCK: ${subject}. Keep identity and defining features unchanged.
CONTINUITY LOCK: ${continuity}
CAMERA DIRECTION: ${a.camera_direction || "Smooth motivated dolly-in, stable horizon and controlled focus."}
TIMED ACTION: ${timeline.join(" ")}
MOTION QUALITY: coherent acceleration, natural contact and weight, no sudden teleporting or frame-to-frame shape changes.
IMPORTANT / NEGATIVE CONSTRAINTS: ${negative}.`;

      return textResult(
        [
          "WOWSERU AI ANIMASI — PRODUCTION PROMPTS",
          `Scene ${a.scene_number}: ${a.scene}`,
          `Style: ${a.style}`,
          `Subject: ${subject}`,
          `Aspect ratio: ${a.aspect_ratio}`,
          `Duration: ${duration}s`,
          "",
          "IMAGE PROMPT (ENGLISH — READY TO COPY)",
          "```text",
          imagePrompt,
          "```",
          "",
          "VIDEO PROMPT (ENGLISH — READY TO COPY)",
          "```text",
          videoPrompt,
          "```",
          "",
          "TIMING BREAKDOWN",
          ...timeline,
          "",
          "CONTINUITY CHECKLIST",
          `- Subject: ${subject}.`,
          `- Visual lock: ${continuity}.`,
          `- Negative constraints: ${negative}`,
          `- Narasi: ${
            a.narration ||
            "Belum diberikan; susun sesuai brief dan bahasa yang diminta."
          }`,
          "Catatan: tool ini menghasilkan prompt tekstual, bukan file gambar atau video final.",
        ].join("\n")
      );
    }
  );

  return server;
}

const handler = createMcpHandler(makeServer, {
  onerror: (error) => console.error("MCP ERROR:", error),
});

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return Response.json({
        service: "wowseru-ai-animasi",
        version: "0.3.2",
        status: "ready",
        endpoint: "/mcp",
        tools: 5,
      });
    }

    if (url.pathname === "/health") {
      return Response.json({
        service: "wowseru-ai-animasi",
        version: "0.3.2",
        status: "ok",
        skill_loaded: true,
        mcp_endpoint: "/mcp",
        tools: 5,
      });
    }

    if (url.pathname === "/mcp") {
      return handler(request, env, ctx);
    }

    return new Response("Not Found", { status: 404 });
  },
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/.well-known/openai-apps-challenge") {
  return new Response("S3DiK60Ub74uyuvdHsOdOpiuaeHTMFSbdVtto4G1LbI", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}


