import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

// WOWSERU AI ANIMASI v0.3.2
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
    "kurang cocok", "belum cocok", "tidak cocok",
    "nggak cocok", "gak cocok", "kurang bagus",
    "belum bagus", "kurang menarik", "tidak suka",
    "nggak suka", "gak suka", "kurang pas",
    "belum pas", "coba ide lain", "coba alternatif",
    "ganti ", "ubah ", "revisi", "tapi ending",
    "tapi bagian", "tapi ganti",
  ];

  if (
    negativePhrases.some((phrase) => normalized.includes(phrase)) ||
    normalized.includes(" tapi ")
  ) {
    return false;
  }

  const positivePhrases = [
    "ok", "oke", "cocok", "bagus", "mantap", "keren",
    "setuju", "deal", "gas", "gaskeun", "lanjut",
    "lanjutkan", "sip", "mantul", "boleh", "suka",
    "aku suka", "saya suka", "gue suka",
    "ini yang saya mau", "ini yang aku mau",
    "pas banget", "bagus banget",
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
- Output: konsep cerita, storyboard, prompt gambar/video.
- Jangan mengklaim telah merender video atau gambar final.

## PEMBUKA
Jika pengguna mengetik "Mulai", tampilkan pesan teks biasa.
Jangan memanggil tool pada tahap pembuka.

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

## SETELAH BRIEF DIKIRIM
- Jangan tampilkan template kosong jika informasi sudah diberikan.
- Pertahankan pilihan pengguna.
- Rangkum brief dan rekomendasikan alur scene.
- Setiap scene punya judul, aksi, dialog bila relevan, dan transisi.
- Jangan mengarang klaim produk.
- Minta pengguna menilai konsep.
- Jangan membuat storyboard atau produksi sebelum konsep disetujui.

## FEEDBACK
- Jika tidak puas, tawarkan 5 konsep berbeda jika diminta alternatif.
- Jika revisi spesifik diminta, revisi bagian itu saja.
- Jangan membuat prompt produksi sebelum konsep revisi disetujui.
- Jika pengguna menyetujui konsep terbaru, lanjutkan tanpa meminta brief diulang.
- Jika pujian disertai permintaan revisi, revisi dahulu.

## PAKET PRODUKSI
Setelah persetujuan terpenuhi, buat:
1. Prompt thumbnail dalam bahasa Inggris.
2. Prompt storyboard enam panel 2x3 untuk setiap scene.
3. Prompt video dengan timing.
4. Dialog dan narasi sesuai bahasa pengguna.
5. Camera direction dan continuity lock.
6. Negative prompt.
7. Checklist kontinuitas dan catatan produksi.

Setiap prompt siap salin berada dalam blok kode terpisah.
Jaga kontinuitas antarscene.

## PEMANGGILAN TOOL
- Jangan panggil tool ketika pengguna hanya mengetik "Mulai".
- Gunakan skema tool yang tersedia.
- Jangan membuat produksi sebelum persetujuan yang diwajibkan.
- Jangan mengklaim tool berhasil jika terjadi error.
- Gunakan brief terbaru dari percakapan aktif.

## KONSISTENSI MEREK
- Gunakan nama WOWSERU AI ANIMASI.
- Pertahankan produk, karakter, gaya, durasi, dan bahasa pilihan pengguna.
- Tokoh publik dalam iklan harus jelas sebagai fiksi/parodi.
`;

  const server = new McpServer(
    { name: "wowseru-ai-animasi", version: "0.3.2" },
    { instructions: skillInstructions }
  );

  server.registerTool(
    "confirm_animation_brief",
    {
      description:
        "Catat persetujuan konsep terbaru setelah feedback positif yang jelas.",
      inputSchema: {
        brief: z.string().min(1),
        confirmation_text: z.string().min(1),
      },
    },
    async ({ brief, confirmation_text }) => {
      if (!isPositiveFeedback(confirmation_text)) {
        return textResult(
          "Persetujuan belum tercatat. Feedback belum menunjukkan persetujuan yang jelas.",
          true
        );
      }

      const approval_id = crypto.randomUUID();
      approvals.set(approval_id, {
        brief: brief.trim(),
        approvedAt: Date.now(),
      });

      return textResult(
        `Konsep disetujui. approval_id: ${approval_id}. ` +
        "Lanjutkan dengan confirm_animation_lanjut menggunakan persetujuan yang sama."
      );
    }
  );

  server.registerTool(
    "confirm_animation_lanjut",
    {
      description:
        "Catat persetujuan produksi berdasarkan feedback positif yang sama.",
      inputSchema: {
        approval_id: z.string().uuid(),
        confirmation_text: z.string().min(1),
      },
    },
    async ({ approval_id, confirmation_text }) => {
      const state = getApproval(approval_id);

      if (!state || !isPositiveFeedback(confirmation_text)) {
        return textResult(
          "Persetujuan produksi belum tercatat. Periksa approval_id dan feedback.",
          true
        );
      }

      state.lanjutAt = Date.now();

      return textResult(
        `Persetujuan produksi tercatat. approval_id: ${approval_id}.`
      );
    }
  );

  server.registerTool(
    "create_animation_concept",
    {
      description:
        "Membuat paket konsep setelah dua tahap persetujuan terpenuhi.",
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
          "Produksi ditolak: persetujuan konsep dan produksi belum lengkap.",
          true
        );
      }

      if (a.brief.trim() !== approval.brief) {
        return textResult(
          "Produksi ditolak: brief berbeda dari brief yang disetujui.",
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

        return [
          `SCENE ${i + 1}`,
          `Timing: ${start}-${end}s (${seconds}s)`,
          `Ide/aksi: ${idea}`,
          "Continuity lock: preserve identity, silhouette, colors, proportions, accessories, lighting, and object placement.",
          `Prompt gambar (English): Create a polished ${a.style} storyboard image, aspect ratio ${a.resolution}. Story concept: ${idea}. Subject/product: ${a.brand_product || "subject in approved brief"}. Visual style: ${a.visual_style || a.style}. No identity drift, deformation, random text, fake logos, watermark, or unsupported claims.`,
          `Prompt video (English): Animate this scene for ${seconds} seconds. Action: ${idea}. Use smooth motivated camera movement and preserve identity, proportions, colors, materials, accessories, lighting, and screen direction. No flicker, teleporting, random text, watermark, or unsupported claims.`,
          `Narasi: ${a.narration || "Susun narasi sesuai brief dan bahasa yang diminta."}`,
        ].join("\n");
      });

      const thumbnail = `Create a polished ${a.style} key visual for a ${a.resolution} AI animation. Subject/brand: ${a.brand_product || "subject specified in approved brief"}. Brief: ${a.brief}. Product details: ${a.product_details || "not provided; do not invent product claims"}. Audience: ${a.audience || "general audience"}. Strong focal point, cinematic composition, controlled lighting, no tiny generated text, no watermark, no invented logo or unsupported claim.`;

      return textResult([
        "KONSEP ANIMASI WOWSERU AI",
        `Produk/brand: ${a.brand_product || "Belum ditentukan"}`,
        `Brief disetujui: ${a.brief}`,
        `Detail produk/USP: ${a.product_details || "Belum diberikan"}`,
        `Target audiens: ${a.audience || "Umum"}`,
        `Style: ${a.style}`,
        `Gaya visual: ${a.visual_style || a.style}`,
        `Durasi: ${a.duration_seconds} detik`,
        `Resolusi: ${a.resolution}`,
        `Jumlah scene: ${a.scene_count}`,
        `Bahasa: ${a.language}`,
        `Mode: ${a.mode}`,
        "",
        "PROMPT THUMBNAIL (ENGLISH)",
        "```text",
        thumbnail,
        "```",
        "",
        "RANGKAIAN SCENE",
        ...scenes,
        "",
        "CONTINUITY CHECKLIST",
        "- Pertahankan bentuk, warna, proporsi, kemasan, label, logo, dan aksesori sesuai brief.",
        "- Jaga konsistensi karakter, posisi objek, arah gerak, pencahayaan, dan lokasi.",
        "- Jangan mengarang klaim produk.",
        `Link produk/konten: ${a.product_link || "Tidak diberikan"}`,
        "Output berupa konsep dan prompt tekstual, bukan video hasil render.",
      ].join("\n"));
    }
  );

  server.registerTool(
    "create_storyboard",
    {
      description:
        "Membuat storyboard enam panel untuk satu scene setelah persetujuan.",
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
          "Storyboard ditolak: persetujuan konsep dan produksi belum lengkap.",
          true
        );
      }

      const subject = a.character || "the main subject described in the brief";
      const panels = [
        ["Wide establishing shot", "Establish environment and light direction", "Slow push-in"],
        ["Medium hero shot", "Reveal defining silhouette, materials, colors, and shape", "Gentle lateral slide"],
        ["Medium close-up", `Show the primary action: ${a.concept}`, "Smooth tracking movement"],
        ["Close-up detail", "Show a relevant detail or reaction", "Subtle rack focus"],
        ["Hero close-up", "Deliver the memorable visual beat", "Controlled short push-in"],
        ["Composed end frame", "Resolve action and hold for transition", "Ease to a stable hold"],
      ];

      const panelSeconds = a.scene_duration_seconds / 6;
      const panelDirections = panels.map((p, i) => {
        const from = (panelSeconds * i).toFixed(1);
        const to = (panelSeconds * (i + 1)).toFixed(1);
        return `PANEL ${i + 1} (${from}-${to}s): SHOT: ${p[0]}. ACTION: ${p[1]}. CAMERA: ${p[2]}.`;
      }).join("\n");

      const storyboardPrompt = `Create a polished 2x3 storyboard grid with six connected panels for Scene ${a.scene_number} of a ${a.style} animation, aspect ratio ${a.aspect_ratio}.
STORY CONCEPT: ${a.concept}.
CONSISTENT CHARACTER: ${subject}. Keep the same identity, clothing, colors, proportions, materials, accessories, and expression style.
PRODUCT CONSISTENCY: show only product details supplied in the brief; do not invent labels, logos, materials, or claims.
VISUAL CONTINUITY: coherent perspective, lighting direction, screen direction, scale, and object placement. The final panel bridges naturally into the next scene.
${panelDirections}
NEGATIVE CONSTRAINTS: no identity drift, deformation, duplicate subjects, changing product shape, extra parts, flicker, random text, fake logos, watermark, or unsupported claims.`;

      return textResult([
        `STORYBOARD — SCENE ${a.scene_number}`,
        `Konsep: ${a.concept}`,
        `Style: ${a.style}`,
        `Karakter/objek: ${subject}`,
        `Durasi: ${a.scene_duration_seconds} detik`,
        `Rasio: ${a.aspect_ratio}`,
        "",
        "PROMPT GAMBAR STORYBOARD (ENGLISH)",
        "```text",
        storyboardPrompt,
        "```",
        "",
        "CATATAN ENAM PANEL",
        ...panels.map((p, i) => `Panel ${i + 1}: ${p[0]} — ${p[1]}. Kamera: ${p[2]}.`),
        "",
        "Output adalah prompt tekstual untuk membuat grid 2x3, bukan gambar yang sudah dirender.",
      ].join("\n"));
    }
  );

  server.registerTool(
    "generate_animation_prompts",
    {
      description:
        "Membuat prompt gambar dan video berbahasa Inggris dengan timing dan continuity lock.",
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
          "Prompt produksi ditolak: persetujuan konsep dan produksi belum lengkap.",
          true
        );
      }

      const duration = a.duration_seconds;
      const subject = a.character || "the main subject described in the scene";
      const continuity = a.continuity_notes ||
        "Keep identity, silhouette, colors, proportions, labels, accessories, lighting, and spatial position consistent.";
      const negative = a.negative_prompt ||
        "No identity drift, product deformation, changing colors or labels, extra parts, flicker, jitter, random text, fake logos, watermark, or unsupported claims.";

      const t1 = (duration * 0.25).toFixed(1);
      const t2 = (duration * 0.55).toFixed(1);
      const t3 = (duration * 0.8).toFixed(1);

      const timeline = [
        `0.0-${t1}s: Establish subject and environment clearly.`,
        `${t1}-${t2}s: Execute the primary action smoothly.`,
        `${t2}-${t3}s: Show the key detail or emotional beat.`,
        `${t3}-${duration.toFixed(1)}s: Settle into a clean hero frame.`,
      ];

      const imagePrompt = `STORY CONCEPT: ${a.scene}
CONTINUITY LOCK: ${continuity}
CHARACTER: ${subject}; preserve identity, silhouette, proportions, colors, materials, and accessories.
STYLE: ${a.style}; portrait ${a.aspect_ratio}.
CAMERA: ${a.camera_direction || "Clean cinematic composition and motivated camera angle."}
NEGATIVE CONSTRAINTS: ${negative}`;

      const videoPrompt = `Animate this scene in ${a.style}, portrait ${a.aspect_ratio}, total duration ${duration} seconds.
SCENE: ${a.scene}
SUBJECT LOCK: ${subject}.
CONTINUITY LOCK: ${continuity}
CAMERA: ${a.camera_direction || "Smooth motivated dolly-in, stable horizon, controlled focus."}
TIMED ACTION: ${timeline.join(" ")}
NEGATIVE CONSTRAINTS: ${negative}`;

      return textResult([
        "WOWSERU AI ANIMASI — PRODUCTION PROMPTS",
        `Scene ${a.scene_number}: ${a.scene}`,
        `Style: ${a.style}`,
        `Subject: ${subject}`,
        `Aspect ratio: ${a.aspect_ratio}`,
        `Duration: ${duration}s`,
        "",
        "IMAGE PROMPT (ENGLISH)",
        "```text",
        imagePrompt,
        "```",
        "",
        "VIDEO PROMPT (ENGLISH)",
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
        `- Narasi: ${a.narration || "Susun sesuai brief dan bahasa yang diminta."}`,
        "Output berupa prompt tekstual, bukan file gambar atau video final.",
      ].join("\n"));
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

    if (url.pathname === "/.well-known/openai-apps-challenge") {
      return new Response("S3DiK60Ub74uyuvdHsOdOpiuaeHTMFSbdVtto4G1LbI", {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

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
