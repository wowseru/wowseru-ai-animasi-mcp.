  // TOOL 3
  server.registerTool("create_animation_concept", {
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false
    },
    description: "Menyusun konsep animasi setelah brief disetujui dan LANJUT.",
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
      return textResult("Produksi ditolak: OK dan LANJUT belum tercatat.", true);
    }

    const base = Math.floor(a.duration_seconds / a.scene_count);
    const remainder = a.duration_seconds % a.scene_count;

    const scenes = Array.from({ length: a.scene_count }, (_, i) => {
      const seconds = base + (i < remainder ? 1 : 0);
      const from = i * base + Math.min(i, remainder);
      const to = from + seconds;

      const idea = a.scene_ideas?.[i] ||
        `Show ${a.brand_product || "the main subject"} in an engaging visual moment.`;

      const phase = i === 0
        ? "Introduce the subject and establish the visual hook"
        : i === a.scene_count - 1
          ? "Resolve the story and finish on a memorable final frame"
          : "Develop the action while continuing from the previous scene";

      const narrationLine = a.narration || `Lihat ${a.brand_product || "cerita ini"}!`;

      const imagePrompt = `Create ONE complete storyboard sheet in ${a.resolution}, EXACTLY 2 COLUMNS x 3 ROWS, six panels total. STORY CONCEPT: ${idea}. SCENE PURPOSE: ${phase}. SUBJECT: ${a.brand_product || "Use the approved brief subject"}. PRODUCT FACTS: ${a.product_details || "Do not invent claims or features."}. VISUAL STYLE: ${a.visual_style}. Keep character design, proportions, colors, packaging, labels, lighting, and environment consistent. No extra panels, random text, fake logos, or watermark.`;

      const videoPrompt = `Create a ${seconds}-second ${a.style} animation in ${a.resolution}. SCENE: ${idea}. TIMELINE: 0-${(seconds * 0.2).toFixed(1)}s establish subject; ${(seconds * 0.2).toFixed(1)}-${(seconds * 0.55).toFixed(1)}s main action; ${(seconds * 0.55).toFixed(1)}-${(seconds * 0.8).toFixed(1)}s reaction; ${(seconds * 0.8).toFixed(1)}-${seconds}s final frame. Preserve subject identity, proportions, colors, labels, and accessories. No flicker, jitter, deformation, random text, fake logos, watermark, or unsupported claims.`;

      return {
        title: `SCENE ${i + 1}`,
        timing: `${from}-${to}s (${seconds}s)`,
        idea,
        imagePrompt,
        videoPrompt,
        narration: narrationLine
      };
    });

    const thumbnail = `Create a striking ${a.style} thumbnail for ${a.brand_product || "the approved subject"}. Visual style: ${a.visual_style}. Format: ${a.resolution}. Preserve supplied product details. No fake logos or watermark.`;

    const output = [
      "KONSEP ANIMASI WOWSERU AI",
      `Produk: ${a.brand_product || "Tidak disebutkan"}`,
      `Brief disetujui: ${approval.brief}`,
      `Target audiens: ${a.audience || "Umum"}`,
      `Durasi: ${a.duration_seconds} detik`,
      `Jumlah scene: ${a.scene_count}`,
      `Style: ${a.style}`,
      `Gaya visual: ${a.visual_style}`,
      "",
      "PROMPT THUMBNAIL",
      "```text",
      thumbnail,
      "```"
    ];

    for (const scene of scenes) {
      output.push(
        "",
        scene.title,
        `Timing: ${scene.timing}`,
        `Ide: ${scene.idea}`,
        `Narasi: ${scene.narration}`,
        "PROMPT STORYBOARD",
        "```text",
        scene.imagePrompt,
        "```",
        "PROMPT VIDEO",
        "```text",
        scene.videoPrompt,
        "```"
      );
    }

    output.push(
      "",
      "CTA: Kenali produk lebih dekat.",
      "CONTINUITY: Pertahankan karakter, produk, warna, bentuk, dan label.",
      `Link: ${a.product_link || "Tidak diberikan"}`,
      "",
      "Terima kasih sudah menggunakan Tools AI Animasi WOWSERU.",
      "Catatan: hasil ini berupa konsep dan prompt tekstual, bukan video final."
    );

    return textResult(output.join("\n"));
  });

  // TOOL 4
  server.registerTool("create_storyboard", {
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false
    },
    description: "Membuat storyboard enam panel untuk satu scene.",
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

    const subject = a.character || a.brand_product || "karakter utama";
    const idea = a.scene_idea || a.concept;

    const panels = [
      "Panel 1: wide establishing shot.",
      "Panel 2: medium shot memperlihatkan subjek.",
      "Panel 3: medium close-up memulai aksi utama.",
      "Panel 4: close-up reaksi atau detail.",
      "Panel 5: dynamic shot menyelesaikan aksi.",
      "Panel 6: hero shot sebagai frame akhir."
    ];

    const prompt = `Create ONE storyboard sheet, EXACTLY 2 columns x 3 rows, SIX panels. Subject: ${subject}. Scene: ${idea}. Style: ${a.visual_style || a.style}. Format: ${a.aspect_ratio}. Product details: ${a.product_details || "Do not invent claims."}. ${panels.join(" ")} Preserve identity, proportions, colors, material, labels, and accessories. No extra panels, fake logos, random text, or watermark.`;

    return textResult([
      `STORYBOARD SCENE ${a.scene_number}`,
      `Konsep: ${a.concept}`,
      `Subjek: ${subject}`,
      `Durasi: ${a.scene_duration_seconds} detik`,
      "",
      ...panels,
      "",
      "PROMPT STORYBOARD",
      "```text",
      prompt,
      "```",
      "",
      "Terima kasih sudah menggunakan Tools AI Animasi WOWSERU."
    ].join("\n"));
  });

  // TOOL 5
  server.registerTool("generate_animation_prompts", {
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false
    },
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

    const subject = a.brand_product || a.character || "karakter utama";
    const imagePrompt = `Create a ${a.style} image of ${subject}, portrait ${a.aspect_ratio}. Scene: ${a.scene}. Product details: ${a.product_details || "Use only supplied facts."}. Preserve identity, proportions, colors, and labels.`;
    const videoPrompt = `Animate ${subject} in ${a.style}, portrait ${a.aspect_ratio}, duration ${a.duration_seconds} seconds. Scene: ${a.scene}. Camera: ${a.camera_direction || "smooth cinematic push-in"}. Continuity: ${a.continuity_notes || "Preserve identity, proportions, colors, labels, and accessories."}. Negative: ${a.negative_prompt || "No deformation, flicker, jitter, random text, fake logos, or watermark."}.`;

    return textResult([
      `SCENE ${a.scene_number}: ${a.scene}`,
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
      `Narasi: ${a.narration || "Tidak diberikan"}`,
      "Terima kasih sudah menggunakan Tools AI Animasi WOWSERU."
    ].join("\n"));
  });

  return server;
}

// CLOUDFLARE WORKER
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

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
        version: "0.5.7",
        status: "ready",
        endpoint: "/mcp",
        tools: 5,
        approval_storage: "durable-object"
      });
    }

    if (url.pathname === "/health") {
      return Response.json({
        service: "wowseru-ai-animasi-mcp",
        version: "0.5.7",
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
        { onerror: (error) => console.error("MCP ERROR:", error) }
      );
      return handler(request, env, ctx);
    }

    return new Response("Not Found", { status: 404 });
  }
};

// DURABLE OBJECT
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
        return Response.json({ error: "Invalid approval record" }, { status: 400 });
      }

      await this.ctx.storage.put(`approval:${approval_id}`, state);
      return Response.json({ ok: true });
    }

    if (url.pathname === "/get") {
      const { approval_id } = body;

      if (!approval_id) {
        return Response.json({ error: "Missing approval_id" }, { status: 400 });
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
        return Response.json({ error: "Missing approval_id" }, { status: 400 });
      }

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
