
import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

function createServer() {
  const server = new McpServer({
    name: "wowseru-ai-animasi",
    version: "1.0.0"
  });

  server.tool(
    "create_animation_concept",
    "Menyusun konsep animasi WOWSERU dari brief lengkap.",
    {
      brief: z.string(),
      brand_product: z.string().optional(),
      product_details: z.string().optional(),
      style: z.string().optional(),
      visual_style: z.string().optional(),
      audience: z.string().optional(),
      resolution: z.string().default("TikTok Vertical 9:16"),
      duration_seconds: z.number().default(30),
      scene_count: z.number().int().default(3),
      narration: z.string().optional(),
      character_mode: z.string().optional(),
      language: z.string().default("Bahasa Indonesia"),
      mode: z.enum(["Normal", "Deep Research"]).default("Normal"),
      scene_ideas: z.array(z.string()).optional(),
      product_link: z.string().optional()
    },
    async (args) => {
      const scenes = Array.from(
        { length: args.scene_count },
        (_, i) => {
          const labels = ["HOOK", "KONFLIK / PESAN", "PENUTUP & CTA"];
          return `${i + 1}. ${labels[i] || "ADEGAN"}\n` +
            `Durasi: ${Math.round(args.duration_seconds / args.scene_count)} detik\n` +
            `Ide: ${args.scene_ideas?.[i] || args.brief}`;
        }
      );

      return {
        content: [{
          type: "text",
          text: [
            "KONSEP ANIMASI WOWSERU",
            `Produk/Brand: ${args.brand_product || "Belum ditentukan"}`,
            `Brief: ${args.brief}`,
            `Detail produk: ${args.product_details || "-"}`,
            `Style: ${args.style || "3D cartoon"}`,
            `Visual: ${args.visual_style || "-"}`,
            `Audiens: ${args.audience || "Umum"}`,
            `Durasi: ${args.duration_seconds} detik`,
            `Format: ${args.resolution}`,
            `Bahasa: ${args.language}`,
            `Mode: ${args.mode}`,
            "",
            "RANGKAIAN ADEGAN",
            ...scenes,
            "",
            `Narasi: ${args.narration || "Sesuaikan dengan cerita dan audiens."}`,
            `Karakter: ${args.character_mode || "Tentukan sesuai brief."}`,
            `Tautan produk: ${args.product_link || "-"}`,
            "",
            "Catatan: ini konsep tekstual awal, bukan video hasil render."
          ].join("\n")
        }]
      };
    }
  );

  server.tool(
    "create_storyboard",
    "Membuat storyboard enam panel untuk satu scene.",
    {
      concept: z.string(),
      style: z.string().optional(),
      character: z.string().optional(),
      scene_number: z.number().int().optional(),
      scene_duration_seconds: z.number().optional(),
      aspect_ratio: z.string().optional(),
      language: z.string().optional(),
      narration: z.string().optional()
    },
    async (args) => ({
      content: [{
        type: "text",
        text: [
          `STORYBOARD — SCENE ${args.scene_number || 1}`,
          `Konsep: ${args.concept}`,
          `Style: ${args.style || "3D cartoon"}`,
          `Karakter: ${args.character || "Sesuai konsep"}`,
          `Durasi scene: ${args.scene_duration_seconds || 10} detik`,
          `Rasio: ${args.aspect_ratio || "9:16"}`,
          "",
          ...Array.from({ length: 6 }, (_, i) =>
            `Panel ${i + 1}: ${[
              "Establishing shot dan lokasi",
              "Karakter diperkenalkan",
              "Aksi utama dimulai",
              "Reaksi atau perubahan emosi",
              "Puncak adegan",
              "Transisi ke adegan berikutnya"
            ][i]}`
          ),
          `Narasi: ${args.narration || "Tambahkan narasi sesuai adegan."}`,
          `Bahasa: ${args.language || "Bahasa Indonesia"}`
        ].join("\n")
      }]
    })
  );

  server.tool(
    "generate_animation_prompts",
    "Membuat prompt gambar dan video beserta arahan kamera dan kontinuitas.",
    {
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
      negative_prompt: z.string().optional()
    },
    async (args) => ({
      content: [{
        type: "text",
        text: [
          "PROMPT ANIMASI",
          `Scene: ${args.scene}`,
          `Style: ${args.style || "3D cartoon cinematic"}`,
          `Karakter: ${args.character || "Sesuai deskripsi scene"}`,
          `Rasio: ${args.aspect_ratio || "9:16"}`,
          `Durasi: ${args.duration_seconds || 5} detik`,
          "",
          "IMAGE PROMPT:",
          `Create a detailed ${args.style || "3D cartoon"} frame: ${args.scene}. ` +
            `Character: ${args.character || "consistent character design"}. ` +
            `Aspect ratio ${args.aspect_ratio || "9:16"}.`,
          "",
          "VIDEO PROMPT:",
          `Animate this scene: ${args.scene}. ` +
            `Camera: ${args.camera_direction || "smooth cinematic camera movement"}. ` +
            `Duration ${args.duration_seconds || 5} seconds.`,
          "",
          `Narasi: ${args.narration || "-"}`,
          `Kontinuitas: ${args.continuity_notes || "Pertahankan karakter, warna, dan properti antar-scene."}`,
          `Negative prompt: ${args.negative_prompt || "flicker, distorted anatomy, inconsistent character, blurry image"}`,
          `Bahasa: ${args.language || "Bahasa Indonesia"}`,
          "",
          "Catatan: prompt ini perlu digunakan pada generator gambar/video untuk menghasilkan media."
        ].join("\n")
      }]
    })
  );

  return server;
}

app.get("/", (_req, res) => {
  res.json({
    service: "wowseru-ai-animasi",
    version: "1.0.0",
    status: "ready",
    endpoint: "/mcp"
  });
});

app.post("/mcp", async (req, res) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP request failed:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "MCP request failed",
        message: error.message
      });
    }
  }
});

app.get("/mcp", (_req, res) => {
  res.status(405).json({
    error: "Use POST for MCP requests."
  });
});

app.delete("/mcp", (_req, res) => {
  res.status(405).json({
    error: "Stateless MCP sessions are not supported for DELETE."
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`WOWSERU MCP server listening on port ${PORT}`);
});
