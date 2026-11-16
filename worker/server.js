import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

// Approval state is stored in Cloudflare Durable Object.
// Approval records expire after 2 hours.
const APPROVAL_TTL_MS = 2 * 60 * 60 * 1000;

function approvalStore(env) {
  if (!env.APPROVALS) {
    throw new Error("Binding Durable Object APPROVALS belum dikonfigurasi.");
  }
  const id = env.APPROVALS.idFromName("wowseru-approval-store");
  return env.APPROVALS.get(id);
}

async function getApproval(env, id) {
  const response = await approvalStore(env).fetch(
    "https://approval-store/get",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ approval_id: id })
    }
  );

  if (response.status === 404) return undefined;
  if (!response.ok) {
    throw new Error(`Gagal membaca approval: HTTP ${response.status}`);
  }
  return response.json();
}

async function saveApproval(env, id, state) {
  const response = await approvalStore(env).fetch(
    "https://approval-store/set",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ approval_id: id, state })
    }
  );

  if (!response.ok) {
    throw new Error(`Gagal menyimpan approval: HTTP ${response.status}`);
  }
}

async function markApprovalLanjut(env, id) {
  const response = await approvalStore(env).fetch(
    "https://approval-store/lanjut",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ approval_id: id })
    }
  );

  if (response.status === 404) return undefined;
  if (!response.ok) {
    throw new Error(`Gagal memperbarui approval: HTTP ${response.status}`);
  }
  return response.json();
}

function textResult(text, isError = false) {
  return {
    content: [{ type: "text", text }],
    ...(isError ? { isError: true } : {})
  };
}

