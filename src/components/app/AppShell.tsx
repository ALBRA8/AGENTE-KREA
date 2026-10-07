"use client";

import { useState, useEffect, createContext, useContext } from "react";
import PromptChat from "./PromptChat";
import SettingsPage from "./SettingsPage";
import SupportPage from "./SupportPage";
import MetricsTracker from "./MetricsTracker";
import AdnDashboard from "./AdnDashboard";
import {
  Image, FileText, Mic, BookOpen, Subtitles, LayoutDashboard,
  Library as LibraryIcon, LogOut, Menu, X, Coins, Sparkles, ChevronRight, Loader2,
  Copy, MessageSquare, Video, Wand2, Download, Trash2, Clock,
  RefreshCw, Volume2, Type, Settings, HelpCircle, Headphones, BarChart3,
  Dna, Shield,
} from "lucide-react";

/* ════════════ Types ════════════ */
interface User {
  id: string; name: string; email: string; credits: number; plan: string;
}
interface Generation {
  id: string; type: string; title: string; prompt: string; result: string;
  credits: number; createdAt: string;
}

/* ════════════ Auth Context ════════════ */
const AuthCtx = createContext<{ user: User | null; logout: () => void; refreshUser: () => void }>({ user: null, logout: () => {}, refreshUser: () => {} });
export const useAuth = () => useContext(AuthCtx);

/* ════════════ Sidebar ════════════ */
interface NavItem { id: string; label: string; icon: React.ComponentType<{className?: string}>; cost?: number; badge?: string; section?: string; }
const NAV_SECTIONS: { title: string | null; items: NavItem[] }[] = [
  { title: null, items: [{ id: "dashboard", label: "Panel de control", icon: LayoutDashboard }] },
  { title: "PRODUCCIÓN", items: [
    { id: "prompts", label: "Generador de Prompts IA", icon: Wand2, cost: 2, badge: "🔥" },
    { id: "images", label: "Generador de Imágenes", icon: Image, cost: 3 },
    { id: "copy", label: "Copywriting", icon: Copy, cost: 2 },
    { id: "social", label: "Contenido Redes", icon: MessageSquare, cost: 2 },
    { id: "script", label: "Scripts de Video", icon: Video, cost: 2 },
    { id: "email", label: "Email Marketing", icon: FileText, cost: 2 },
    { id: "voice", label: "Voz IA Pro", icon: Mic, cost: 3 },
    { id: "ebook", label: "Generador de eBooks", icon: BookOpen, cost: 8 },
    { id: "subtitle", label: "Subtítulos", icon: Subtitles, cost: 2 },
  ]},
  { title: "INTELIGENCIA", items: [
    { id: "metrics", label: "360 Metrics", icon: BarChart3, badge: "NUEVO" },
    { id: "adn", label: "ADN del Agente", icon: Dna, badge: "ADN" },
  ]},
  { title: "GESTIÓN", items: [
    { id: "library", label: "Biblioteca de Proyectos", icon: LibraryIcon },
    { id: "settings", label: "Configuración", icon: Settings },
    { id: "support", label: "Soporte", icon: Headphones },
  ]},
];
const FLAT_NAV = NAV_SECTIONS.flatMap(s => s.items);

