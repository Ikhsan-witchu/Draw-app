import { useState, useRef, useEffect, type RefObject } from "react";
import {
  Sparkles,
  X,
  Send,
  Camera,
  Trash2,
  Bot,
  User,
  AlertCircle,
  Loader2,
  Minimize2,
} from "lucide-react";
import type { ChatMessage, ToolRecommendation } from "../../types/ai";
import {
  applyToolRecommendation,
  createAppliedConfirmation,
  createSkippedConfirmation,
  type WorkspaceToolSetters,
} from "../../utils/aiToolBridge";
import { RecommendationCard } from "./RecommendationCard";

interface AIAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeTabId: string | null;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  setters: WorkspaceToolSetters;
}

const QUICK_PROMPTS = [
  "Beri saran gaya anime",
  "Teknik shading dasar",
  "Rekomendasi warna harmonis",
  "Tips line art yang rapi",
];

let globalMsgCounter = 0;
function createChatMessage(
  role: "user" | "assistant" | "system",
  content: string,
  extra?: { imagePreview?: string; recommendation?: ToolRecommendation },
): ChatMessage {
  globalMsgCounter += 1;
  return {
    id: `${role}-${globalMsgCounter}-${Math.random().toString(36).substring(2, 8)}`,
    role,
    content,
    imagePreview: extra?.imagePreview,
    recommendation: extra?.recommendation,
    createdAt: Date.now(),
  };
}

