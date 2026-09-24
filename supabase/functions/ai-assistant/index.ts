import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI, Type } from "npm:@google/genai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const recommendToolDeclaration = {
  name: "recommend_drawing_tool",
  description:
    "Rekomendasikan tool gambar, jenis kuas, ukuran px, opasitas %, warna HEX, dan urutan langkah menggambar untuk membantu user.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      tool: {
        type: Type.STRING,
        enum: [
          "brush",
          "eraser",
          "line",
          "rectShape",
          "ellipseShape",
          "gradient",
          "bucket",
          "eyedropper",
        ],
        description: "Tool menggambar yang dipilih",
      },
      brush_type: {
        type: Type.STRING,
        enum: ["pen", "round", "flat", "feather", "marker", "pencil2", "airbrush"],
        description: "Tipe kuas jika tool adalah brush atau eraser",
      },
      brush_size_px: { type: Type.INTEGER, description: "Ukuran kuas dalam piksel (1 - 128)" },
      opacity_percent: { type: Type.INTEGER, description: "Opasitas kuas dalam persen (1 - 100)" },
      color_hex: { type: Type.STRING, description: "Kode warna HEX (contoh #3B82F6), opsional" },
      steps: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Daftar urutan langkah praktis" },
      explanation: { type: Type.STRING, description: "Penjelasan singkat alasan saran ini" },
    },
    required: ["tool", "brush_size_px", "opacity_percent", "steps", "explanation"],
  },
};

const SYSTEM_INSTRUCTION = `Anda adalah AI Drawing Assistant ramah, suportif, dan ahli seni digital untuk aplikasi "Draw App".
Aplikasi ini memiliki tool & kuas berikut:
- Tools: brush, eraser, line, rectShape, ellipseShape, gradient, bucket, eyedropper.
- Tipe Kuas: pen, round, flat, feather, marker, pencil2, airbrush.

Aturan Kerja:
1. Berikan panduan menggambar yang jelas, mudah dipahami bahkan untuk pemula.
2. Jika ada gambar kanvas yang dikirim, analisis progres gambar tersebut secara visual dan berikan saran langkah berikutnya.
3. SETIAP KALI Anda menyarankan tool atau parameter tertentu, ANDA HARUS MEMANGGIL function "recommend_drawing_tool".
4. Gunakan Bahasa Indonesia yang ramah, sopan, dan inspiratif.`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY belum disetel di Supabase Secrets.");
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Pesan tidak boleh kosong." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let modelName = Deno.env.get("GEMINI_MODEL") || "gemini-3.6-flash";
    if (modelName.includes("1.5") || modelName.includes("2.5") || modelName === "1.5") {
      modelName = "gemini-3.6-flash";
    }
    const ai = new GoogleGenAI({ apiKey });

    const contents = [];
    for (const msg of messages) {
      const role = msg.role === "assistant" ? "model" : "user";
      const parts = [];

      if (msg.image) {
        const match = msg.image.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          parts.push({
            inlineData: { mimeType: match[1], data: match[2] },
          });
        }
      }

      if (msg.content && msg.content.trim()) {
        parts.push({ text: msg.content });
      }

      if (parts.length > 0) {
        contents.push({ role, parts });
      }
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: [recommendToolDeclaration] }],
      },
    });

    let reply = response.text || "";
    let recommendation;

    if (response.functionCalls && response.functionCalls.length > 0) {
      const call = response.functionCalls[0];
      if (call.name === "recommend_drawing_tool" && call.args) {
        const args = call.args as Record<string, unknown>;
        recommendation = {
          id: "rec-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
          tool: (args.tool as string) || "brush",
          brush_type: (args.brush_type as string) || undefined,
          brush_size_px: Number(args.brush_size_px) || 8,
          opacity_percent: Number(args.opacity_percent) || 100,
          color_hex: (args.color_hex as string) || undefined,
          steps: Array.isArray(args.steps) ? args.steps : [String(args.steps || "")],
          explanation: (args.explanation as string) || "Rekomendasi tool dari AI Assistant",
          status: "pending",
        };
        if (!reply.trim()) reply = recommendation.explanation;
      }
    }

    return new Response(
      JSON.stringify({ reply: reply.trim(), recommendation }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Gagal memproses permintaan AI.";
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
