// ─── Standalone Backend Server (Express) ─────────────────────────────────────
// Gunakan script ini jika ingin menjalankan backend server secara mandiri di production.
// Jalankan dengan: node server/index.js

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "25mb" })); // Dukung upload base64 gambar kanvas

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
- Tools: brush, eraser, line, rectShape, ellipseShape, gradient, bucket, eyedropper.
- Tipe Kuas: pen, round, flat, feather, marker, pencil2, airbrush.

Aturan Kerja:
1. Berikan panduan menggambar yang jelas, mudah dipahami bahkan untuk pemula.
2. Jika ada gambar kanvas yang dikirim, analisis progres gambar tersebut secara visual dan berikan saran langkah berikutnya.
3. SETIAP KALI Anda menyarankan tool atau parameter tertentu, ANDA HARUS MEMANGGIL function "recommend_drawing_tool".
4. Gunakan Bahasa Indonesia yang ramah, sopan, dan inspiratif.`;

app.post("/api/chat", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === "" || apiKey === "your_gemini_api_key_here") {
      return res.status(400).json({
        error:
          "GEMINI_API_KEY belum dikonfigurasi di file .env server. Silakan tambahkan API key Anda ke file .env.",
      });
    }

    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Pesan tidak boleh kosong." });
    }

    const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const ai = new GoogleGenAI({ apiKey });

    const contents = [];
    for (const msg of messages) {
      const role = msg.role === "assistant" ? "model" : "user";
      const parts = [];

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
        const args = call.args;
        recommendation = {
          id: "rec-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
          tool: args.tool || "brush",
          brush_type: args.brush_type || undefined,
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

    res.json({
      reply: reply.trim(),
      recommendation,
    });
  } catch (err) {
    console.error("AI Assistant Error:", err);
    res.status(500).json({ error: err.message || "Gagal memproses permintaan AI." });
  }
});

app.listen(port, () => {
  console.log(`Backend AI Proxy berjalan di http://localhost:${port}`);
});