export function AIAssistantPanel({
  isOpen,
  onClose,
  activeTabId,
  canvasRef,
  setters,
}: AIAssistantPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (!activeTabId) return [];
    try {
      const saved = localStorage.getItem(`draw_app_ai_chat_${activeTabId}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Gagal membaca riwayat chat:", e);
    }
    return [];
  });

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Simpan riwayat chat per tab
  useEffect(() => {
    if (!activeTabId) return;
    try {
      localStorage.setItem(`draw_app_ai_chat_${activeTabId}`, JSON.stringify(messages));
    } catch (e) {
      console.error("Gagal menyimpan riwayat chat:", e);
    }
  }, [messages, activeTabId]);

  // Scroll otomatis ke bawah saat ada pesan baru
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isLoading]);

  // Tangkap screenshot kanvas saat ini (di-scale agar ringan & cepat)
  function captureCanvasScreenshot(): string | null {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return null;

    try {
      const maxDimension = 1024;
      let targetW = canvas.width;
      let targetH = canvas.height;

      if (targetW > maxDimension || targetH > maxDimension) {
        const ratio = Math.min(maxDimension / targetW, maxDimension / targetH);
        targetW = Math.round(targetW * ratio);
        targetH = Math.round(targetH * ratio);
      }

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = targetW;
      tempCanvas.height = targetH;
      const ctx = tempCanvas.getContext("2d");
      if (!ctx) return null;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.drawImage(canvas, 0, 0, targetW, targetH);

      return tempCanvas.toDataURL("image/jpeg", 0.82);
    } catch (err) {
      console.error("Gagal mengambil screenshot kanvas:", err);
      return null;
    }
  }

  async function handleSendMessage(customText?: string, includeCanvasImage = false) {
    const textToSend = (customText ?? input).trim();
    if (!textToSend && !includeCanvasImage) return;

    setError(null);
    setInput("");

    let imagePreview: string | undefined = undefined;
    if (includeCanvasImage) {
      const captured = captureCanvasScreenshot();
      if (captured) {
        imagePreview = captured;
      }
    }

    const userMessage = createChatMessage(
      "user",
      textToSend || (includeCanvasImage ? "Tolong analisis progres gambar saya ini dan beri masukan serta rekomendasi tool langkah selanjutnya." : ""),
      { imagePreview },
    );

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      // Siapkan payload ke /api/chat
      const payloadMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
        image: m.imagePreview,
      }));

      const apiUrl = (import.meta.env.VITE_AI_API_URL as string) || "/api/chat";
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payloadMessages }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Gagal mendapatkan respons dari AI.");
      }

      const assistantMessage = createChatMessage(
        "assistant",
        data.reply || "",
        { recommendation: data.recommendation },
      );

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat menghubungi server AI.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  function handleApplyRecommendation(rec: ToolRecommendation) {
    applyToolRecommendation(rec, setters);

    // Update status kartu jadi applied
    setMessages((prev) =>
      prev.map((m) => {
        if (m.recommendation && m.recommendation.id === rec.id) {
          return {
            ...m,
            recommendation: { ...m.recommendation, status: "applied" },
          };
        }
        return m;
      }),
    );

    // Tambahkan notifikasi konfirmasi ke histori percakapan
    const confirmMessage = createChatMessage("system", createAppliedConfirmation(rec));
    setMessages((prev) => [...prev, confirmMessage]);
  }

  function handleSkipRecommendation(rec: ToolRecommendation) {
    // Update status kartu jadi skipped
    setMessages((prev) =>
      prev.map((m) => {
        if (m.recommendation && m.recommendation.id === rec.id) {
          return {
            ...m,
            recommendation: { ...m.recommendation, status: "skipped" },
          };
        }
        return m;
      }),
    );

    const skipMessage = createChatMessage("system", createSkippedConfirmation(rec));
    setMessages((prev) => [...prev, skipMessage]);
  }

  function handleClearChat() {
    if (confirm("Hapus semua riwayat percakapan untuk kanvas ini?")) {
      setMessages([]);
      if (activeTabId) {
        localStorage.removeItem(`draw_app_ai_chat_${activeTabId}`);
      }
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed sm:absolute bottom-0 right-0 z-40 w-full sm:w-96 h-[85vh] sm:h-[calc(100%-48px)] bg-neutral-900/95 backdrop-blur-md border-l border-t sm:border-t-0 border-neutral-800 shadow-2xl flex flex-col transition-all animate-in slide-in-from-right duration-200 text-neutral-200">
      {/* Header Panel */}
      <div className="h-12 px-3 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-950/60 select-none">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Sparkles size={15} />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
              AI Drawing Assistant
              <span className="px-1.5 py-0.2 rounded text-[9px] bg-indigo-900/50 text-indigo-300 border border-indigo-700/50">
                Gemini
              </span>
            </h3>
            <p className="text-[10px] text-neutral-400">Panduan teknik & analisis progres</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleClearChat}
            title="Hapus riwayat chat"
            className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-rose-400 transition-colors"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={onClose}
            title="Tutup panel"
            className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          >
            <Minimize2 size={14} className="hidden sm:block" />
            <X size={15} className="sm:hidden" />
          </button>
        </div>
      </div>

      {/* Area Chat Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-neutral-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 flex items-center justify-center text-indigo-400 shadow-inner">
              <Bot size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-200 mb-1">Halo seniman! Ada yang bisa dibantu?</p>
              <p className="text-[11px] text-neutral-400 leading-relaxed max-w-[260px]">
                Tanyakan teknik gambar atau klik <strong className="text-indigo-300">Analisis progres saya</strong> untuk mengevaluasi kanvas aktif Anda.
              </p>
            </div>

            {/* Quick Prompts */}
            <div className="w-full pt-2 flex flex-col gap-1.5 text-left">
              <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider">
                Pertanyaan populer:
              </span>
              {QUICK_PROMPTS.map((qp, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(qp)}
                  className="px-2.5 py-1.5 rounded-lg bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/60 text-[11px] text-neutral-300 hover:text-white transition-colors flex items-center justify-between"
                >
                  <span>{qp}</span>
                  <span className="text-indigo-400 text-[10px]">→</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => {
            if (m.role === "system") {
              return (
                <div key={m.id} className="text-center my-1.5">
                  <span className="inline-block px-2.5 py-1 rounded-full text-[10px] bg-neutral-800/80 border border-neutral-700/60 text-neutral-400">
                    {m.content}
                  </span>
                </div>
              );
            }

            const isUser = m.role === "user";
            return (
              <div
                key={m.id}
                className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    isUser
                      ? "bg-indigo-600 text-white"
                      : "bg-neutral-800 border border-neutral-700 text-indigo-400"
                  }`}
                >
                  {isUser ? <User size={13} /> : <Bot size={13} />}
                </div>

                <div className={`max-w-[85%] space-y-1.5 ${isUser ? "items-end" : "items-start"}`}>
                  {/* Bubble Preview Gambar Kanvas (jika user kirim screenshot) */}
                  {m.imagePreview && (
                    <div className="rounded-lg overflow-hidden border border-neutral-700 shadow-md max-w-[200px]">
                      <img
                        src={m.imagePreview}
                        alt="Screenshot Kanvas"
                        className="w-full h-auto object-contain bg-white"
                      />
                    </div>
                  )}

                  {/* Teks Pesan */}
                  {m.content && (
                    <div
                      className={`p-2.5 rounded-2xl text-[12px] leading-relaxed whitespace-pre-wrap ${
                        isUser
                          ? "bg-indigo-600 text-white rounded-tr-xs"
                          : "bg-neutral-800/90 border border-neutral-700/70 text-neutral-200 rounded-tl-xs"
                      }`}
                    >
                      {m.content}
                    </div>
                  )}

                  {/* Kartu Rekomendasi Terstruktur (jika ada tool use dari AI) */}
                  {m.recommendation && (
                    <RecommendationCard
                      recommendation={m.recommendation}
                      onApply={handleApplyRecommendation}
                      onSkip={handleSkipRecommendation}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex gap-2 items-center text-neutral-400 text-[11px] p-2 bg-neutral-800/40 rounded-lg border border-neutral-700/40 animate-pulse">
            <Loader2 size={13} className="animate-spin text-indigo-400" />
            <span>AI sedang menganalisis & meracik rekomendasi...</span>
          </div>
        )}

        {/* Error Box */}
        {error && (
          <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-[11.5px] flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-400" />
            <div>
              <p className="font-semibold text-rose-200">Gagal Memproses</p>
              <p className="leading-snug mt-0.5">{error}</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Action Bar: Tombol "Analisis Progres Saya" & Input Chat */}
      <div className="p-2.5 border-t border-neutral-800 bg-neutral-950/80 space-y-2">
        {/* Tombol Cepat: Analisis Progres Kanvas */}
        <button
          onClick={() => handleSendMessage(undefined, true)}
          disabled={isLoading}
          className="w-full py-1.5 px-3 rounded-lg bg-gradient-to-r from-indigo-900/60 via-purple-900/50 to-indigo-950/60 hover:from-indigo-800/70 hover:to-indigo-900/70 border border-indigo-700/50 text-indigo-200 hover:text-white transition-all text-[11.5px] font-medium flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.99] disabled:opacity-50"
        >
          <Camera size={13} className="text-indigo-400" />
          <span>Analisis Progres Saya (Kirim Kanvas)</span>
        </button>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-1.5"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ketik pertanyaan / minta saran..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 rounded-lg bg-neutral-800/90 border border-neutral-700 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:hover:bg-indigo-600 transition-all shrink-0"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
