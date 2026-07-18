"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";

type View = "login" | "register";

interface AuthPageProps { onLogin: () => void }

export default function AuthPage({ onLogin }: AuthPageProps) {
  const [view, setView] = useState<View>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = view === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = view === "login" ? { email, password } : { name, email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error");
        setLoading(false);
        return;
      }

      localStorage.setItem("p360_token", data.id);
      localStorage.setItem("p360_user", JSON.stringify(data));
      onLogin();
    } catch {
      setError("Error de conexión");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[#080c16]" />
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-30" style={{ background: "radial-gradient(circle, rgba(124,58,237,0.35) 0%, transparent 70%)" }} />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full opacity-20" style={{ background: "radial-gradient(circle, rgba(37,99,235,0.3) 0%, transparent 70%)" }} />

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/productor360-logo.png" alt="Logo" className="h-16 w-16 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-extrabold">Productor <span className="gradient-text">360</span></h1>
          <p className="text-sm text-white/50 mt-1">Tu fábrica de contenido con IA</p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#0f1629] p-6">
          <div className="flex gap-1 p-1 rounded-xl bg-white/5 mb-6">
            {(["login", "register"] as View[]).map((v) => (
              <button key={v} onClick={() => { setView(v); setError(""); }} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${view === v ? "bg-gradient-to-r from-[#3b82f6] to-[#7c3aed] text-white" : "text-white/50 hover:text-white/70"}`}>
                {v === "login" ? "Iniciar sesión" : "Crear cuenta"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {view === "register" && (
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Nombre completo</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#3b82f6] transition-colors" placeholder="Tu nombre" />
              </div>
            )}
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#3b82f6] transition-colors" placeholder="tu@email.com" />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Contraseña</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#3b82f6] transition-colors pr-12" placeholder="Mínimo 6 caracteres" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-red-400 text-xs text-center bg-red-400/10 rounded-lg py-2">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl bg-gradient-to-b from-[#3b82f6] to-[#1e40af] text-white font-bold text-sm shadow-[0_10px_24px_rgba(30,64,175,0.45)] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{view === "login" ? "Iniciar sesión" : "Crear mi cuenta"} <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
          {view === "register" && <p className="text-xs text-white/30 text-center mt-4">Al registrarte recibes <span className="text-[#3b82f6] font-semibold">50 créditos gratuitos</span> para empezar a crear</p>}
        </div>
      </motion.div>
    </div>
  );
}