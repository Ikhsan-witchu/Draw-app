// ─── Vercel Serverless Function: /api/chat ────────────────────────────────────
// File ini di-deploy otomatis oleh Vercel karena berada di folder `api/`.
// Di sini kita memanggil Gemini API dengan API key dari environment variable Vercel.
// Frontend (AIAssistantPanel.tsx) akan fetch ke "/api/chat" yang akan diarahkan ke sini.

import type { IncomingMessage, ServerResponse } from "node:http";
import { GoogleGenAI, Type } from "@google/genai";

// ─── Type Definitions ─────────────────────────────────────────────────────────

type RecommendedTool =
  | "brush"
  | "eraser"
  | "line"
  | "rectShape"
  | "ellipseShape"
  | "gradient"
  | "bucket"
  | "eyedropper";

type RecommendedBrushType =
  | "pen"
  | "round"
  | "flat"
  | "feather"
  | "marker"
  | "pencil2"
  | "airbrush";

interface ToolRecommendation {
  id: string;
  tool: RecommendedTool;
  brush_type?: RecommendedBrushType;
  brush_size_px: number;
  opacity_percent: number;
  color_hex?: string;
  steps: string[];
  explanation: string;
  status: "pending" | "applied" | "skipped";
}

interface RequestMessage {
  role: "user" | "assistant" | "system";
  content: string;
  image?: string;
}

// ─── Tool Declaration untuk Gemini Function Calling ───────────────────────────

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
      brush_size_px: {
        type: Type.INTEGER,
        description: "Ukuran kuas dalam piksel (1 - 128)",
      },
      opacity_percent: {
        type: Type.INTEGER,
        description: "Opasitas kuas dalam persen (1 - 100)",
      },
      color_hex: {
        type: Type.STRING,
        description: "Kode warna HEX (contoh #3B82F6), opsional jika relevan",
      },
      steps: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Daftar urutan langkah praktis untuk diikuti user",
      },
      explanation: {
        type: Type.STRING,
        description: "Penjelasan singkat alasan mengapa tool & parameter ini disarankan",
      },
    },
    required: ["tool", "brush_size_px", "opacity_percent", "steps", "explanation"],
  },
};

const SYSTEM_INSTRUCTION = `Anda adalah AI Drawing Assistant ramah, suportif, dan ahli seni digital untuk aplikasi "Draw App".
Aplikasi ini memiliki tool & kuas berikut:
- Tools:
  * brush: kuas gambar bebas
  * eraser: penghapus
  * line: garis lurus
  * rectShape: kotak
  * ellipseShape: lingkaran / elips
  * gradient: gradasi warna
  * bucket: isi warna (flood fill)
  * eyedropper: pipet pengambil warna
- Tipe Kuas (untuk brush & eraser):
  * pen: garis tajam & presisi (cocok untuk sketsa awal, inking, line art anime)
  * round: kuas bulat lembut serbaguna
  * flat: kuas pipih sudut untuk sapuan cat lebar
  * feather: kuas cat air lembut (watercolor)
  * marker: spidol semi-transparan (cocok untuk highlight & coloring)
  * pencil2: pensil bertekstur sketsa alami
  * airbrush: semprotan cat lembut dengan gradien halus (cocok untuk shading & glow)

Aturan Kerja:
1. Berikan panduan menggambar yang jelas, mudah dipahami bahkan untuk pemula.
2. Jika ada gambar kanvas yang dikirim, analisis progres gambar tersebut secara visual (komposisi, line art, shading, anatomi, warna) dan berikan saran langkah berikutnya.
3. SETIAP KALI Anda menyarankan tool, ukuran, atau warna tertentu, ANDA HARUS MEMANGGIL function "recommend_drawing_tool" dengan parameter yang tepat sehingga pengguna dapat menerapkannya dengan 1 tombol "Terapkan".
4. Gunakan Bahasa Indonesia yang ramah, sopan, dan inspiratif.`;

// ─── Helper: Baca body dari request sebagai string ────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => {
      data += chunk.toString();
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

// ─── Vercel Serverless Function Handler ───────────────────────────────────────

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Tambahkan CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method tidak diizinkan. Gunakan POST." }));
    return;
  }

  try {
    const bodyText = await readBody(req);
    const body = JSON.parse(bodyText) as { messages?: RequestMessage[] };

    const messages: RequestMessage[] = body.messages ?? [];
    if (!Array.isArray(messages) || messages.length === 0) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Field 'messages' harus berupa array tidak kosong." }));
      return;
    }

    // Ambil API key dari environment Vercel
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === "" || apiKey === "your_gemini_api_key_here") {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error:
            "GEMINI_API_KEY belum dikonfigurasi di Vercel environment variables. Tambahkan key Anda di dashboard Vercel > Settings > Environment Variables.",
        }),
      );
      return;
    }

    // Sanitasi model: auto-upgrade jika pakai model deprecated
    let modelName = process.env.GEMINI_MODEL || "gemini-3.6-flash";
    if (modelName.includes("1.5") || modelName.includes("2.5")) {
      modelName = "gemini-3.6-flash";
    }

    const ai = new GoogleGenAI({ apiKey });

    // Format messages ke Gemini contents format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contents: any[] = [];

    for (const msg of messages) {
      if (msg.role === "system") continue; // Gemini pakai systemInstruction, bukan role system

      const role = msg.role === "assistant" ? "model" : "user";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts: any[] = [];

      // Lampirkan gambar kanvas jika ada
      if (msg.image) {
        const match = msg.image.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          parts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2],
            },
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

    if (contents.length === 0) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Tidak ada konten pesan yang valid." }));
      return;
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
    let recommendation: ToolRecommendation | undefined;

    // Proses function call dari Gemini jika ada
    if (response.functionCalls && response.functionCalls.length > 0) {
      const call = response.functionCalls[0];
      if (call.name === "recommend_drawing_tool" && call.args) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = call.args as any;
        recommendation = {
          id: "rec-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
          tool: (args.tool as RecommendedTool) || "brush",
          brush_type: (args.brush_type as RecommendedBrushType) || undefined,
          brush_size_px: Number(args.brush_size_px) || 8,
          opacity_percent: Number(args.opacity_percent) || 100,
          color_hex: args.color_hex || undefined,
          steps: Array.isArray(args.steps) ? args.steps : [String(args.steps || "")],
          explanation: args.explanation || "Rekomendasi tool dari AI Assistant",
          status: "pending",
        };

        if (!reply.trim()) {
          reply = recommendation.explanation;
        }
      }
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        reply: reply.trim(),
        recommendation,
      }),
    );
  } catch (err: unknown) {
    console.error("[api/chat] Error:", err);
    const message = err instanceof Error ? err.message : "Terjadi kesalahan internal server.";
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: message }));
  }
}
