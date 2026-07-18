"use client";

import { useState, useRef, useEffect } from "react";
import {
  Wand2, Loader2, Copy, Send, Plus, Trash2, BookOpen, Image as ImageIcon, Video, FileText, ArrowLeft, RotateCcw, ChevronDown,
} from "lucide-react";

interface User { id: string; name: string; email: string; credits: number; plan: string; }

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  category?: string;
}

interface Props {
  user: User;
  onUpdateCredits: (c: number) => void;
  onBack?: () => void;
}

const TEMPLATES = [
  { label: "Ebook completo", desc: "Tema → título, introducción y capítulos listos en Markdown.", icon: BookOpen, prompt: "Genera un ebook completo sobre marketing digital para emprendedores. Incluye título, subtítulo, introducción y al menos 5 capítulos con contenido sustancial." },
  { label: "Creativo para Facebook/Instagram Ads", desc: "Producto → títulos, textos principales, descripciones y CTA listos.", icon: ImageIcon, prompt: "Crea creativos publicitarios para Facebook e Instagram Ads para un curso de programación para principiantes. Incluye 3 opciones de título, texto principal, descripción y CTA." },
  { label: "Guion VSL", desc: "Oferta → guion completo de video de ventas con disparadores.", icon: Video, prompt: "Escribe un guion completo de VSL (Video Sales Letter) para vender un curso de inglés online. Incluye hook, historia, presentación del problema, solución, oferta, garantía y CTA urgente." },
  { label: "Guion hablado / Video corto", desc: "Tema → narración optimizada para TTS y Reels/TikTok.", icon: FileText, prompt: "Escribe un guion hablado de 60 segundos para un reel de Instagram sobre productividad matutina. Debe ser conversacional, con hook fuerte y CTA final. Optimizado para narración con TTS." },
];

const CATEGORY_PROMPTS: Record<string, string> = {
  image: `Eres un experto en ingeniería de prompts para IA generativa de imágenes. Transforma pedidos simples en descripciones técnicas profesionales.

ELEMENTOS OBLIGATORIOS en cada prompt:
- **Sujeto**: Apariencia, vestimenta, pose, expresión detallada.
- **Escenario**: Ambiente, profundidad de campo, elementos de fondo.
- **Iluminación**: Tipo (natural, estudio, dramática, golden hour), dirección e intensidad.
- **Estilo Técnico**: Cámara (Sony A7R IV, Canon EOS R5), lente (85mm f/1.8), ISO, Octane Render, Unreal Engine 5.
- **Calidad**: 8k, ultra-detallado, hiper-realista, masterpiece.

REGLAS: Genera el prompt en INGLÉS. Una sola oración densa. Responde SOLO con el prompt generado.`,

  video: `Eres un experto en prompts para generación de video IA estilo Veo3. Creas prompts breves pero densos en detalles de movimiento y atmósfera.

ESTRUCTURA: Acción clara + Estilo Visual + Movimiento de Cámara (pan, tilt, dolly, tracking) + Movimiento del Sujeto + Atmósfera (colores, clima, sentimiento).

REGLAS CRÍTICAS: Videos de 5-8 segundos MÁXIMO. UNA sola escena. Si el pedido requiere múltiples escenas o diálogos extensos, RECHAZA y explica. Prompt en INGLÉS. Máximo 3-4 oraciones. Responde SOLO con el prompt.`,

  animate: `Eres un experto en prompts para animar imágenes estáticas (5-8 segundos).

Enfoque: Movimiento sutil y cinematográfico (viento, partículas, cambio de expresión, agua, humo). Mantener consistencia visual con la imagen original. Usar: "fluid motion", "cinematic transition", "subtle animation".

REGLAS: Prompt en INGLÉS. Máximo 2-3 oraciones. Movimientos sutiles NO transformaciones drásticas. Responde SOLO con el prompt.`,

  clone: `Eres un especialista en prompts para clonación de rostros con IA (estilo Gemini) con realismo extremo.

FIDELIDAD OBLIGATORIA: Cabello (color, corte, textura), Rostro (formato, proporciones, boca, nariz, ojos, cejas), Piel (tono, textura realista), Expresión (según solicitud).

TÉCNICO: 4K, hiper-realista, ultra-detallado. Iluminación: dirección (lateral, frontal), intensidad, estilo (estudio profesional, Rembrandt, butterfly).

REGLAS: Prompt en INGLÉS. Prioridad absoluta a fidelidad facial. Responde SOLO con el prompt.`,

  default: `Eres Productor 360, un asistente experto en creación de contenido con IA. Ayudas a crear prompts profesionales para imágenes, videos, ebooks, guiones y más.

Cuando el usuario te pida crear algo, genera un prompt profesional, detallado y listo para usar en la herramienta de IA correspondiente.

Si es para IMÁGENES: Incluye sujeto, escenario, iluminación, cámara, lente, calidad (en inglés).
Si es para VIDEOS: Describe acción, estilo visual, movimiento de cámara, atmósfera (en inglés, max 5-8s).
Si es para EBOOKS: Genera estructura completa con títulos, subtítulos e índice (en español).
Si es para GUIONES: Hook, desarrollo, CTA con indicaciones de ritmo (en español).

Responde siempre en español excepto los prompts para imágenes/videos que van en inglés.`,
};