function makeServer(env) {
  const skillInstructions = `---
name: wowseru-ai-animasi
description: "WAJIB aktif ketika pengguna memilih atau mengetik Mulai, MULAI, atau WOWSERU AI ANIMASI Mulai. Tampilkan pembuka resmi WOWSERU AI ANIMASI, enam pilihan STYLE, daftar GAYA ANIMASI, tautan gaya lainnya, dan template brief sebagai teks biasa. Gunakan juga untuk brief, konsep, storyboard, dan prompt video dengan persetujuan OK lalu LANJUT."
---

# WOWSERU AI ANIMASI

## 1. Identitas dan aturan umum

- Nama produk: WOWSERU AI ANIMASI.
- Brand/developer: WOWSERU.
- Gunakan Bahasa Indonesia secara default.
- Jangan menyebut WIC sebagai pemilik atau brand tools.
- Jangan mengklaim dapat merender atau mengekspor file video final.
- Jangan mengarang detail produk, USP, harga, bahan, kandungan, testimoni, garansi, promo, stok, atau tautan.
- Jika ada foto produk/karakter, jadikan foto sebagai referensi utama.

## 2. Pembuka percakapan — dua tahap wajib

### Tahap 1: sebelum pengguna menekan Mulai

# Selamat datang di WOWSERU AI ANIMASI 🎬

Tekan Mulai untuk memulai WOWSERU AI ANIMASI.

Jangan tampilkan daftar STYLE, daftar GAYA ANIMASI, atau template brief pada tahap ini.

Gunakan logo resmi WOWSERU melalui aset manifest:
assets/logo.png dan assets/logo-dark.png.
Jangan mengarang atau mengganti logo.

### Tahap 2: setelah pengguna memilih atau mengetik Mulai

Tampilkan pembuka lengkap berikut. Jangan hanya membalas "siap dimulai". Jangan memanggil tools MCP untuk tahap pembuka.

# Selamat datang di WOWSERU AI ANIMASI 🎬

### List STYLE AI Animasi apa yang bisa dibuat?

1. Animasi Umum
2. Animasi Objek Bicara
3. Animasi Objek Bicara (Realistis)
4. Animasi Fakta Unik
5. Animasi Cerita Horror
6. Animasi Cerita Rakyat

### List GAYA ANIMASI apa yang bisa dibuat?

3D Cartoon / 3D Cartoon Pixar-Style / Realistic Cinematic / Anime (Japan Style) / Flannel Animation Style / Cinematic Action Movie Still Style / Studio Ghibli / Donghua (Chinese Animation) / Claymation / 2.5D Style / Webtoon Style

### 🎨 GAYA ANIMASI Lainnya

https://ai.wowseru.com/#styles

### Sebelum bikin Video AI, Isi Format Di Bawah Ini Dulu Ya: 👇🏻

\`\`\`yaml
• Nama Brand + Produk :
• Detail Produk / Usp:
• Target Audience:
• Resolusi Video: Tiktok Vertical 9:16
• Durasi Video(Detik): 30 Detik
• Adegan (Scene): 3
• Pakai Narasi?: Ya / Tidak
• Pakai Model Manusia/Karakter : Ya / Tidak
• Link Produk/Konten: Opsional
• Upload Foto Karakter + Produk: Opsional
• Mode: Normal / Deep Research
• Style Animasi : Animasi Objek Bicara (Realistis)
• Gaya Visual : Realistic Cinematic
• Request Bahasa :

• Ide Cerita Scene 1 :
• Ide Cerita Scene 2 :
• Ide Cerita Scene 3 :
\`\`\`

Detail produk bisa berisi fitur, bahan, ukuran, kandungan, tekstur, fungsi, cara pakai, keunggulan, pain point, dan informasi penting lainnya.

## 3. Pengisian brief

- Jangan menghilangkan, mengganti nama, menggabungkan, atau mengubah urutan kolom.
- Pertahankan pilihan pengguna.
- Jangan meminta ulang informasi yang sudah diberikan.
- Pengguna boleh mengisi sebagian template.
- Tanyakan hanya informasi penting yang masih kosong.
- Tandai usulan kreatif sebagai asumsi/usulan.
- Jangan membuat klaim produk yang tidak didukung.
- Pisahkan fakta bersumber dari asumsi jika melakukan Deep Research.

## 4. Alur persetujuan wajib

### Tahap A — OK

1. Rapikan informasi pengguna ke dalam template brief lengkap.
2. Tampilkan seluruh template yang sudah diisi.
3. Rangkum poin penting.
4. Tanyakan: "Apakah brief ini sudah benar? Balas OK untuk menyetujui atau tulis perubahan."
5. Jika ada perubahan, perbarui brief dan minta konfirmasi ulang.
6. Hanya balasan OK yang jelas dianggap persetujuan.
7. Setelah disetujui, ingatkan pengguna untuk mengetik LANJUT.

### Tahap B — LANJUT

1. Jangan produksi sebelum brief disetujui dengan OK.
2. Jangan produksi sebelum pengguna mengetik LANJUT.
3. Setelah kedua syarat terpenuhi, mulai produksi.
4. Jangan meminta persetujuan konsep kedua sebagai tahapan wajib.

## 5. Standar keluaran produksi

Urutan keluaran:

1. Ringkasan brief dan asumsi.
2. Konsep utama dan hook.
3. Prompt Thumbnail.
4. Storyboard setiap scene.
5. Prompt Video setiap scene.
6. Narasi/voice-over atau dialog.
7. CTA dan teks overlay.
8. Continuity checklist.
9. Penutup: "Terima kasih sudah menggunakan Tools AI Animasi WOWSERU."

## 6. Aturan prompt

- Setiap prompt generator gambar/video wajib berada dalam code block tersendiri.
- Prompt visual utama menggunakan bahasa Inggris.
- Narasi/dialog menggunakan bahasa yang diminta.
- Jangan menggabungkan prompt scene yang berbeda.

## 7. Standar storyboard

Setiap scene wajib mempunyai grid 2 kolom × 3 baris dengan tepat 6 panel.
Beri label Panel 1 sampai Panel 6.
Jaga konsistensi karakter, produk, lokasi, pencahayaan, warna, dan properti.
Scene berikutnya harus melanjutkan frame terakhir scene sebelumnya.

## 8. Standar prompt video

Setiap prompt harus mencakup:
- Story concept.
- Continuity lock.
- Character/product lock.
- Camera direction.
- Aksi dan gerakan.
- Negative prompt.
- Timing.
- Narasi/dialog jika diaktifkan.

Untuk video 30 detik dengan 3 scene, gunakan sekitar 10 detik per scene.

## 9. Negative prompt

No identity change.
No character redesign.
No inconsistent anatomy.
No product shape, size, color, packaging, label, or logo changes.
No flicker, jitter, or broken motion.
No random text, fake logos, or watermark.
No unsupported product claims.

## 10. Akurasi produk

Gunakan foto produk/karakter sebagai referensi jika tersedia.
Jangan mengarang spesifikasi, manfaat, harga, atau klaim.
Jika detail tidak tersedia, jelaskan keterbatasannya.

## 11. Pemeriksaan akhir

Pastikan brief, jumlah scene, durasi, storyboard, prompt video, narasi, dan continuity sesuai pilihan pengguna.

Akhiri dengan:
"Terima kasih sudah menggunakan Tools AI Animasi WOWSERU."
`;

  const server = new McpServer(
    { name: "wowseru-ai-animasi-mcp", version: "0.5.6" },
    { instructions: skillInstructions }
  );

  // TOOL 1 — APPROVE BRIEF
  server.registerTool("confirm_animation_brief", {
    description: "Catat persetujuan brief terbaru setelah pengguna membalas OK.",
    inputSchema: {
      brief: z.string().min(1),
      confirmation_text: z.literal("OK")
    }
  }, async ({ brief, confirmation_text }) => {
    if (confirmation_text !== "OK") {
      return textResult(
        "Persetujuan belum tercatat. Tampilkan brief dan tunggu OK.",
        true
      );
    }

    const approval_id = crypto.randomUUID();

    await saveApproval(env, approval_id, {
      brief: brief.trim(),
      approvedAt: Date.now()
    });

    return textResult(
      `Brief disetujui dan dicatat. approval_id: ${approval_id}. Belum boleh produksi; tunggu LANJUT.`
    );
  });

  // TOOL 2 — LANJUT
  server.registerTool("confirm_animation_lanjut", {
    description: "Catat instruksi LANJUT setelah brief disetujui.",
    inputSchema: {
      approval_id: z.string().uuid(),
      confirmation_text: z.literal("LANJUT")
    }
  }, async ({ approval_id, confirmation_text }) => {
    const state = await getApproval(env, approval_id);

    if (!state || confirmation_text !== "LANJUT") {
      return textResult(
        "LANJUT belum diterima. Periksa approval_id dan persetujuan OK.",
        true
      );
    }

    const updated = await markApprovalLanjut(env, approval_id);

    if (!updated) {
      return textResult(
        "LANJUT gagal dicatat: approval tidak ditemukan atau kedaluwarsa.",
        true
      );
    }

    return textResult(
      `LANJUT tercatat untuk brief yang disetujui. approval_id: ${approval_id}.`
    );
  });

  // TOOL 3 — CREATE ANIMATION CONCEPT
  server.registerTool("create_animation_concept", {
    description: "Menyusun konsep animasi dari brief yang telah disetujui dan dilanjutkan.",
    inputSchema: {
      approval_id: z.string().uuid(),
      brand_product: z.string().optional(),
      product_details: z.string().optional(),
      style: z.string().default("Animasi Objek Bicara (Realistis)"),
      visual_style: z.string().default("Realistic Cinematic"),
      audience: z.string().optional(),
      resolution: z.string().default("Vertical 9:16"),
      duration_seconds: z.number().int().positive().max(300).default(30),
      scene_count: z.number().int().min(1).max(12).default(3),
      narration: z.string().optional(),
      character_mode: z.string().optional(),
      language: z.string().default("Bahasa Indonesia"),
      mode: z.enum(["Normal", "Deep Research"]).default("Normal"),
      scene_ideas: z.array(z.string()).optional(),
      product_link: z.string().optional()
    }
  }, async (a) => {
    const approval = await getApproval(env, a.approval_id);

    if (!approval?.lanjutAt) {
      return textResult(
        "Produksi ditolak: tahap OK dan LANJUT belum tercatat.",
        true
      );
    }

    // Brief is now retrieved from the approved record.
    // No manual re-entry or exact-text comparison is required.
    const approvedBrief = approval.brief;

    const base = Math.floor(a.duration_seconds / a.scene_count);
    const remainder = a.duration_seconds % a.scene_count;

    const scenes = Array.from(
      { length: a.scene_count },
      (_, i) => {
        const seconds = base + (i < remainder ? 1 : 0);
        const from = i * base + Math.min(i, remainder);
        const to = from + seconds;

        const idea = a.scene_ideas?.[i] ||
          `Show ${a.brand_product || "the main subject"} in an engaging visual moment that follows the approved brief`;

        const phase = i === 0
          ? "Introduce the subject and establish the visual hook"
          : i === a.scene_count - 1
            ? "Resolve the story and finish on a memorable final frame"
            : "Develop the action while continuing directly from the previous scene";

        const narrationLine = a.narration &&
          !/^(ya|yes|aktif)$/i.test(a.narration.trim())
          ? a.narration
          : `Lihat ${a.brand_product || "cerita ini"}!`;

        const panelBeats = [
          "Panel 1: wide establishing shot.",
          "Panel 2: medium shot revealing the subject.",
          "Panel 3: medium close-up beginning the main action.",
          "Panel 4: close-up showing the key reaction.",
          "Panel 5: dynamic shot completing the action.",
          "Panel 6: clean hero shot with space for CTA."
        ];

        const imagePrompt =
          `Create ONE complete storyboard sheet in ${a.resolution}, ` +
          `EXACTLY 2 COLUMNS x 3 ROWS, six panels total. ` +
          `${panelBeats.join(" ")} ` +
          `STORY CONCEPT: ${idea}. SCENE PURPOSE: ${phase}. ` +
          `SUBJECT: ${a.brand_product || approvedBrief}. ` +
          `PRODUCT FACTS: ${a.product_details || "Do not invent product claims."}. ` +
          `TARGET AUDIENCE: ${a.audience || "General audience"}. ` +
          `VISUAL STYLE: ${a.visual_style || a.style}. ` +
          `Keep character design, proportions, colors, packaging, labels, ` +
          `lighting, and environment consistent. No extra panels, ` +
          `random text, fake logos, watermark, or unsupported claims.`;

        const videoPrompt =
          `Create a ${seconds}-second ${a.style} animation in ${a.resolution}. ` +
          `SCENE CONCEPT: ${idea}. ` +
          `TIMELINE: 0-${(seconds * 0.2).toFixed(1)}s establish subject; ` +
          `${(seconds * 0.2).toFixed(1)}-${(seconds * 0.55).toFixed(1)}s main action; ` +
          `${(seconds * 0.55).toFixed(1)}-${(seconds * 0.8).toFixed(1)}s reaction; ` +
          `${(seconds * 0.8).toFixed(1)}-${seconds}s final frame. ` +
          `CAMERA: smooth motivated movement. ` +
          `SUBJECT LOCK: ${a.brand_product || approvedBrief}. ` +
          `CONTINUITY LOCK: preserve identity, proportions, colors, ` +
          `labels, accessories, lighting, and screen direction. ` +
          `NEGATIVE: no identity drift, deformation, flicker, jitter, ` +
          `random text, fake logos, watermark, or unsupported claims.`;

        return {
          title: `SCENE ${i + 1}`,
          timing: `${from}-${to}s (${seconds}s)`,
          purpose: phase,
          idea,
          imagePrompt,
          videoPrompt,
          narration: narrationLine
        };
      }
    );

    const hookSubject = a.brand_product ||
      a.scene_ideas?.[0] || "cerita utama";

    const hook = `Pernah lihat ${hookSubject} dengan cara yang berbeda?`;

    const thumbnail =
      `Create a striking ${a.style} key visual for WOWSERU AI ANIMASI, ` +
      `${a.resolution}. MAIN SUBJECT: ${hookSubject}. ` +
      `STORY: ${scenes[0].idea}. VISUAL STYLE: ${a.visual_style}. ` +
      `Use cinematic composition, polished lighting, clear focal point, ` +
      `and preserve supplied product details. No fake logos or watermark.`;

    const promptBlock = (label, prompt) =>
      `${label}\n\`\`\`text\n${prompt}\n\`\`\``;

    const sceneOutput = scenes.flatMap((scene) => [
      scene.title,
      `Timing: ${scene.timing}`,
      `Tujuan cerita: ${scene.purpose}`,
      `Ide/aksi: ${scene.idea}`,
      `Narasi/dialog (${a.language}): ${scene.narration}`,
      promptBlock(`Prompt Gambar — ${scene.title}`, scene.imagePrompt),
      promptBlock(`Prompt Video — ${scene.title}`, scene.videoPrompt)
    ]);

    return textResult([
      "KONSEP ANIMASI WOWSERU AI",
      `Produk/brand: ${a.brand_product || "Tidak disebutkan"}`,
      `Brief disetujui: ${approvedBrief}`,
      `Detail produk/USP: ${a.product_details || "Tidak diberikan"}`,
      `Target audiens: ${a.audience || "Umum"}`,
      `Style animasi: ${a.style}`,
      `Gaya visual: ${a.visual_style}`,
      `Durasi total: ${a.duration_seconds} detik`,
      `Resolusi: ${a.resolution}`,
      `Jumlah scene: ${a.scene_count}`,
      `Bahasa: ${a.language}`,
      `Mode: ${a.mode}`,
      "",
      "KONSEP UTAMA DAN HOOK",
      `Konsep: ${scenes.map(s => s.idea).join(" → ")}`,
      `Hook: ${hook}`,
      "",
      promptBlock("PROMPT THUMBNAIL", thumbnail),
      "",
      "RANGKAIAN SCENE",
      ...sceneOutput,
      "",
      "CTA DAN TEXT OVERLAY",
      `CTA: ${a.brand_product ? `Kenali ${a.brand_product} lebih dekat.` : "Ajak penonton mengenal cerita lebih lanjut."}`,
      "",
      "CONTINUITY CHECKLIST",
      "- Pertahankan identitas, bentuk, warna, proporsi, dan detail produk.",
      "- Scene berikutnya dimulai dari posisi akhir scene sebelumnya.",
      "- Hindari flicker, jitter, teks acak, watermark, dan klaim tidak didukung.",
      `Link produk/konten: ${a.product_link || "Tidak diberikan"}`,
      "",
      "Terima kasih sudah menggunakan Tools AI Animasi WOWSERU.",
      "",
      "Catatan: hasil ini adalah konsep dan prompt tekstual, bukan file video final."
    ].join("\n"));
  });

  // TOOL 4 — CREATE STORYBOARD
  server.registerTool("create_storyboard", {
    description: "Membuat storyboard enam panel untuk satu scene setelah OK dan LANJUT.",
    inputSchema: {
      concept: z.string().min(1),
      approval_id: z.string().uuid(),
      style: z.string().default("Animasi Objek Bicara (Realistis)"),
      character: z.string().optional(),
      brand_product: z.string().optional(),
      product_details: z.string().optional(),
      scene_idea: z.string().optional(),
      scene_number: z.number().int().positive().default(1),
      scene_duration_seconds: z.number().positive().default(10),
      aspect_ratio: z.string().default("9:16"),
      language: z.string().optional(),
      narration: z.string().optional(),
      visual_style: z.string().optional(),
      audience: z.string().optional()
    }
  }, async (a) => {
    const approval = await getApproval(env, a.approval_id);

    if (!approval?.lanjutAt) {
      return textResult("Storyboard ditolak: OK dan LANJUT belum tercatat.", true);
    }

    const subject = a.character || a.brand_product || "subject specified in approved brief";
    const idea = a.scene_idea || a.concept;
    const productFacts = a.product_details || "Use only supplied product details.";

    const panels = [
      ["ESTABLISHING SHOT", "Wide shot", `Show ${subject} and establish the setting.`, "Slow push-in."],
      ["SUBJECT INTRODUCTION", "Medium hero shot", `Reveal ${subject}; preserve package identity.`, "Gentle lateral slide."],
      ["PRIMARY ACTION", "Medium close-up", `${subject} begins the main action.`, "Smooth motivated push-in."],
      ["DETAIL / RESPONSE", "Close-up", "Show the key expression or detail.", "Subtle rack focus."],
      ["VISUAL PEAK", "Hero close-up", "Complete the main action.", "Controlled short push-in."],
      ["END FRAME", "Composed end frame", "Finish on a clean hero composition.", "Stable final hold."]
    ];

    const panelSecs = a.scene_duration_seconds / 6;

    const output = panels.map((p, i) => {
      const from = (panelSecs * i).toFixed(1);
      const to = (panelSecs * (i + 1)).toFixed(1);

      return `PANEL ${i + 1} — ${p[0]}
Timing: ${from}-${to} seconds
Framing: ${p[1]}
Action: ${p[2]}
Camera: ${p[3]}`;
    });

    const gridPrompt =
      `Create ONE complete storyboard sheet, exact 2 columns by 3 rows, ` +
      `exactly SIX panels. STYLE: ${a.visual_style || a.style}. ` +
      `FORMAT: portrait ${a.aspect_ratio}. SUBJECT: ${subject}. ` +
      `PRODUCT FACTS: ${productFacts}. SCENE IDEA: ${idea}. ` +
      `Keep identity, proportions, colors, materials, labels, and lighting consistent. ` +
      `No extra panels, missing panels, fake logos, random lettering, or watermark.`;

    const spoken = a.narration && !/^(ya|yes)$/i.test(a.narration.trim())
      ? a.narration
      : `${subject}: "Hai! Senang berkenalan denganmu!"`;

    return textResult([
      `STORYBOARD — SCENE ${a.scene_number}`,
      `Konsep: ${a.concept}`,
      `Ide scene: ${idea}`,
      `Produk/karakter: ${subject}`,
      `Detail produk: ${productFacts}`,
      `Style: ${a.visual_style || a.style}`,
      `Durasi: ${a.scene_duration_seconds} detik`,
      `Rasio: ${a.aspect_ratio}`,
      "",
      "ENAM PANEL STORYBOARD (2 KOLOM × 3 BARIS)",
      ...output,
      "",
      "PROMPT GAMBAR STORYBOARD",
      "```text",
      gridPrompt,
      "```",
      "",
      "NARASI / DIALOG",
      spoken,
      "",
      "CONTINUITY LOCK",
      `Subject lock: ${subject}. Preserve identity, proportions, colors, material, label, and accessories.`,
      "Do not invent product specifications, benefits, logos, or claims."
    ].join("\n"));
  });

  // TOOL 5 — GENERATE ANIMATION PROMPTS
  server.registerTool("generate_animation_prompts", {
    description: "Membuat prompt gambar dan video setelah OK dan LANJUT.",
    inputSchema: {
      scene: z.string().min(1),
      approval_id: z.string().uuid(),
      style: z.string().default("Animasi Objek Bicara (Realistis)"),
      brand_product: z.string().optional(),
      product_details: z.string().optional(),
      character: z.string().optional(),
      aspect_ratio: z.string().default("9:16"),
      scene_number: z.number().int().positive().default(1),
      duration_seconds: z.number().positive().max(60).default(5),
      narration: z.string().optional(),
      language: z.string().optional(),
      camera_direction: z.string().optional(),
      continuity_notes: z.string().optional(),
      negative_prompt: z.string().optional()
    }
  }, async (a) => {
    const approval = await getApproval(env, a.approval_id);

    if (!approval?.lanjutAt) {
      return textResult("Prompt produksi ditolak: OK dan LANJUT belum tercatat.", true);
    }

    const duration = a.duration_seconds;
    const subject = a.brand_product || a.character || "karakter utama";
    const productFacts = a.product_details || "Gunakan hanya detail produk yang diberikan.";
    const continuity = a.continuity_notes ||
      `Keep the same ${subject} identity, proportions, colors, material, label, face, and accessories.`;

    const negative = a.negative_prompt ||
      "No identity drift, deformation, flicker, jitter, random text, fake logos, watermark, or unsupported claims.";

    const scene = a.scene;
    const lowerScene = scene.toLowerCase();

    let actionTimeline;

    if (/wave|melamba|menyapa|sapa/.test(lowerScene)) {
      actionTimeline = [
        `0-${(duration * 0.2).toFixed(1)}s: ${subject} faces the camera.`,
        `${(duration * 0.2).toFixed(1)}-${(duration * 0.55).toFixed(1)}s: character waves toward viewer.`,
        `${(duration * 0.55).toFixed(1)}-${(duration * 0.8).toFixed(1)}s: character smiles and finishes greeting.`,
        `${(duration * 0.8).toFixed(1)}-${duration}s: character holds a friendly hero pose.`
      ];
    } else {
      actionTimeline = [
        `0-${(duration * 0.2).toFixed(1)}s: establish ${subject}.`,
        `${(duration * 0.2).toFixed(1)}-${(duration * 0.55).toFixed(1)}s: perform action: ${scene}.`,
        `${(duration * 0.55).toFixed(1)}-${(duration * 0.8).toFixed(1)}s: show key reaction.`,
        `${(duration * 0.8).toFixed(1)}-${duration}s: resolve into final frame.`
      ];
    }

    const narrationInput = (a.narration || "").trim();
    const narrationDisabled = /^(tidak|no|false|off)$/i.test(narrationInput);

    const narrationText = narrationDisabled
      ? "Narasi tidak digunakan."
      : (!narrationInput || /^(ya|yes|true|on)$/i.test(narrationInput)
        ? "Hai! Senang berkenalan denganmu!"
        : narrationInput);

    const language = a.language || "Bahasa Indonesia";

    const narrationSection = narrationDisabled
      ? "Tidak ada narasi atau dialog."
      : `Dialog (${language}): “${narrationText}”`;

    const camera = a.camera_direction ||
      "Begin with a medium full-package shot, then use a gentle push-in and finish on a stable hero frame.";

    const imagePrompt =
      `STORY CONCEPT: ${scene}\n` +
      `SUBJECT: ${subject}\n` +
      `PRODUCT DETAILS: ${productFacts}\n` +
      `CONTINUITY LOCK: ${continuity}\n` +
      `VISUAL COMPOSITION: portrait ${a.aspect_ratio}\n` +
      `STYLE: ${a.style}\n` +
      `NEGATIVE CONSTRAINTS: ${negative}`;

    const videoPrompt =
      `Animate ${subject} in ${a.style}, portrait ${a.aspect_ratio}, ` +
      `total duration ${duration} seconds.\n` +
      `SCENE: ${scene}\n` +
      `CAMERA: ${camera}\n` +
      `TIMED ACTION:\n${actionTimeline.join("\n")}\n` +
      `DIALOGUE: ${narrationSection}\n` +
      `CONTINUITY LOCK: ${continuity}\n` +
      `NEGATIVE CONSTRAINTS: ${negative}`;

    return textResult([
      "WOWSERU AI ANIMASI — PRODUCTION PROMPTS",
      `Scene ${a.scene_number}: ${scene}`,
      `Style: ${a.style}`,
      `Subject: ${subject}`,
      `Product details: ${productFacts}`,
      `Aspect ratio: ${a.aspect_ratio}`,
      `Duration: ${duration}s`,
      "",
      "IMAGE PROMPT",
      "```text",
      imagePrompt,
      "```",
      "",
      "VIDEO PROMPT",
      "```text",
      videoPrompt,
      "```",
      "",
      "TIMING BREAKDOWN",
      ...actionTimeline,
      "",
      "NARASI / DIALOG",
      narrationSection,
      "",
      "CONTINUITY CHECKLIST",
      `- Subject: ${subject}`,
      `- Product details: ${productFacts}`,
      `- Visual lock: ${continuity}`,
      `- Negative constraints: ${negative}`,
      "Catatan: tool ini menghasilkan prompt tekstual, bukan file video final."
    ].join("\n"));
  });

  return server;
}

