"use client";

import { useState } from "react";
import { Send, Copy, Check, Paperclip } from "lucide-react";

export default function SupportPage() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setLoading(true);
    // Simulate send — in production this would call an API
    await new Promise(r => setTimeout(r, 1000));
    setLoading(false);
    setSent(true);
    setSubject("");
    setMessage("");
    setTimeout(() => setSent(false), 4000);
  };

  const copyEmail = () => {
    navigator.clipboard.writeText("soporte@productor360.com");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold mb-1"><span className="gradient-text">Soporte</span></h1>
        <p className="text-sm text-white/50">Caja de sugerencias y soporte</p>
      </div>

      <div className="max-w-xl space-y-6">
        <div className="rounded-2xl border border-white/[0.06] bg-[#0f1629] p-6">
          {sent && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 text-sm text-center">
              ✅ Mensaje enviado correctamente. Te responderemos pronto.
            </div>
          )}

          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">ASUNTO</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} required className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#3b82f6] transition-colors" placeholder="Describe tu problema o sugerencia" />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">MENSAJE</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} required rows={6} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#3b82f6] transition-colors resize-none" placeholder="Escribe tu mensaje detallado aquí..." />
            </div>

            <div>
              <label className="text-xs text-white/50 mb-1.5 block">ADJUNTAR ARCHIVO (opcional)</label>
              <label className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-dashed border-white/10 text-white/40 text-sm cursor-pointer hover:border-white/20 hover:text-white/60 transition-colors">
                <Paperclip className="w-4 h-4" /> Elegir archivo
                <input type="file" className="hidden" />
              </label>
            </div>

            <button type="submit" disabled={loading || !subject.trim() || !message.trim()} className="w-full py-3.5 rounded-xl bg-gradient-to-b from-[#3b82f6] to-[#1e40af] text-white font-bold text-sm shadow-[0_10px_24px_rgba(30,64,175,0.45)] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <><Send className="w-4 h-4 animate-pulse" /> Enviando...</> : <><Send className="w-4 h-4" /> Enviar mensaje</>}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-[#0f1629] p-5">
          <p className="text-sm font-semibold mb-2">¿Prefieres escribir por email?</p>
          <p className="text-xs text-white/40 mb-3">También puedes contactarnos directamente por correo electrónico.</p>
          <button onClick={copyEmail} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/[0.06] text-sm text-white/60 hover:text-white hover:bg-white/10 transition-all">
            {copied ? <><Check className="w-4 h-4 text-emerald-400" /> <span className="text-emerald-400">Copiado</span></> : <><Copy className="w-4 h-4" /> soporte@productor360.com</>}
          </button>
        </div>
      </div>
    </div>
  );
}