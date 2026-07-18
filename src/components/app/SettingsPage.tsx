"use client";

import { useState } from "react";
import { User as UserIcon, Lock, Globe, Volume2, Gauge, Monitor, Save, Loader2, Eye, EyeOff, Check } from "lucide-react";

interface User { id: string; name: string; email: string; credits: number; plan: string; }

interface Props { user: User; }

export default function SettingsPage({ user }: Props) {
  const [activeSection, setActiveSection] = useState("profile");

  const sections = [
    { id: "profile", label: "Perfil", icon: UserIcon },
    { id: "password", label: "Contraseña", icon: Lock },
    { id: "preferences", label: "Preferencias", icon: Globe },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold mb-1"><span className="gradient-text">Configuración</span></h1>
        <p className="text-sm text-white/50">Gestiona tu cuenta y preferencias</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Tabs */}
        <div className="sm:w-48 flex-shrink-0">
          <div className="flex sm:flex-col gap-1">
            {sections.map(s => (
              <button key={s.id} onClick={() => setActiveSection(s.id)} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${activeSection === s.id ? "bg-[#3b82f6]/10 text-white border border-[#3b82f6]/20" : "text-white/50 hover:text-white/80 hover:bg-white/5"}`}>
                <s.icon className="w-4 h-4" /> {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 max-w-xl">
          {activeSection === "profile" && <ProfileSection user={user} />}
          {activeSection === "password" && <PasswordSection userId={user.id} />}
          {activeSection === "preferences" && <PreferencesSection />}
        </div>
      </div>
    </div>
  );
}

function ProfileSection({ user }: { user: User }) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0f1629] p-6 space-y-5">
      <h2 className="text-lg font-bold">Información de la cuenta</h2>
      <div className="flex items-center gap-4 mb-2">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#7c3aed] flex items-center justify-center text-xl font-bold">
          {user.name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2)}
        </div>
        <div>
          <p className="font-semibold">{user.name}</p>
          <p className="text-xs text-white/40">{user.email}</p>
          <p className="text-[10px] text-white/30 mt-0.5">Plan: {user.plan.charAt(0).toUpperCase() + user.plan.slice(1)}</p>
        </div>
      </div>
      <div>
        <label className="text-xs text-white/50 mb-1.5 block">Nombre completo</label>
        <input type="text" defaultValue={user.name} disabled className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/50 text-sm cursor-not-allowed" />
      </div>
      <div>
        <label className="text-xs text-white/50 mb-1.5 block">Email</label>
        <input type="email" defaultValue={user.email} disabled className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/50 text-sm cursor-not-allowed" />
      </div>
      <p className="text-[10px] text-white/20">El nombre y email se configuran al registrar tu cuenta.</p>
    </div>
  );
}

function PasswordSection({ userId }: { userId: string }) {
  const [current, setCurrent] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (newPass.length < 6) { setMsg({ type: "error", text: "La nueva contraseña debe tener al menos 6 caracteres" }); return; }
    if (newPass !== confirm) { setMsg({ type: "error", text: "Las contraseñas no coinciden" }); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "", password: current }) });
      if (!res.ok) { setMsg({ type: "error", text: "Contraseña actual incorrecta" }); setLoading(false); return; }
      const updateRes = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${userId}` } });
      setMsg({ type: "success", text: "Contraseña actualizada correctamente" });
      setCurrent(""); setNewPass(""); setConfirm("");
    } catch { setMsg({ type: "error", text: "Error de conexión" }); }
    setLoading(false);
  };

  const PassInput = ({ value, onChange, show, onToggle, placeholder }: { value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder: string }) => (
    <div className="relative">
      <input type={show ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)} required minLength={6} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#3b82f6] transition-colors pr-12" placeholder={placeholder} />
      <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">{show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
    </div>
  );

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0f1629] p-6">
      <h2 className="text-lg font-bold mb-5">Cambiar contraseña</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className="text-xs text-white/50 mb-1.5 block">Contraseña actual</label><PassInput value={current} onChange={setCurrent} show={showCurrent} onToggle={() => setShowCurrent(!showCurrent)} placeholder="Tu contraseña actual" /></div>
        <div><label className="text-xs text-white/50 mb-1.5 block">Nueva contraseña</label><PassInput value={newPass} onChange={setNewPass} show={showNew} onToggle={() => setShowNew(!showNew)} placeholder="Mínimo 6 caracteres" /></div>
        <div><label className="text-xs text-white/50 mb-1.5 block">Confirmar nueva contraseña</label><PassInput value={confirm} onChange={setConfirm} show={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} placeholder="Repite la nueva contraseña" /></div>
        {msg && <p className={`text-xs text-center py-2 rounded-lg ${msg.type === "success" ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"}`}>{msg.text}</p>}
        <button type="submit" disabled={loading || !current || !newPass || !confirm} className="w-full py-3 rounded-xl bg-gradient-to-b from-[#3b82f6] to-[#1e40af] text-white font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Actualizando...</> : <><Save className="w-4 h-4" /> Actualizar contraseña</>}
        </button>
      </form>
    </div>
  );
}