// CLOUDFLARE WORKER
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // OPENAI DOMAIN VERIFICATION
    if (url.pathname === "/.well-known/openai-apps-challenge") {
      return new Response(
        "q4FbcLArSVUC8WdBWFhGUs-8yaOlK51J4pRMIpXWBTo",
        {
          status: 200,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store"
          }
        }
      );
    }

    if (url.pathname === "/") {
      return Response.json({
        service: "wowseru-ai-animasi-mcp",
        version: "0.5.6",
        status: "ready",
        endpoint: "/mcp",
        tools: 5,
        approval_storage: "durable-object"
      });
    }

    if (url.pathname === "/health") {
      return Response.json({
        service: "wowseru-ai-animasi-mcp",
        version: "0.5.6",
        status: "ok",
        skill_loaded: true,
        mcp_endpoint: "/mcp",
        tools: 5,
        approval_storage: "durable-object"
      });
    }

    if (url.pathname === "/mcp") {
      const handler = createMcpHandler(
        () => makeServer(env),
        {
          onerror: (error) => console.error("MCP ERROR:", error)
        }
      );

      return handler(request, env, ctx);
    }

    return new Response("Not Found", { status: 404 });
  }
};

// DURABLE OBJECT — APPROVAL STORAGE
export class ApprovalStore {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const body = await request.json();

