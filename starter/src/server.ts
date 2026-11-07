import Fastify from "fastify";
import cors from "@fastify/cors";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

const app = Fastify({ logger: true });
const currentDir = dirname(fileURLToPath(import.meta.url));
const skillPath = resolve(currentDir, "../skills/wowseru-ai-animasi/SKILL.md");
const skillInstructions = await readFile(skillPath, "utf8");

type ApprovalState = { brief: string; approvedAt: number; lanjutAt?: number };
// Development-only state: shared across requests in this process, cleared on restart.
// Replace with persistent storage and authenticated user/session binding before public deployment.
const approvalStates = new Map<string, ApprovalState>();
const APPROVAL_TTL_MS = 2 * 60 * 60 * 1000;
function getApproval(approvalId: string): ApprovalState | undefined {
  const state = approvalStates.get(approvalId);
  if (!state) return undefined;
  if (Date.now() - state.approvedAt > APPROVAL_TTL_MS) { approvalStates.delete(approvalId); return undefined; }
  return state;
}
await app.register(cors, { origin: true, methods: ["GET", "POST", "DELETE", "OPTIONS"] });

function makeMcpServer() {
  const server = new McpServer(
    { name: "wowseru-ai-animasi", version: "0.3.2" },
    { instructions: skillInstructions }
  );

  server.registerTool(
    "confirm_animation_brief",
    {
      description: "Catat persetujuan brief terbaru setelah pengguna secara eksplisit membalas OK. Menghasilkan approval_id untuk tahap LANJUT.",
      inputSchema: {
        brief: z.string().min(1),
        confirmation_text: z.literal("OK").describe("Harus persis OK, setelah pengguna menyetujui ringkasan brief terbaru."),
      },
    },
    async ({ brief, confirmation_text }) => {
      if (confirmation_text !== "OK") {
        return { content: [{ type: "text" as const, text: "Persetujuan belum tercatat. Tampilkan brief lengkap dan tunggu pengguna membalas OK." }], isError: true };
      }
      const approval_id = randomUUID();
      approvalStates.set(approval_id, { brief, approvedAt: Date.now() });
      return { content: [{ type: "text" as const, text: `Brief disetujui dan dicatat. approval_id: ${approval_id}. Belum boleh produksi; tunggu pengguna mengetik LANJUT, lalu panggil confirm_animation_lanjut dengan approval_id ini.` }] };
    }
  );

  server.registerTool(
    "confirm_animation_lanjut",
    {
      description: "Catat instruksi LANJUT setelah brief yang sama telah disetujui dengan OK.",
      inputSchema: {
        approval_id: z.string().uuid(),
        confirmation_text: z.literal("LANJUT").describe("Harus persis LANJUT setelah persetujuan OK untuk brief yang sama."),
      },
    },
    async ({ approval_id, confirmation_text }) => {
      const state = getApproval(approval_id);
      if (!state || confirmation_text !== "LANJUT") {
        return { content: [{ type: "text" as const, text: "LANJUT belum diterima untuk approval_id yang valid. Pastikan brief sudah disetujui dengan OK dan gunakan approval_id yang masih berlaku." }], isError: true };
      }
      state.lanjutAt = Date.now();
      return { content: [{ type: "text" as const, text: `LANJUT tercatat untuk brief yang disetujui. approval_id: ${approval_id}. Tool produksi sekarang dapat dipanggil untuk brief ini.` }] };
    }
  );

  server.registerTool(
    "create_animation_concept",
    {
      description: "Menyusun konsep animasi WOWSERU berdasarkan brief yang sudah disetujui pengguna. Hanya panggil setelah brief dikonfirmasi dengan OK dan pengguna mengetik LANJUT.",
      inputSchema: {
        brief: z.string().min(1),
        approval_id: z.string().uuid().describe("ID yang diterbitkan server setelah tahap OK dan LANJUT selesai."),
        brand_product: z.string().optional(),
        product_details: z.string().optional(),
        style: z.string().default("3D cartoon"),
        audience: z.string().optional(),
        resolution: z.string().default("Vertical 9:16"),
        duration_seconds: z.number().int().positive().max(300).default(30),
        scene_count: z.number().int().min(1).max(12).default(3),
        language: z.string().default("Bahasa Indonesia"),
        narration: z.string().optional(),
      },
    },
    async (a) => {
      const approval = getApproval(a.approval_id);
      if (!approval || !approval.lanjutAt) {
        return { content: [{ type: "text" as const, text: "Produksi ditolak oleh server: tahap OK dan LANJUT belum tercatat untuk approval_id ini." }], isError: true };
      }
      if (a.brief.trim() !== approval.brief.trim()) {
        return { content: [{ type: "text" as const, text: "Produksi ditolak: brief tidak sama dengan brief yang disetujui. Minta persetujuan ulang untuk brief terbaru." }], isError: true };
      }
      const base = Math.floor(a.duration_seconds / a.scene_count);
      const remainder = a.duration_seconds % a.scene_count;
      const sceneNames = ["HOOK / PEMBUKA", "KONFLIK / PESAN", "PENUTUP / CTA"];
      const scenes = Array.from({ length: a.scene_count }, (_, i) => {
        const seconds = base + (i < remainder ? 1 : 0);
        const start = i * base + Math.min(i, remainder);
        const end = start + seconds;
        const phase = i === 0 ? "Introduce the visual hook and establish the subject clearly" : i === a.scene_count - 1 ? "Resolve the story and end with a clean memorable final frame" : "Develop the main action while preserving visual continuity";
        return `${i + 1}. ${sceneNames[i] ?? "ADEGAN LANJUTAN"}\nTiming: ${start}-${end} seconds (${seconds} seconds)\nTujuan: ${phase}.\nAksi visual: ${a.brief}.\nArahan kamera: deliberate cinematic framing, readable subject, smooth motivated movement.\nContinuity lock: keep product/character identity, silhouette, colors, proportions, accessories, environment direction, and lighting consistent.\nNarasi: ${a.narration ?? "Tulis narasi sesuai bahasa dan tujuan brief; jangan menambahkan klaim yang tidak diberikan."}`;
      });
      const thumbnailPrompt = `Create a polished ${a.style} key visual for a ${a.resolution} AI animation. Subject/brand: ${a.brand_product ?? "the subject specified in the approved brief"}. Brief: ${a.brief}. Audience: ${a.audience ?? "general audience"}. Strong readable focal point, cinematic composition, controlled lighting, clean background, realistic material detail appropriate to the style, no tiny generated text, no watermark, no invented logo or unsupported product claim. Aspect ratio ${a.resolution.includes("9:16") ? "9:16" : a.resolution}.`;
      const text = [
        "KONSEP ANIMASI WOWSERU AI",
        `Produk / brand: ${a.brand_product ?? "Belum ditentukan"}`,
        `Brief yang disetujui: ${a.brief}`,
        `Detail produk / USP: ${a.product_details ?? "Belum diberikan; jangan mengarang klaim produk."}`,
        `Target audiens: ${a.audience ?? "Umum"}`,
        `Gaya visual: ${a.style}`,
        `Durasi total: ${a.duration_seconds} detik`,
        `Format: ${a.resolution}`,
        `Jumlah scene: ${a.scene_count}`,
        `Bahasa narasi: ${a.language}`,
        "", "KONSEP UTAMA DAN HOOK",
        `Hook: Buka dengan visual paling jelas dan menarik yang relevan dengan brief: ${a.brief}. Hindari klaim yang tidak didukung data produk.`,
        "Pesan utama: Pertahankan satu ide utama sepanjang video dan pastikan setiap scene berkontribusi pada pesan tersebut.",
        "", "PROMPT THUMBNAIL (ENGLISH — READY TO COPY)", thumbnailPrompt,
        "", "RANGKAIAN SCENE", ...scenes, "",
        "CONTINUITY CHECKLIST",
        "- Pertahankan bentuk, warna, proporsi, kemasan, label, logo, aksesori, dan detail produk yang diberikan.",
        "- Jaga konsistensi karakter, arah gerak, posisi objek, pencahayaan, lokasi, dan orientasi kamera antar-scene.",
        "- Jangan mengarang USP, bahan, harga, testimoni, garansi, promo, atau tautan pembelian.",
        "- Hindari teks acak, watermark, logo palsu, flicker, anatomi rusak, dan perubahan objek yang tidak diminta.",
        "", `Narasi: ${a.narration ?? "Tulis sesuai bahasa yang diminta dan detail brief; jika belum tersedia, tandai sebagai perlu disusun."}`,
        "Catatan: ini konsep dan prompt tekstual, bukan video hasil render."
      ].join("\n");
      return { content: [{ type: "text" as const, text }] };
    }
  );

  server.registerTool(
    "create_storyboard",
    {
      description: "Membuat storyboard enam panel untuk satu scene setelah brief disetujui dengan OK dan pengguna mengetik LANJUT.",
      inputSchema: {
        concept: z.string().min(1),
        approval_id: z.string().uuid().describe("ID yang diterbitkan server setelah tahap OK dan LANJUT selesai."),
        style: z.string().default("3D cartoon"),
        character: z.string().optional(),
        scene_number: z.number().int().positive().default(1),
        scene_duration_seconds: z.number().positive().default(10),
        aspect_ratio: z.string().default("9:16"),
        narration: z.string().optional(),
      },
    },
    async (a) => {
      const approval = getApproval(a.approval_id);
      if (!approval || !approval.lanjutAt) {
        return { content: [{ type: "text" as const, text: "Storyboard ditolak oleh server: tahap OK dan LANJUT belum tercatat untuk approval_id ini." }], isError: true };
      }
      const subjectName = a.character ?? "the main subject described in the approved brief";
      const panelData = [
        { label: "ESTABLISHING SHOT", framing: "Wide establishing shot", action: `Show the environment and place ${subjectName} clearly within it; establish the light direction and key props from the concept`, camera: "Slow push-in from a stable wide frame; keep the horizon level", transition: "Begin with a clean cut or gentle fade from black" },
        { label: "SUBJECT INTRODUCTION", framing: "Medium hero shot", action: `Reveal the defining visible silhouette, material, color, and shape of ${subjectName}; only show details supported by the brief`, camera: "Gentle lateral slide; keep the whole subject readable", transition: "Match the movement direction from panel 1" },
        { label: "PRIMARY ACTION", framing: "Medium close-up", action: `Show one clear, physically plausible action that develops this concept: ${a.concept}; keep the subject and its contact with nearby objects visible`, camera: "Smooth motivated tracking movement following the action", transition: "Cut on action for a natural sense of momentum" },
        { label: "DETAIL / RESPONSE", framing: "Close-up detail shot", action: "Show a relevant visible detail or the consequence of the primary action; do not invent labels, specifications, facial reactions, or product features", camera: "Subtle rack focus from the action point to the relevant detail", transition: "Use a motivated detail cut; preserve object position" },
        { label: "VISUAL PEAK", framing: "Hero close-up", action: "Deliver the most memorable visual beat that follows logically from the primary action, with a clean silhouette and no unsupported claims", camera: "Controlled short push-in, then hold long enough to read the image", transition: "Build to the strongest composition without changing subject design" },
        { label: "END FRAME / TRANSITION", framing: "Composed end frame", action: "Resolve the action and hold a clean final composition that can connect to the next scene or leave room for editing text", camera: "Ease to a stable hold; no sudden zoom or unmotivated camera move", transition: "End on a stable frame suitable for a match cut or fade" },
      ];
      const panelSeconds = a.scene_duration_seconds / 6;
      const panels = panelData.map((p, i) => {
        const from = (panelSeconds * i).toFixed(1);
        const to = (panelSeconds * (i + 1)).toFixed(1);
        const prompt = `Create storyboard panel ${i + 1} of 6 for a ${a.style} animation, aspect ratio ${a.aspect_ratio}. SCENE CONCEPT: ${a.concept}. SUBJECT LOCK: ${subjectName}. SHOT SIZE: ${p.framing}. SPECIFIC VISUAL ACTION: ${p.action}. CAMERA: ${p.camera}. TRANSITION INTENT: ${p.transition}. ART DIRECTION: cinematic, readable focal hierarchy, physically plausible materials and contact, intentional lighting, coherent perspective. CONTINUITY: preserve the exact same subject silhouette, colors, proportions, material, accessories, labels that were explicitly supplied, environment layout, lighting direction, and screen direction as the other five panels. Do not add unsupported product specifications, fake logos, random lettering, watermark, extra parts, or unexplained object changes.`;
        return `PANEL ${i + 1} - ${p.label}\nTiming: ${from}-${to} seconds\nTujuan visual: ${p.action}.\nFraming: ${p.framing}.\nArahan kamera: ${p.camera}.\nTransisi: ${p.transition}.\nPrompt gambar (English, ready to copy):\n${prompt}`;
      });
      return { content: [{ type: "text" as const, text: [
        `STORYBOARD - SCENE ${a.scene_number}`,
        `Konsep: ${a.concept}`, `Style: ${a.style}`,
        `Karakter / objek: ${a.character ?? "Sesuai konsep"}`,
        `Durasi scene: ${a.scene_duration_seconds} detik`,
        `Rasio: ${a.aspect_ratio}`, `Narasi: ${a.narration ?? "Sesuaikan dengan cerita dan bahasa yang diminta."}`,
        "", "GRID STORYBOARD 2 x 3 - ENAM PANEL BERURUTAN", ...panels,
        "", "CONTINUITY LOCK",
        `Subject lock: ${subjectName}.`,
        "Keep silhouette, colors, proportions, materials, labels explicitly supplied by the user, accessories, lighting direction, environment layout, and screen direction consistent across all panels.",
        "Do not add unsupported product claims, random text, fake logos, watermarks, flicker, deformation, extra/missing parts, or unexplained object changes.",
        "", "NARASI DAN SUARA",
        `Narasi: ${a.narration ?? "Belum diberikan. Susun voice-over hanya setelah bahasa, pesan, dan fakta yang boleh disampaikan dikonfirmasi."}`,
        "Sound design: choose restrained ambience and one subtle action sound only when justified by the visible action; do not imply product performance claims.",
        "", "CATATAN PRODUKSI",
        "Output ini adalah enam prompt panel tekstual, bukan gambar storyboard yang sudah dirender. Generate keenam panel dengan subject reference yang sama, lalu susun dalam grid 2 x 3.",
        "Gunakan font dan overlay teks pada tahap editing, bukan di dalam generator gambar, untuk menghindari teks acak."
      ].join("\n") }], };
    }
  );

  server.registerTool(
    "generate_animation_prompts",
    {
      description: "Membuat prompt gambar dan video berbahasa Inggris dengan timing, continuity lock, karakter/produk konsisten, dan negative constraints. Hanya setelah OK dan LANJUT.",
      inputSchema: {
        scene: z.string().min(1),
        approval_id: z.string().uuid().describe("ID yang diterbitkan server setelah tahap OK dan LANJUT selesai."),
        style: z.string().default("3D cartoon cinematic"),
        character: z.string().optional(),
        aspect_ratio: z.string().default("9:16"),
        duration_seconds: z.number().positive().max(60).default(5),
        camera_direction: z.string().optional(),
        continuity_notes: z.string().optional(),
        negative_prompt: z.string().optional(),
      },
    },
    async (a) => {
      const approval = getApproval(a.approval_id);
      if (!approval || !approval.lanjutAt) {
        return { content: [{ type: "text" as const, text: "Prompt produksi ditolak oleh server: tahap OK dan LANJUT belum tercatat untuk approval_id ini." }], isError: true };
      }
      const duration = a.duration_seconds;
      const t1 = Math.max(0.5, duration * 0.25);
      const t2 = Math.max(t1 + 0.1, duration * 0.55);
      const t3 = Math.max(t2 + 0.1, duration * 0.8);
      const timeline = [
        `0.0-${t1.toFixed(1)}s: Establish the subject and environment; begin with a readable composition.`,
        `${t1.toFixed(1)}-${t2.toFixed(1)}s: Execute the primary action smoothly; preserve realistic weight and object contact.`,
        `${t2.toFixed(1)}-${t3.toFixed(1)}s: Move into the key detail or emotional beat; maintain the same subject identity.`,
        `${t3.toFixed(1)}-${duration.toFixed(1)}s: Settle into a clean hero frame that can transition to the next scene.`,
      ];
      const subject = a.character ?? "the main subject described in the scene";
      const continuity = a.continuity_notes ?? "Keep subject identity, silhouette, colors, proportions, labels, accessories, lighting direction, and spatial position consistent across frames and scenes.";
      const negative = a.negative_prompt ?? "No identity drift, product deformation, changing colors or labels, extra/missing parts, flicker, jitter, broken anatomy, random text, fake logos, watermark, unexplained object appearance/disappearance, or unsupported claims.";
      const imagePrompt = `STORY CONCEPT: ${a.scene}\nCONTINUITY LOCK: ${continuity}\nCONSISTENT TALENT / CHARACTER: ${subject}; preserve the same identity, silhouette, proportions, colors, materials, and accessories.\nPRODUCT / OBJECT CONSISTENCY: show only product details supplied in the brief; do not invent specifications, labels, logos, or claims.\nVISUAL CONTINUITY: ${a.camera_direction ?? "Use a clean, deliberate cinematic composition and a motivated camera angle."} Keep lighting direction, background geography, screen direction, and object placement coherent.\nSTYLE: ${a.style}; portrait ${a.aspect_ratio}; polished composition, clear focal point, physically plausible materials and lighting.\nIMPORTANT / NEGATIVE CONSTRAINTS: ${negative}. No tiny generated text; add typography during editing if needed.`;
      const videoPrompt = `Animate the following scene in ${a.style}, portrait ${a.aspect_ratio}, total duration ${duration} seconds.\nSCENE: ${a.scene}\nSUBJECT LOCK: ${subject}. Keep identity and all defining visual features unchanged.\nCONTINUITY LOCK: ${continuity}\nCAMERA DIRECTION: ${a.camera_direction ?? "Smooth motivated dolly-in with stable horizon and controlled focus; no abrupt unmotivated camera changes."}\nTIMED ACTION: ${timeline.join(" ")}\nMOTION QUALITY: coherent acceleration and deceleration, natural contact and weight, no sudden teleporting or frame-to-frame shape changes.\nIMPORTANT / NEGATIVE CONSTRAINTS: ${negative}.`;
      return { content: [{ type: "text" as const, text: [
        "WOWSERU AI ANIMASI - PRODUCTION PROMPTS",
        `Scene: ${a.scene}`, `Style: ${a.style}`, `Character / subject: ${subject}`,
        `Aspect ratio: ${a.aspect_ratio}`, `Duration: ${duration} seconds`,
        "", "IMAGE PROMPT (ENGLISH - READY TO COPY)", imagePrompt,
        "", "VIDEO PROMPT (ENGLISH - READY TO COPY)", videoPrompt,
        "", "TIMING BREAKDOWN", ...timeline,
        "", "CONTINUITY CHECKLIST",
        `- Subject: ${subject}.`, `- Product / visual lock: ${continuity}.`,
        "- Preserve the same palette, proportions, accessories, background direction, and lighting continuity.",
        `- Negative constraints: ${negative}`,
        "", "Catatan: tool ini menghasilkan prompt tekstual, bukan file gambar atau video final. Gunakan prompt pada generator media yang sesuai."
      ].join("\n") }], };
    }
  );

  return server;
}