function detectCategory(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("imagen") || lower.includes("foto") || lower.includes("creativo") || lower.includes("diseño") || lower.includes("ilustración") || lower.includes("thumbnail")) return "image";
  if (lower.includes("video") || lower.includes("veo3") || lower.includes("animación") || lower.includes("reel") || lower.includes("tiktok")) return "video";
  if (lower.includes("anima") || lower.includes("movimiento") || lower.includes("dinámic")) return "animate";
  if (lower.includes("clon") || lower.includes("rostro") || lower.includes("gemini") || lower.includes("cara") || lower.includes("retrato")) return "clone";
  return "default";
}

export default function PromptChat({ user, onUpdateCredits, onBack }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "¡Hola! Soy Productor 360 🤖\n\nElige lo que quieres crear ahora — te lo entrego listo para usar.\n\nPuedes pedirme:\n• Prompts profesionales para imágenes\n• Guiones para videos y VSL\n• Estructuras completas de ebooks\n• Creativos para redes sociales\n• Cualquier contenido con IA" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<{ id: number; title: string; messages: ChatMessage[] }[]>([]);
  const [showTemplates, setShowTemplates] = useState(true);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setShowTemplates(false);
    setLoading(true);

    try {
      const category = detectCategory(text);
      const systemPrompt = CATEGORY_PROMPTS[category] || CATEGORY_PROMPTS.default;

      const res = await fetch("/api/generate/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.id}` },
        body: JSON.stringify({ description: text.trim(), category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const aiMsg: ChatMessage = { role: "assistant", content: data.prompt, category };
      setMessages([...newMessages, aiMsg]);
      onUpdateCredits(data.credits);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error de conexión";
      setMessages([...newMessages, { role: "assistant", content: `❌ Error: ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const newConversation = () => {
    if (messages.length > 1) {
      const title = messages[1]?.content?.substring(0, 50) || "Nueva conversación";
      setConversations(prev => [{ id: Date.now(), title, messages }, ...prev].slice(0, 20));
    }
    setMessages([{ role: "assistant", content: "¡Hola! Soy Productor 360 🤖\n\nElige lo que quieres crear ahora — te lo entrego listo para usar." }]);
    setShowTemplates(true);
    setInput("");
    inputRef.current?.focus();
  };

  const loadConversation = (conv: { id: number; messages: ChatMessage[] }) => {
    if (messages.length > 1) {
      const title = messages[1]?.content?.substring(0, 50) || "Nueva conversación";
      setConversations(prev => [{ id: Date.now(), title, messages }, ...prev.filter(c => c.id !== conv.id)].slice(0, 20));
    }
    setMessages(conv.messages);
    setShowTemplates(false);
  };

  const copyMessage = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="text-white/40 hover:text-white/70 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-bold">Generador de Prompts <span className="gradient-text">IA</span></h1>
            <p className="text-[10px] text-white/30">Elige lo que quieres crear — te lo entrego listo para usar</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {conversations.length > 0 && (
            <div className="relative group">
              <button className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors">
                <RotateCcw className="w-4 h-4" />
              </button>
              <div className="absolute right-0 top-full mt-1 w-56 bg-[#0f1629] border border-white/[0.08] rounded-xl overflow-hidden shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="p-2 text-[10px] text-white/30 font-semibold uppercase tracking-wider">Conversaciones recientes</div>
                {conversations.map(c => (
                  <button key={c.id} onClick={() => loadConversation(c)} className="w-full text-left px-3 py-2 text-xs text-white/60 hover:bg-white/5 hover:text-white truncate">{c.title}</button>
                ))}
                <button onClick={() => { setConversations([]); }} className="w-full text-left px-3 py-2 text-xs text-red-400/70 hover:bg-red-400/5 border-t border-white/[0.04]">Limpiar historial</button>
              </div>
            </div>
          )}
          <button onClick={newConversation} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/[0.08] text-xs text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Nueva conversación
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
        {showTemplates && messages.length === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            {TEMPLATES.map((t) => (
              <button key={t.label} onClick={() => sendMessage(t.prompt)} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-[#3b82f6]/30 hover:bg-[#3b82f6]/5 text-left transition-all group">
                <div className="flex items-center gap-2 mb-1">
                  <t.icon className="w-4 h-4 text-[#3b82f6]" />
                  <span className="text-sm font-semibold text-white/80 group-hover:text-white">{t.label}</span>
                </div>
                <p className="text-[11px] text-white/30 leading-relaxed">{t.desc}</p>
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#7c3aed] flex items-center justify-center flex-shrink-0 mt-1">
                <Wand2 className="w-4 h-4 text-white" />
              </div>
            )}
            <div className={`max-w-[85%] sm:max-w-[75%] ${msg.role === "user" ? "order-first" : ""}`}>
              <div className={`rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-[#3b82f6] text-white rounded-tr-sm"
                  : "bg-white/[0.04] border border-white/[0.06] text-white/80 rounded-tl-sm"
              }`}>
                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-[inherit]">{msg.content}</pre>
              </div>
              {msg.role === "assistant" && i > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  {msg.category && (
                    <span className="px-2 py-0.5 rounded-md bg-[#3b82f6]/10 text-[#3b82f6] text-[10px] font-medium">{msg.category}</span>
                  )}
                  <button onClick={() => copyMessage(msg.content, i)} className="text-[10px] text-white/30 hover:text-white/60 flex items-center gap-1 transition-colors ml-1">
                    {copiedIdx === i ? "✓ Copiado" : <><Copy className="w-3 h-3" /> Copiar</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#7c3aed] flex items-center justify-center flex-shrink-0">
              <Wand2 className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-2 text-white/40 text-sm">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generando prompt profesional...
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-white/[0.06] p-4 sm:px-6">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#3b82f6] transition-colors resize-none max-h-32 overflow-y-auto"
              placeholder="Describe lo que quieres crear... (Enter para enviar, Shift+Enter para nueva línea)"
              disabled={loading}
            />
          </div>
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="p-3 rounded-xl bg-gradient-to-b from-[#3b82f6] to-[#1e40af] text-white hover:brightness-110 active:scale-[0.95] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-center text-[10px] text-white/20 mt-2">Costo: 2 créditos por generación · El prompt se genera en inglés para máxima compatibilidad</p>
      </div>
    </div>
  );
}