    if (url.pathname === "/set") {
      const { approval_id, state } = body;

      if (!approval_id || !state?.brief || !state?.approvedAt) {
        return Response.json(
          { error: "Invalid approval record" },
          { status: 400 }
        );
      }

      await this.ctx.storage.put(`approval:${approval_id}`, state);
      return Response.json({ ok: true });
    }

    if (url.pathname === "/get") {
      const { approval_id } = body;

      if (!approval_id) {
        return Response.json(
          { error: "Missing approval_id" },
          { status: 400 }
        );
      }

      const state = await this.ctx.storage.get(`approval:${approval_id}`);

      if (!state) {
        return Response.json({ error: "Not found" }, { status: 404 });
      }

      if (Date.now() - state.approvedAt > APPROVAL_TTL_MS) {
        await this.ctx.storage.delete(`approval:${approval_id}`);
        return Response.json({ error: "Expired" }, { status: 404 });
      }

      return Response.json(state);
    }

    if (url.pathname === "/lanjut") {
      const { approval_id } = body;

      if (!approval_id) {
        return Response.json(
          { error: "Missing approval_id" },
          { status: 400 }
        );
      }

      const key = `approval:${approval_id}`;
      const state = await this.ctx.storage.get(key);

      if (!state || Date.now() - state.approvedAt > APPROVAL_TTL_MS) {
        if (state) await this.ctx.storage.delete(key);
        return Response.json(
          { error: "Not found or expired" },
          { status: 404 }
        );
      }

      state.lanjutAt = Date.now();
      await this.ctx.storage.put(key, state);
      return Response.json(state);
    }

    return new Response("Not Found", { status: 404 });
  }
}