app.get("/health", async () => ({
  service: "wowseru-ai",
  status: "ok",
  version: "0.3.2",
  skill_loaded: true,
  mcp_endpoint: "/mcp",
}));

// Sessionless Streamable HTTP: create a fresh MCP server/transport per request.
// This is a starter implementation; validate against the deployed MCP client before production.
app.post("/mcp", async (request, reply) => {
  const body = request.body;
  const sessionId = request.headers["mcp-session-id"];
  if (sessionId) {
    return reply.code(400).send({
      jsonrpc: "2.0",
      error: { code: -32000, message: "This endpoint is configured for sessionless MCP." },
      id: null,
    });
  }

  if (body && typeof body === "object" && "method" in body &&
      (body as { method?: unknown }).method === "initialize" &&
      !isInitializeRequest(body)) {
    return reply.code(400).send({
      jsonrpc: "2.0",
      error: { code: -32600, message: "Invalid initialize request." },
      id: null,
    });
  }

  const mcpServer = makeMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  reply.hijack();
  try {
    await mcpServer.connect(transport);
    await transport.handleRequest(request.raw, reply.raw, body);
  } catch (error) {
    request.log.error({ err: error }, "MCP request failed");
    if (!reply.raw.headersSent) {
      reply.raw.writeHead(500, { "content-type": "application/json" });
      reply.raw.end(JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      }));
    } else if (!reply.raw.writableEnded) {
      reply.raw.end();
    }
  } finally {
    await transport.close().catch(() => undefined);
    await mcpServer.close().catch(() => undefined);
  }
});

app.get("/mcp", async (_request, reply) => {
  return reply.code(405).header("allow", "POST").send("Method Not Allowed");
});

app.delete("/mcp", async (_request, reply) => {
  return reply.code(405).header("allow", "POST").send("Method Not Allowed");
});

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";
await app.listen({ port, host });
