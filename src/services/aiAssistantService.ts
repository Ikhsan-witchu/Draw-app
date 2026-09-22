// ─── Backend Service: Google Gemini AI Assistant ────────────────────────────
// Service ini dijalankan di server-side (Node.js/Vite dev middleware) agar API Key tetap aman.

import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import type { RecommendedTool, RecommendedBrushType, ToolRecommendation } from "../types/ai";

dotenv.config();

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

export interface RequestMessage {
  role: "user" | "assistant" | "system";
  content: string;
  image?: string; // data URL base64, e.g. "data:image/jpeg;base64,..."
}

export interface ChatResponse {
  reply: string;
  recommendation?: ToolRecommendation;
}

export async function processAIChatRequest(messages: RequestMessage[]): Promise<ChatResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "your_gemini_api_key_here") {
    throw new Error(
      "GEMINI_API_KEY belum dikonfigurasi di file .env server. Silakan tambahkan API key Anda ke file .env.",
    );
  }

  const modelName = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const ai = new GoogleGenAI({ apiKey });

  // Format history messages untuk Gemini API contents
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contents: any[] = [];

  for (const msg of messages) {
    const role = msg.role === "assistant" ? "model" : "user";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [];

    // Jika ada gambar (misal dari "Analisis progres saya")
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
    throw new Error("Pesan tidak boleh kosong.");
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

  // Cek apakah model memanggil function recommend_drawing_tool
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

      // Jika reply teks kosong, beri deskripsi ramah
      if (!reply.trim()) {
        reply = recommendation.explanation;
      }
    }
  }

  return {
    reply: reply.trim(),
    recommendation,
  };
}
