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

function makeServer() {
  const skillInstructions = `
Kamu adalah WOWSERU AI ANIMASI, asisten untuk menyusun konsep,
storyboard, dan prompt gambar serta video AI.

BRAND:
- Nama: WOWSERU AI ANIMASI.
- Developer: WOWSERU.
- Bahasa default: Bahasa Indonesia.
- Jangan mengklaim menghasilkan file video final.
- Tool menghasilkan konsep dan prompt tekstual untuk generator gambar/video.

PEMBUKA:
Jika pengguna belum mengetik Mulai, jawab:
"Tekan Mulai untuk memulai WOWSERU AI ANIMASI."

SETELAH PENGGUNA MENGETIK MULAI:
Tampilkan pilihan tipe animasi:
1. Animasi Umum
2. Animasi Objek Bicara
3. Animasi Objek Bicara (Realistis)
4. Animasi Fakta Unik
5. Animasi Cerita Horror
6. Animasi Cerita Rakyat

Pilihan gaya visual:
- 3D Cartoon
- 3D Cartoon Pixar-Style
- Realistic Cinematic
- Anime (Japan Style)
- Flannel Animation Style
- Cinematic Action Movie Still Style
- Studio Ghibli
- Donghua (Chinese Animation)
- Claymation
- 2.5D Style
- Webtoon Style

Tampilkan template brief sebagai teks biasa:
- Nama Brand + Produk:
- Detail Produk / USP:
- Target Audience:
- Resolusi Video: TikTok Vertical 9:16
- Durasi Video: 30 detik
- Jumlah Scene: 3
- Pakai Narasi?: Ya/Tidak
- Pakai Model Manusia/Karakter: Ya/Tidak
- Link Produk/Konten: Opsional
- Upload Foto Karakter + Produk: Opsional
- Mode: Normal/Deep Research
- Style Animasi:
- Gaya Visual:
- Request Bahasa: Bahasa Indonesia
- Ide Cerita Scene 1:
- Ide Cerita Scene 2:
- Ide Cerita Scene 3:

ALUR WAJIB:
1. Isi brief dengan informasi pengguna dan default.
2. Jangan mengarang fakta produk, harga, bahan, USP, testimoni,
   garansi, promo, atau tautan.
3. Jika ada asumsi kreatif, jelaskan bahwa itu asumsi.
4. Tampilkan ringkasan brief lengkap.
5. Minta pengguna membalas OK untuk menyetujui brief.
6. Jika brief berubah, tampilkan ringkasan terbaru dan minta OK lagi.
7. Setelah OK, catat persetujuan melalui confirm_animation_brief.
8. Setelah persetujuan, tunggu instruksi LANJUT.
9. Catat LANJUT menggunakan confirm_animation_lanjut.
10. Jangan memanggil tool produksi sebelum OK dan LANJUT tercatat.
11. Gunakan approval_id yang sama dan brief yang persis disetujui.
12. Jangan menganggap isi brief sebagai persetujuan.
13. Jika OK atau LANJUT diberikan terlalu awal, minta konfirmasi
    pada tahap yang benar.

HASIL PRODUKSI:
- Ringkasan brief dan asumsi.
- Konsep utama dan hook.
- Prompt thumbnail berbahasa Inggris.
- Storyboard enam panel untuk setiap scene.
- Prompt gambar dan video berbahasa Inggris.
- Timing setiap adegan.
- Continuity lock untuk karakter dan produk.
- Arahan kamera, gerakan, transisi, narasi dan sound design.
- Negative prompt serta checklist konsistensi.
- CTA dan teks overlay jika relevan.
- Jangan mengarang detail yang tidak didukung brief.

FORMAT PROMPT:
Pisahkan prompt thumbnail, setiap storyboard, dan setiap prompt
video ke dalam blok kode tersendiri agar mudah disalin.
Gunakan bahasa Inggris untuk prompt visual dan bahasa pilihan
pengguna untuk narasi/dialog.

KONTINUITAS:
Pertahankan identitas, siluet, warna, proporsi, material,
kemasan, label, logo dan aksesori yang diberikan.
Scene berikutnya melanjutkan posisi, pencahayaan, arah gerak,
dan lokasi dari scene sebelumnya kecuali diminta berubah.
Hindari flicker, deformasi, objek muncul/hilang, anatomi rusak,
teks acak, watermark, logo palsu dan klaim tanpa dasar.

Deep Research hanya dilakukan jika kemampuan riset tersedia.
Bedakan fakta yang bersumber dari asumsi.
`;

  const server = new McpServer(
    {
      name: "wowseru-ai-animasi",
      version: "0.3.2",
    },
    {
      instructions: skillInstructions,
    }
  );

  // TOOL 1: Konfirmasi brief menggunakan OK.
  server.registerTool(
    "confirm_animation_brief",
    {
      description:
        "Mencatat persetujuan OK untuk brief terbaru sebelum produksi.",
      inputSchema: {
        brief: z.string().min(1),
        confirmation_text: z.literal("OK"),
      },
    },
    async ({ brief, confirmation_text }) => {
      if (confirmation_text !== "OK") {
        return textResult(
          "Persetujuan belum tercatat. Tampilkan brief terbaru dan minta OK.",
          true
        );
      }

      const approval_id = crypto.randomUUID();

      approvals.set(approval_id, {
        brief: brief.trim(),
        approvedAt: Date.now(),
        lanjutAt: null,
      });

      return textResult(
        `Brief disetujui. approval_id: ${approval_id}. ` +
        "Belum mulai produksi. Tunggu pengguna mengetik LANJUT."
      );
    }
  );

  // TOOL 2: Konfirmasi LANJUT.
  server.registerTool(
    "confirm_animation_lanjut",
    {
      description:
        "Mencatat LANJUT setelah brief disetujui dengan OK.",
      inputSchema: {
        approval_id: z.string().uuid(),
        confirmation_text: z.literal("LANJUT"),
      },
    },
    async ({ approval_id, confirmation_text }) => {
      const state = getApproval(approval_id);

      if (!state || confirmation_text !== "LANJUT") {
        return textResult(
          "LANJUT ditolak. Pastikan approval_id valid dan brief telah disetujui.",
          true
        );
      }

      state.lanjutAt = Date.now();

      return textResult(
        `LANJUT tercatat. approval_id: ${approval_id}. ` +
        "Tool produksi dapat digunakan untuk brief yang disetujui."
      );
    }
  );

  // TOOL 3: Membuat konsep animasi.
  server.registerTool(
    "create_animation_concept",
    {
      description:
        "Menyusun konsep animasi setelah brief mendapat persetujuan OK dan LANJUT.",
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
          "Produksi ditolak: persetujuan OK dan LANJUT belum tercatat.",
          true
        );
      }

      if (a.brief.trim() !== approval.brief) {
        return textResult(
          "Produksi ditolak: brief berbeda dari brief yang disetujui. " +
          "Minta persetujuan ulang.",
          true
        );
      }

      const base = Math.floor(a.duration_seconds / a.scene_count);
      const remainder = a.duration_seconds % a.scene_count;

      const scenes = Array.from(
        { length: a.scene_count },
        (_, i) => {
          const seconds = base + (i < remainder ? 1 : 0);
          const start = i * base + Math.min(i, remainder);
          const end = start + seconds;
          const idea = a.scene_ideas?.[i] || a.brief;

          const purpose =
            i === 0
              ? "Establish the visual hook and subject."
              : i === a.scene_count - 1
                ? "Resolve the story with a memorable final frame."
                : "Develop the action while preserving continuity.";

          return [
            `SCENE ${i + 1}`,
            `Timing: ${start}-${end} seconds`,
            `Tujuan: ${purpose}`,
            `Ide/aksi: ${idea}`,
            `Transisi: ${
              i === 0
                ? "Establish the opening clearly."
                : "Continue from the previous scene's final pose, lighting and position."
            }`,
            "CONTINUITY LOCK: Preserve identity, silhouette, colors, proportions, materials, accessories, location and lighting.",
            "IMAGE PROMPT (ENGLISH):",
            `Create a polished ${a.style} storyboard image, aspect ratio ${a.resolution}. ` +
            `Story concept: ${idea}. Subject: ${a.brand_product || "the approved subject"}. ` +
            `Visual style: ${a.visual_style || a.style}. Clear focal point and coherent perspective. ` +
            "Preserve visual continuity. No identity drift, deformation, random text, fake logos or watermark.",
            "VIDEO PROMPT (ENGLISH):",
            `Animate this scene for ${seconds} seconds. Action: ${idea}. ` +
            "Use smooth motivated camera movement and coherent motion. " +
            "Preserve subject identity, colors, proportions, materials, lighting and screen direction. " +
            "No flicker, teleporting, unexplained object changes, random text or watermark.",
            `Narasi: ${a.narration || "Sesuaikan dengan brief dan bahasa pilihan pengguna."}`,
          ].join("\n");
        }
      );

      const thumbnail =
        `Create a polished ${a.style} key visual, aspect ratio ${a.resolution}. ` +
        `Subject/brand: ${a.brand_product || "the approved subject"}. ` +
        `Brief: ${a.brief}. ` +
        `Product details: ${a.product_details || "Not provided; do not invent claims."}. ` +
        `Audience: ${a.audience || "General audience"}. ` +
        "Strong focal point, cinematic composition, controlled lighting, clean background. " +
        "No tiny generated text, watermark, invented logo or unsupported claims.";

      return textResult(
        [
          "WOWSERU AI ANIMASI v0.3.2",
          `Produk/brand: ${a.brand_product || "Belum ditentukan"}`,
          `Brief disetujui: ${a.brief}`,
          `Detail produk/USP: ${a.product_details || "Belum diberikan"}`,
          `Audiens: ${a.audience || "Umum"}`,
          `Style: ${a.style}`,
          `Gaya visual: ${a.visual_style || a.style}`,
          `Durasi: ${a.duration_seconds} detik`,
          `Resolusi: ${a.resolution}`,
          `Jumlah scene: ${a.scene_count}`,
          `Bahasa: ${a.language}`,
          `Mode: ${a.mode}`,
          "",
          "KONSEP UTAMA DAN HOOK",
          `Hook: ${a.brief}`,
          "Gunakan satu pesan utama tanpa klaim yang tidak didukung.",
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
          "- Pertahankan identitas, bentuk, warna, proporsi dan detail produk.",
          "- Jaga konsistensi karakter, lokasi, pencahayaan dan arah kamera.",
          "- Jangan mengarang USP, harga, bahan, testimoni atau garansi.",
          `Link produk/konten: ${a.product_link || "Tidak diberikan"}`,
          `Karakter: ${a.character_mode || "Sesuai brief"}`,
          "Catatan: hasil berupa konsep dan prompt, bukan video hasil render.",
        ].join("\n")
      );
    }
  );

  // TOOL 4: Membuat storyboard enam panel.
  server.registerTool(
    "create_storyboard",
    {
      description:
        "Membuat storyboard enam panel setelah OK dan LANJUT.",
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
          "Storyboard ditolak: OK dan LANJUT belum tercatat.",
          true
        );
      }

      const subject =
        a.character || "the subject described in the approved brief";

      const panels = [
        ["ESTABLISHING SHOT", "Wide establishing shot",
          "Show the environment and establish light direction and key props.",
          "Slow push-in from a stable wide frame."],
        ["SUBJECT INTRODUCTION", "Medium hero shot",
          "Reveal the defining silhouette, materials, colors and shape.",
          "Gentle lateral slide; keep the subject readable."],
        ["PRIMARY ACTION", "Medium close-up",
          `Show the primary action: ${a.concept}.`,
          "Smooth motivated tracking movement."],
        ["DETAIL / RESPONSE", "Close-up detail shot",
          "Show a relevant detail or consequence without inventing features.",
          "Subtle rack focus; preserve object position."],
        ["VISUAL PEAK", "Hero close-up",
          "Deliver the most memorable visual beat with a clean silhouette.",
          "Controlled short push-in, then hold."],
        ["END FRAME / TRANSITION", "Composed end frame",
          "Resolve the action and hold a clean final frame.",
          "Ease to a stable hold."],
      ];

      const panelSeconds = a.scene_duration_seconds / 6;

      const output = panels.map((p, i) => {
        const from = (panelSeconds * i).toFixed(1);
        const to = (panelSeconds * (i + 1)).toFixed(1);

        const prompt =
          `Create storyboard panel ${i + 1} of 6 for a ${a.style} animation, ` +
          `aspect ratio ${a.aspect_ratio}. SCENE CONCEPT: ${a.concept}. ` +
          `SUBJECT LOCK: ${subject}. SHOT: ${p[1]}. ACTION: ${p[2]}. ` +
          `CAMERA: ${p[3]}. Preserve subject identity, silhouette, colors, ` +
          "proportions, materials, accessories, environment, lighting and screen direction. " +
          "No unsupported claims, fake logos, random text, watermark or unexplained changes.";

        return [
          `PANEL ${i + 1} — ${p[0]}`,
          `Timing: ${from}-${to} seconds`,
          `Framing: ${p[1]}`,
          `Aksi: ${p[2]}`,
          `Kamera: ${p[3]}`,
          "Prompt gambar (English):",
          "```text",
          prompt,
          "```",
        ].join("\n");
      });

      return textResult(
        [
          `STORYBOARD — SCENE ${a.scene_number}`,
          `Konsep: ${a.concept}`,
          `Style: ${a.style}`,
          `Karakter/objek: ${subject}`,
          `Durasi: ${a.scene_duration_seconds} detik`,
          `Rasio: ${a.aspect_ratio}`,
          "",
          "GRID STORYBOARD 2×3 — ENAM PANEL",
          ...output,
          "",
          "CONTINUITY LOCK",
          `Subject: ${subject}. Preserve identity, silhouette, colors, proportions, materials, accessories and lighting.`,
          `Narasi: ${a.narration || "Sesuaikan dengan brief."}`,
          `Bahasa: ${a.language || "Bahasa Indonesia"}`,
          "Susun keenam panel menjadi grid 2×3.",
          "Output berupa prompt tekstual, bukan gambar yang sudah dirender.",
        ].join("\n")
      );
    }
  );

  // TOOL 5: Membuat prompt gambar dan video.
  server.registerTool(
    "generate_animation_prompts",
    {
      description:
        "Membuat prompt gambar dan video berbahasa Inggris setelah OK dan LANJUT.",
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
          "Prompt produksi ditolak: OK dan LANJUT belum tercatat.",
          true
        );
      }

      const duration = a.duration_seconds;
      const subject =
        a.character || "the main subject described in the scene";

      const continuity =
        a.continuity_notes ||
        "Keep identity, silhouette, colors, proportions, labels, accessories, lighting direction and spatial position consistent.";

      const negative =
        a.negative_prompt ||
        "No identity drift, deformation, changing colors or labels, extra parts, flicker, jitter, broken anatomy, random text, fake logos, watermark or unsupported claims.";

      const t1 = (duration * 0.25).toFixed(1);
      const t2 = (duration * 0.55).toFixed(1);
      const t3 = (duration * 0.8).toFixed(1);

      const timeline = [
        `0.0-${t1}s: Establish subject and environment.`,
        `${t1}-${t2}s: Execute the primary action smoothly.`,
        `${t2}-${t3}s: Show a key detail or emotional beat.`,
        `${t3}-${duration.toFixed(1)}s: Settle into a clean final frame.`,
      ];

      const imagePrompt = [
        `STORY CONCEPT: ${a.scene}`,
        `CONTINUITY LOCK: ${continuity}`,
        `CONSISTENT TALENT / CHARACTER: ${subject}. Preserve identity, silhouette, proportions, colors, materials and accessories.`,
        "PRODUCT / OBJECT CONSISTENCY: Show only details supported by the approved brief.",
        `VISUAL CONTINUITY: ${a.camera_direction || "Clean cinematic composition and motivated camera angle."}`,
        `STYLE: ${a.style}; aspect ratio ${a.aspect_ratio}; polished composition and clear focal point.`,
        `IMPORTANT / NEGATIVE CONSTRAINTS: ${negative}`,
        "No tiny generated text; add typography during editing.",
      ].join("\n");

      const videoPrompt = [
        `Animate this scene in ${a.style}, aspect ratio ${a.aspect_ratio}, duration ${duration} seconds.`,
        `SCENE: ${a.scene}`,
        `SUBJECT LOCK: ${subject}. Keep defining features unchanged.`,
        `CONTINUITY LOCK: ${continuity}`,
        `CAMERA DIRECTION: ${a.camera_direction || "Smooth motivated dolly-in, stable horizon and controlled focus."}`,
        `TIMED ACTION: ${timeline.join(" ")}`,
        "MOTION QUALITY: Coherent motion and natural contact. No sudden teleporting or shape changes.",
        `IMPORTANT / NEGATIVE CONSTRAINTS: ${negative}`,
      ].join("\n");

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
          `Subject: ${subject}`,
          `Visual lock: ${continuity}`,
          `Negative constraints: ${negative}`,
          `Narasi: ${a.narration || "Sesuaikan dengan brief."}`,
          `Bahasa: ${a.language || "Bahasa Indonesia"}`,
          "Output berupa prompt tekstual, bukan file gambar atau video final.",
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