function Sidebar({ active, onNav, open, onClose, user }: {
  active: string; onNav: (id: string) => void; open: boolean; onClose: () => void; user: User | null;
}) {
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />}
      <aside className={`fixed top-0 left-0 h-full z-50 w-64 bg-[#0a0f1e] border-r border-white/[0.06] flex flex-col transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:z-auto`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/[0.06]">
          <img src="/krea-logo.png" alt="" className="h-8 w-8 rounded-lg object-contain" />
          <span className="text-sm font-bold"><span className="gradient-text">Krea</span></span>
          <button onClick={onClose} className="ml-auto lg:hidden text-white/50"><X className="w-5 h-5" /></button>
        </div>

        {/* Credits */}
        {user && (
          <div className="mx-4 mt-4 p-3 rounded-xl bg-gradient-to-r from-[#2563eb]/10 to-[#7c3aed]/10 border border-white/[0.06]">
            <div className="flex items-center gap-2 text-xs text-white/50 mb-1">
              <Coins className="w-3.5 h-3.5 text-yellow-400" /> Créditos disponibles
            </div>
            <p className="text-xl font-extrabold">{user.credits} <span className="text-xs font-normal text-white/40">créditos</span></p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title || "main"}>
              {section.title && (
                <div className="flex items-center gap-2 px-3 pt-4 pb-1.5">
                  <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{section.title}</span>
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { onNav(item.id); onClose(); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all ${
                      active === item.id
                        ? "bg-gradient-to-r from-[#3b82f6]/20 to-[#7c3aed]/10 text-white border border-[#3b82f6]/20"
                        : "text-white/50 hover:text-white/80 hover:bg-white/5"
                    }`}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {item.badge && <span className="text-xs">{item.badge}</span>}
                    {item.cost && <span className="text-[10px] text-white/20">-{item.cost}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User */}
        {user && (
          <div className="border-t border-white/[0.06] p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#7c3aed] flex items-center justify-center text-xs font-bold">
                {user.name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{user.name}</p>
                <p className="text-[10px] text-white/40 truncate">{user.email}</p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

/* ════════════ Dashboard ════════════ */
function Dashboard({ user, generations, onNav }: { user: User; generations: Generation[]; onNav: (id: string) => void }) {
  const quickTools = [
    { id: "prompts", label: "Generador de Prompts IA", desc: "Elige lo que quieres crear ahora — te lo entrego listo para usar.", icon: Wand2, badge: "🔥" },
    { id: "metrics", label: "360 Metrics", desc: "Seguimiento de campana con ROAS, beneficio y ventas en tiempo real.", icon: BarChart3, badge: "NUEVO" },
    { id: "images", label: "Generador de Imágenes", desc: "Crea imágenes profesionales con inteligencia artificial.", icon: Image },
    { id: "ebook", label: "Generador de eBooks IA Pro", desc: "eBooks completos y profesionales con IA.", icon: BookOpen },
    { id: "library", label: "Biblioteca de Proyectos", desc: "Historial de todas tus creaciones.", icon: LibraryIcon },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold mb-1">¡Bienvenido de nuevo, <span className="gradient-text">{user.name.split(" ")[0]}</span>! 👋</h1>
        <p className="text-sm text-white/50">Crea contenido increíble 10 veces más rápido con inteligencia artificial</p>
      </div>

      {/* Quick Tools */}
      <h2 className="text-base font-bold mb-3 flex items-center gap-2">Herramientas Rápidas ⚡</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {quickTools.map((t) => (
          <button key={t.id} onClick={() => onNav(t.id)} className="p-4 rounded-2xl bg-[#0f1629] border border-white/[0.06] hover:border-[#3b82f6]/20 hover:bg-[#3b82f6]/5 transition-all text-left group">
            <div className="flex items-center justify-between mb-2">
              <t.icon className="w-5 h-5 text-[#3b82f6]" />
              {t.badge && <span className="text-sm">{t.badge}</span>}
              <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 group-hover:translate-x-1 transition-all" />
            </div>
            <p className="text-sm font-semibold mb-0.5">{t.label}</p>
            <p className="text-[11px] text-white/30 leading-relaxed">{t.desc}</p>
          </button>
        ))}
      </div>

      {/* Stats */}
      <h2 className="text-base font-bold mb-3">Tu Actividad</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Imágenes", value: generations.filter(g => g.type === "image").length, icon: Image, color: "from-blue-500 to-blue-700", suffix: "creadas" },
          { label: "Textos", value: generations.filter(g => g.type === "text" || g.type === "prompt").length, icon: FileText, color: "from-purple-500 to-purple-700", suffix: "creados" },
          { label: "Voces", value: generations.filter(g => g.type === "voice").length, icon: Mic, color: "from-emerald-500 to-emerald-700", suffix: "creadas" },
          { label: "eBooks", value: generations.filter(g => g.type === "ebook").length, icon: BookOpen, color: "from-orange-500 to-orange-700", suffix: "creados" },
        ].map((s) => (
          <div key={s.label} className="p-4 rounded-2xl bg-[#0f1629] border border-white/[0.06]">
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} mb-3`}>
              <s.icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-2xl font-extrabold">{s.value}</p>
            <p className="text-xs text-white/40">{s.label} {s.suffix}</p>
          </div>
        ))}
      </div>

      {/* Recent */}
      {generations.length > 0 && (
        <div>
          <h2 className="text-base font-bold mb-3">Creaciones recientes</h2>
          <div className="space-y-2">
            {generations.slice(0, 5).map((g) => (
              <div key={g.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#0f1629] border border-white/[0.06]">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                  {g.type === "image" ? <Image className="w-4 h-4 text-blue-400" /> : g.type === "voice" ? <Mic className="w-4 h-4 text-emerald-400" /> : g.type === "ebook" ? <BookOpen className="w-4 h-4 text-orange-400" /> : g.type === "prompt" ? <Wand2 className="w-4 h-4 text-purple-400" /> : <FileText className="w-4 h-4 text-purple-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{g.title}</p>
                  <p className="text-[10px] text-white/30">{new Date(g.createdAt).toLocaleDateString("es-ES")}</p>
                </div>
                <span className="text-[10px] text-white/30">-{g.credits} <Coins className="inline w-3 h-3" /></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════ Image Generator ════════════ */
function ImageGenerator({ user, onUpdateCredits }: { user: User; onUpdateCredits: (c: number) => void }) {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("fotográfico, alta calidad");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch("/api/generate/image", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.id}` },
        body: JSON.stringify({ prompt, style }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResult(data.imageUrl); onUpdateCredits(data.credits);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  };

  const styles = ["fotográfico, alta calidad", "ilustración digital", "estilo minimalista", "3D render", "arte conceptual", "diseño publicitario"];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold mb-1">Generador de <span className="gradient-text">Imágenes</span></h1>
        <p className="text-sm text-white/50">Crea imágenes profesionales con IA. Costo: <span className="text-yellow-400 font-semibold">3 créditos</span></p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Describe la imagen que quieres crear</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#3b82f6] transition-colors resize-none" placeholder="Ej: Un producto de skincare sobre fondo oscuro con luz neón azul, fotografía publicitaria profesional" />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Estilo visual</label>
            <div className="flex flex-wrap gap-2">
              {styles.map((s) => (
                <button key={s} onClick={() => setStyle(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${style === s ? "bg-[#3b82f6] text-white" : "bg-white/5 text-white/50 hover:bg-white/10"}`}>{s}</button>
              ))}
            </div>
          </div>
          <button onClick={generate} disabled={loading || !prompt} className="w-full py-3.5 rounded-xl bg-gradient-to-b from-[#3b82f6] to-[#1e40af] text-white font-bold text-sm shadow-[0_10px_24px_rgba(30,64,175,0.45)] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando imagen...</> : <><Sparkles className="w-4 h-4" /> Generar imagen (-3 créditos)</>}
          </button>
          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        </div>

        <div>
          {result ? (
            <div className="rounded-2xl overflow-hidden border border-white/[0.06] bg-[#0f1629]">
              <img src={result} alt="Generated" className="w-full" />
              <div className="p-3 flex items-center justify-between">
                <span className="text-xs text-white/40">Imagen generada con IA</span>
                <a href={result} download className="text-xs text-[#3b82f6] flex items-center gap-1 hover:underline"><Download className="w-3 h-3" /> Descargar</a>
              </div>
            </div>
          ) : (
            <div className="aspect-square rounded-2xl border border-dashed border-white/10 flex items-center justify-center bg-white/[0.02]">
              <div className="text-center text-white/20">
                <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Tu imagen aparecerá aquí</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════ Text Generator ════════════ */
function TextGenerator({ type, user, onUpdateCredits }: { type: string; user: User; onUpdateCredits: (c: number) => void }) {
  const configs: Record<string, { title: string; desc: string; placeholder: string; label: string }> = {
    copy: { title: "Copywriting", desc: "Textos persuasivos que venden", placeholder: "Ej: Escribe un headline para una campaña de lanzamiento de un curso de marketing digital para emprendedores", label: "Copy / Publicidad" },
    social: { title: "Contenido Redes", desc: "Posts virales para Instagram, TikTok, etc.", placeholder: "Ej: Crea 5 ideas de posts para Instagram sobre fitness para mujeres de 30-40 años", label: "Tipo de contenido" },
    script: { title: "Scripts de Video", desc: "Guiones para YouTube, TikTok, Reels", placeholder: "Ej: Escribe un script de 60 segundos para un reel que promocione una app de productividad", label: "Detalles del video" },
    email: { title: "Email Marketing", desc: "Emails que abren y convierten", placeholder: "Ej: Escribe una secuencia de 3 emails de bienvenida para nuevos suscriptores de un newsletter de negocios", label: "Objetivo del email" },
  };
  const cfg = configs[type] || configs.copy;
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true); setError(""); setResult("");
    try {
      const res = await fetch("/api/generate/text", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.id}` },
        body: JSON.stringify({ prompt, type }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResult(data.text); onUpdateCredits(data.credits);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  };

  const copyToClipboard = () => { navigator.clipboard.writeText(result); };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold mb-1"><span className="gradient-text">{cfg.title}</span></h1>
        <p className="text-sm text-white/50">{cfg.desc}. Costo: <span className="text-yellow-400 font-semibold">2 créditos</span></p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">{cfg.label}</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={6} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#3b82f6] transition-colors resize-none" placeholder={cfg.placeholder} />
          </div>
          <button onClick={generate} disabled={loading || !prompt} className="w-full py-3.5 rounded-xl bg-gradient-to-b from-[#3b82f6] to-[#1e40af] text-white font-bold text-sm shadow-[0_10px_24px_rgba(30,64,175,0.45)] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando...</> : <><Sparkles className="w-4 h-4" /> Generar texto (-2 créditos)</>}
          </button>
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
        <div>
          {result ? (
            <div className="rounded-2xl border border-white/[0.06] bg-[#0f1629] h-full flex flex-col">
              <div className="flex items-center justify-between p-3 border-b border-white/[0.06]">
                <span className="text-xs text-white/40">Resultado</span>
                <button onClick={copyToClipboard} className="text-xs text-[#3b82f6] flex items-center gap-1 hover:underline"><Copy className="w-3 h-3" /> Copiar</button>
              </div>
              <pre className="flex-1 p-4 text-sm text-white/80 whitespace-pre-wrap overflow-y-auto max-h-[500px] font-[inherit]">{result}</pre>
            </div>
          ) : (
            <div className="h-full min-h-[300px] rounded-2xl border border-dashed border-white/10 flex items-center justify-center bg-white/[0.02]">
              <div className="text-center text-white/20"><FileText className="w-12 h-12 mx-auto mb-3 opacity-50" /><p className="text-sm">Tu texto aparecerá aquí</p></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════ Voice Generator ════════════ */
function VoiceGenerator({ user, onUpdateCredits }: { user: User; onUpdateCredits: (c: number) => void }) {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("tongtong");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const voices = [
    { id: "tongtong", label: "Tongtong", desc: "Femenino claro" },
    { id: "xiaoyi", label: "Xiaoyi", desc: "Femenino suave" },
    { id: "zhiyan", label: "Zhiyan", desc: "Masculino joven" },
    { id: "zhichu", label: "Zhichu", desc: "Masculino narrador" },
  ];

  const generate = async () => {
    setLoading(true); setError(""); setResult("");
    try {
      const res = await fetch("/api/generate/voice", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.id}` },
        body: JSON.stringify({ text, voice }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResult(data.audioUrl); onUpdateCredits(data.credits);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold mb-1">Generador de <span className="gradient-text">Voz IA</span></h1>
        <p className="text-sm text-white/50">Narración profesional con inteligencia artificial. Costo: <span className="text-yellow-400 font-semibold">3 créditos</span></p>
      </div>
      <div className="max-w-2xl space-y-4">
        <div>
          <label className="text-xs text-white/50 mb-1.5 block">Texto para narrar</label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#3b82f6] transition-colors resize-none" placeholder="Escribe el texto que quieres convertir a voz profesional..." />
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1.5 block">Voz</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {voices.map((v) => (
              <button key={v.id} onClick={() => setVoice(v.id)} className={`p-3 rounded-xl text-left transition-all border ${voice === v.id ? "bg-[#3b82f6]/10 border-[#3b82f6]/30 text-white" : "bg-white/5 border-white/[0.06] text-white/50 hover:bg-white/10"}`}>
                <p className="text-sm font-semibold">{v.label}</p>
                <p className="text-[10px] text-white/30">{v.desc}</p>
              </button>
            ))}
          </div>
        </div>
        <button onClick={generate} disabled={loading || !text} className="w-full py-3.5 rounded-xl bg-gradient-to-b from-[#3b82f6] to-[#1e40af] text-white font-bold text-sm shadow-[0_10px_24px_rgba(30,64,175,0.45)] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando voz...</> : <><Volume2 className="w-4 h-4" /> Generar voz (-3 créditos)</>}
        </button>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        {result && (
          <div className="p-4 rounded-2xl border border-white/[0.06] bg-[#0f1629]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-white/40">Audio generado</span>
              <a href={result} download className="text-xs text-[#3b82f6] flex items-center gap-1 hover:underline"><Download className="w-3 h-3" /> Descargar MP3</a>
            </div>
            <audio controls src={result} className="w-full" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════ eBook Generator ════════════ */
function EbookGenerator({ user, onUpdateCredits }: { user: User; onUpdateCredits: (c: number) => void }) {
  const [topic, setTopic] = useState("");
  const [chapters, setChapters] = useState("5");
  const [audience, setAudience] = useState("emprendedores digitales");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true); setError(""); setResult("");
    try {
      const res = await fetch("/api/generate/ebook", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.id}` },
        body: JSON.stringify({ topic, chapters: parseInt(chapters), targetAudience: audience }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResult(data.content); onUpdateCredits(data.credits);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold mb-1">Generador de <span className="gradient-text">eBooks</span></h1>
        <p className="text-sm text-white/50">Crea libros electrónicos completos con IA. Costo: <span className="text-yellow-400 font-semibold">8 créditos</span></p>
      </div>
      <div className="max-w-3xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Tema del eBook</label>
            <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#3b82f6]" placeholder="Ej: Marketing digital para principiantes" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Capítulos</label>
              <select value={chapters} onChange={(e) => setChapters(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#3b82f6]">
                {["3", "5", "7", "10"].map(n => <option key={n} value={n} className="bg-[#0a0f1e]">{n} capítulos</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Audiencia</label>
              <select value={audience} onChange={(e) => setAudience(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#3b82f6]">
                {["emprendedores digitales", "profesionales de marketing", "pequeños negocios", "creadores de contenido", "general"].map(a => <option key={a} value={a} className="bg-[#0a0f1e]">{a}</option>)}
              </select>
            </div>
          </div>
        </div>
        <button onClick={generate} disabled={loading || !topic} className="w-full py-3.5 rounded-xl bg-gradient-to-b from-[#3b82f6] to-[#1e40af] text-white font-bold text-sm shadow-[0_10px_24px_rgba(30,64,175,0.45)] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando eBook (puede tardar 30-60s)...</> : <><BookOpen className="w-4 h-4" /> Generar eBook (-8 créditos)</>}
        </button>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        {result && (
          <div className="rounded-2xl border border-white/[0.06] bg-[#0f1629]">
            <div className="flex items-center justify-between p-3 border-b border-white/[0.06]">
              <span className="text-xs text-white/40">eBook generado</span>
              <button onClick={() => navigator.clipboard.writeText(result)} className="text-xs text-[#3b82f6] flex items-center gap-1 hover:underline"><Copy className="w-3 h-3" /> Copiar todo</button>
            </div>
            <div className="p-4 max-h-[600px] overflow-y-auto prose prose-invert prose-sm text-white/80">
              <pre className="whitespace-pre-wrap font-[inherit] text-sm leading-relaxed">{result}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════ Subtitle Generator ════════════ */
function SubtitleGenerator({ user, onUpdateCredits }: { user: User; onUpdateCredits: (c: number) => void }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true); setError(""); setResult("");
    try {
      const res = await fetch("/api/generate/subtitle", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.id}` },
        body: JSON.stringify({ videoUrl: url || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResult(data.srt); onUpdateCredits(data.credits);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold mb-1">Generador de <span className="gradient-text">Subtítulos</span></h1>
        <p className="text-sm text-white/50">Crea subtítulos SRT profesionales. Costo: <span className="text-yellow-400 font-semibold">2 créditos</span></p>
      </div>
      <div className="max-w-2xl space-y-4">
        <div>
          <label className="text-xs text-white/50 mb-1.5 block">URL del video (opcional — si lo dejas vacío se genera un template)</label>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#3b82f6]" placeholder="https://youtube.com/watch?v=..." />
        </div>
        <button onClick={generate} disabled={loading} className="w-full py-3.5 rounded-xl bg-gradient-to-b from-[#3b82f6] to-[#1e40af] text-white font-bold text-sm shadow-[0_10px_24px_rgba(30,64,175,0.45)] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando...</> : <><Subtitles className="w-4 h-4" /> Generar subtítulos (-2 créditos)</>}
        </button>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        {result && (
          <div className="rounded-2xl border border-white/[0.06] bg-[#0f1629]">
            <div className="flex items-center justify-between p-3 border-b border-white/[0.06]">
              <span className="text-xs text-white/40">Subtítulos SRT</span>
              <button onClick={() => navigator.clipboard.writeText(result)} className="text-xs text-[#3b82f6] flex items-center gap-1 hover:underline"><Copy className="w-3 h-3" /> Copiar SRT</button>
            </div>
            <pre className="p-4 text-xs text-white/70 whitespace-pre-wrap max-h-[400px] overflow-y-auto">{result}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════ Library ════════════ */
function Library({ user }: { user: User }) {
  const [gens, setGens] = useState<Generation[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = filter === "all" ? "" : `?type=${filter}`;
      const res = await fetch(`/api/generations${params}`, { headers: { Authorization: `Bearer ${user.id}` } });
      if (res.ok) setGens(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const typeFilters = [
    { id: "all", label: "Todos" },
    { id: "image", label: "Imágenes" },
    { id: "text", label: "Textos" },
    { id: "voice", label: "Voces" },
    { id: "ebook", label: "eBooks" },
    { id: "subtitle", label: "Subtítulos" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold mb-1">Mi <span className="gradient-text">Biblioteca</span></h1>
        <p className="text-sm text-white/50">Historial de todas tus creaciones</p>
      </div>
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {typeFilters.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={`px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${filter === f.id ? "bg-[#3b82f6] text-white" : "bg-white/5 text-white/50 hover:bg-white/10"}`}>{f.label}</button>
        ))}
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-20 text-white/30"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando...</div>
      ) : gens.length === 0 ? (
        <div className="text-center py-20 text-white/20"><LibraryIcon className="w-12 h-12 mx-auto mb-3 opacity-50" /><p className="text-sm">No hay creaciones todavía</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {gens.map((g) => (
            <div key={g.id} className="rounded-2xl border border-white/[0.06] bg-[#0f1629] overflow-hidden">
              {g.type === "image" && g.result.startsWith("/") ? (
                <img src={g.result} alt="" className="w-full aspect-square object-cover" />
              ) : g.type === "voice" && g.result.startsWith("/") ? (
                <div className="p-4 bg-white/[0.02]"><audio controls src={g.result} className="w-full" /></div>
              ) : (
                <div className="p-4 max-h-40 overflow-y-auto"><pre className="text-xs text-white/50 whitespace-pre-wrap">{g.result.substring(0, 500)}</pre></div>
              )}
              <div className="p-3 border-t border-white/[0.06]">
                <p className="text-sm font-medium truncate">{g.title}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] text-white/30 flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(g.createdAt).toLocaleDateString("es-ES")}</p>
                  <span className="text-[10px] text-white/30">-{g.credits} <Coins className="inline w-3 h-3" /></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════ Main App ════════════ */
interface AppShellProps { onLogout: () => void; user?: User | null }

const FALLBACK_USER: User = { id: "demo-fallback", name: "Usuario Demo", email: "demo@krea.ai", credits: 50, plan: "starter" };

export default function AppPage({ onLogout, user: initialUser }: AppShellProps) {
  const [user, setUser] = useState<User>(() => {
    if (initialUser) return initialUser;
    try {
      const saved = localStorage.getItem("p360_user");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) return parsed;
      }
    } catch {}
    // Always ensure a user exists — save fallback to localStorage
    localStorage.setItem("p360_token", FALLBACK_USER.id);
    localStorage.setItem("p360_user", JSON.stringify(FALLBACK_USER));
    return FALLBACK_USER;
  });
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [generations, setGenerations] = useState<Generation[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("p360_token");
    if (token) {
      fetch("/api/generations?limit=10", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : [])
        .then(setGenerations)
        .catch(() => {});
    }
  }, []);

  const logout = () => { localStorage.removeItem("p360_token"); localStorage.removeItem("p360_user"); onLogout(); };
  const refreshUser = async () => {
    const token = localStorage.getItem("p360_token");
    if (!token) return;
    try {
      const res = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setUser(await res.json());
    } catch {}
  };
  const onUpdateCredits = (c: number) => { setUser(prev => ({ ...prev, credits: c })); };

  const renderPage = () => {
    switch (page) {
      case "dashboard": return <Dashboard user={user} generations={generations} onNav={setPage} />;
      case "prompts": return <PromptChat user={user} onUpdateCredits={onUpdateCredits} />;
      case "images": return <ImageGenerator user={user} onUpdateCredits={onUpdateCredits} />;
      case "copy": case "social": case "script": case "email": return <TextGenerator type={page} user={user} onUpdateCredits={onUpdateCredits} />;
      case "voice": return <VoiceGenerator user={user} onUpdateCredits={onUpdateCredits} />;
      case "ebook": return <EbookGenerator user={user} onUpdateCredits={onUpdateCredits} />;
      case "subtitle": return <SubtitleGenerator user={user} onUpdateCredits={onUpdateCredits} />;
      case "metrics": return <MetricsTracker userId={user.id} />;
      case "library": return <Library user={user} />;
      case "settings": return <SettingsPage user={user} />;
      case "support": return <SupportPage />;
      case "adn": return <AdnDashboard user={user} />;
      default: return <Dashboard user={user} generations={generations} onNav={setPage} />;
    }
  };

  return (
    <AuthCtx.Provider value={{ user, logout, refreshUser }}>
      <div className="min-h-screen bg-[#080c16] flex">
        <Sidebar active={page} onNav={setPage} open={sidebarOpen} onClose={() => setSidebarOpen(false)} user={user} />
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Top bar */}
          <header className="sticky top-0 z-30 flex items-center gap-4 px-4 sm:px-6 py-3 border-b border-white/[0.06] backdrop-blur-xl bg-[#080c16]/80">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-white/50 hover:text-white">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-400/10 text-yellow-400 text-xs font-bold">
                <Coins className="w-3.5 h-3.5" /> {user.credits}
              </div>
              <button onClick={logout} className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors" title="Cerrar sesión">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </header>
          {/* Content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
            {renderPage()}
          </main>
        </div>
      </div>
    </AuthCtx.Provider>
  );
}