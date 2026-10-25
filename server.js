
import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

function createServer() {
  const server = new McpServer({
    name: "wowseru-ai-animasi",
    version: "1.0.0",
  });

  server.registerTool(
    "create_animation_concept",
    {
      description: "Menyusun konsep animasi WOWSERU dari brief lengkap.",
      inputSchema: {
        brief: z.string(),
        brand_product: z.string().optional(),
        product_details: z.string().optional(),
        style: z.string().optional(),
        visual_style: z.string().optional(),
        audience: z.string().optional(),
        resolution: z.string().optional(),
        duration_seconds: z.number().optional(),
        scene_count: z.number().int().optional(),
        narration: z.string().optional(),
        character_mode: z.string().optional(),
        language: z.string().optional(),
        mode: z.enum(["Normal", "Deep Research"]).optional(),
        scene_ideas: z.array(z.string()).optional(),
        product_link: z.string().optional(),
      },
    },
    async (a) => {
      const duration = a.duration_seconds ?? 30;
      const count = Math.max(1, Math.min(a.scene_count ?? 3, 12));
      const scenes = Array.from({ length: count }, (_, i) =>
        `${i + 1}. ${["HOOK", "KONFLIK / PESAN", "PENUTUP & CTA"][i] || "ADEGAN"}\n` +
        `Durasi: ${Math.round(duration / count)} detik\n` +
        `Ide: ${a.scene_ideas?.[i] || a.brief}`
      );

      return {
        content: [{
          type: "text",
          text: [
            "KONSEP ANIMASI WOWSERU",
            `Produk/Brand: ${a.brand_product || "Belum ditentukan"}`,
            `Brief: ${a.brief}`,
            `Detail produk: ${a.product_details || "-"}`,
            `Style: ${a.style || "3D cartoon"}`,
            `Visual: ${a.visual_style || "-"}`,
            `Audiens: ${a.audience || "Umum"}`,
            `Durasi: ${duration} detik`,
            `Format: ${a.resolution || "TikTok Vertical 9:16"}`,
            `Bahasa: ${a.language || "Bahasa Indonesia"}`,
            `Mode: ${a.mode || "Normal"}`,
            "",
            "RANGKAIAN ADEGAN",
            ...scenes,
            "",
            `Narasi: ${a.narration || "Sesuaikan dengan cerita dan audiens."}`,
            `Karakter: ${a.character_mode || "Tentukan sesuai brief."}`,
            `Tautan produk: ${a.product_link || "-"}`,
            "",
            "Catatan: ini konsep tekstual, bukan video hasil render.",
          ].join("\n"),
        }],
      };
    }
  );

  server.registerTool(
    "create_storyboard",
    {
      description: "Membuat storyboard enam panel untuk satu scene.",
      inputSchema: {
        concept: z.string(),
        style: z.string().optional(),
        character: z.string().optional(),
        scene_number: z.number().int().optional(),
        scene_duration_seconds: z.number().optional(),
        aspect_ratio: z.string().optional(),
        language: z.string().optional(),
        narration: z.string().optional(),
      },
    },
    async (a) => ({
      content: [{
        type: "text",
        text: [
          `STORYBOARD — SCENE ${a.scene_number ?? 1}`,
          `Konsep: ${a.concept}`,
          `Style: ${a.style || "3D cartoon"}`,
          `Karakter: ${a.character || "Sesuai konsep"}`,
          `Durasi scene: ${a.scene_duration_seconds ?? 10} detik`,
          `Rasio: ${a.aspect_ratio || "9:16"}`,
          "",
          ...[
            "Establishing shot dan lokasi",
            "Karakter diperkenalkan",
            "Aksi utama dimulai",
            "Reaksi atau perubahan emosi",
            "Puncak adegan",
            "Transisi ke adegan berikutnya",
          ].map((s, i) => `Panel ${i + 1}: ${s}`),
          `Narasi: ${a.narration || "Tambahkan narasi sesuai adegan."}`,
          `Bahasa: ${a.language || "Bahasa Indonesia"}`,
        ].join("\n"),
      }],
    })
  );

  server.registerTool(
    "generate_animation_prompts",
    {
      description: "Membuat prompt gambar dan video dengan arahan kamera dan kontinuitas.",
      inputSchema: {
        scene: z.string(),
        style: z.string().optional(),
        character: z.string().optional(),
        aspect_ratio: z.string().optional(),
        scene_number: z.number().int().optional(),
        duration_seconds: z.number().optional(),
        narration: z.string().optional(),
        language: z.string().optional(),
        camera_direction: z.string().optional(),
        continuity_notes: z.string().optional(),
        negative_prompt: z.string().optional(),
      },
    },
    async (a) => ({
      content: [{
        type: "text",
        text: [
          "PROMPT ANIMASI",
          `Scene: ${a.scene}`,
          `Style: ${a.style || "3D cartoon cinematic"}`,
          `Karakter: ${a.character || "Sesuai deskripsi scene"}`,
          `Rasio: ${a.aspect_ratio || "9:16"}`,
          `Durasi: ${a.duration_seconds ?? 5} detik`,
          "",
          "IMAGE PROMPT:",
          `Create a detailed ${a.style || "3D cartoon"} frame: ${a.scene}. ` +
          `Character: ${a.character || "consistent character design"}. ` +
          `Aspect ratio ${a.aspect_ratio || "9:16"}.`,
          "",
          "VIDEO PROMPT:",
          `Animate this scene: ${a.scene}. ` +
          `Camera: ${a.camera_direction || "smooth cinematic camera movement"}. ` +
          `Duration ${a.duration_seconds ?? 5} seconds.`,
          "",
          `Narasi: ${a.narration || "-"}`,
          `Kontinuitas: ${a.continuity_notes || "Pertahankan karakter, warna, dan properti antar-scene."}`,
          `Negative prompt: ${a.negative_prompt || "flicker, distorted anatomy, inconsistent character, blurry image"}`,
          `Bahasa: ${a.language || "Bahasa Indonesia"}`,
          "",
          "Catatan: gunakan prompt pada generator gambar/video untuk menghasilkan media.",
        ].join("\n"),
      }],
    })
  );

  return server;
}

const mcpHandler = createMcpHandler(createServer, {
  onerror: (error) => console.error("MCP ERROR:", error),
});

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return Response.json({
        service: "wowseru-ai-animasi",
        version: "1.0.0",
        status: "ready",
        endpoint: "/mcp",
      });
    }

    if (url.pathname === "/mcp") {
      return mcpHandler(request, env, ctx);
    }

    return new Response("Not Found", { status: 404 });
  },
};