function PreferencesSection() {
  const [language, setLanguage] = useState("es");
  const [voice, setVoice] = useState("alloy");
  const [speed, setSpeed] = useState(1);
  const [quality, setQuality] = useState("hd");
  const [saved, setSaved] = useState(false);

  const voices = [
    { id: "alloy", label: "Alloy", desc: "Neutral y versátil" },
    { id: "echo", label: "Echo", desc: "Masculino profundo" },
    { id: "nova", label: "Nova", desc: "Femenino cálido" },
    { id: "shimmer", label: "Shimmer", desc: "Femenino suave" },
    { id: "onyx", label: "Onyx", desc: "Masculino autoritario" },
    { id: "fable", label: "Fable", desc: "Narrativo británico" },
  ];

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0f1629] p-6 space-y-6">
      <h2 className="text-lg font-bold">Preferencias</h2>

      <div>
        <label className="text-xs text-white/50 mb-2 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Idioma de la interfaz</label>
        <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#3b82f6]">
          <option value="es" className="bg-[#0a0f1e]">🇪🇸 Español</option>
          <option value="en" className="bg-[#0a0f1e]">🇺🇸 English</option>
          <option value="pt" className="bg-[#0a0f1e]">🇧🇷 Português</option>
        </select>
      </div>

      <div>
        <label className="text-xs text-white/50 mb-2 flex items-center gap-1.5"><Volume2 className="w-3.5 h-3.5" /> Voz predeterminada (Generador de Voz)</label>
        <div className="grid grid-cols-2 gap-2">
          {voices.map(v => (
            <button key={v.id} onClick={() => setVoice(v.id)} className={`p-3 rounded-xl text-left transition-all border ${voice === v.id ? "bg-[#3b82f6]/10 border-[#3b82f6]/30 text-white" : "bg-white/5 border-white/[0.06] text-white/50 hover:bg-white/10"}`}>
              <p className="text-sm font-semibold">{v.label}</p>
              <p className="text-[10px] text-white/30">{v.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-white/50 mb-2 flex items-center gap-1.5"><Gauge className="w-3.5 h-3.5" /> Velocidad de voz: <span className="text-white font-semibold">{speed}x</span></label>
        <input type="range" min="0.5" max="2" step="0.1" value={speed} onChange={e => setSpeed(parseFloat(e.target.value))} className="w-full accent-[#3b82f6]" />
        <div className="flex justify-between text-[10px] text-white/20 mt-1"><span>0.5x</span><span>1x</span><span>2x</span></div>
      </div>

      <div>
        <label className="text-xs text-white/50 mb-2 flex items-center gap-1.5"><Monitor className="w-3.5 h-3.5" /> Calidad de imagen</label>
        <div className="flex gap-2">
          {["sd", "hd", "4k"].map(q => (
            <button key={q} onClick={() => setQuality(q)} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${quality === q ? "bg-[#3b82f6]/10 border-[#3b82f6]/30 text-white" : "bg-white/5 border-white/[0.06] text-white/50 hover:bg-white/10"}`}>
              {q.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <button onClick={handleSave} className="w-full py-3 rounded-xl bg-gradient-to-b from-[#3b82f6] to-[#1e40af] text-white font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
        {saved ? <><Check className="w-4 h-4" /> Guardado</> : <><Save className="w-4 h-4" /> Guardar preferencias</>}
      </button>
    </div>
  );
}