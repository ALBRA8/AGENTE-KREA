"use client";

import { useState, useEffect } from "react";
import AppShell from "@/components/app/AppShell";
import AuthPage from "@/components/app/AuthPage";

export default function StudioPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function autoLogin() {
      try {
        const res = await fetch("/api/auth/auto-login", { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          localStorage.setItem("p360_token", data.id);
          localStorage.setItem("p360_user", JSON.stringify(data));
          if (!cancelled) setUser(data);
        }
      } catch {}
      if (!cancelled) setLoading(false);
    }

    async function restoreSession() {
      // Yield a microtask so setState never runs synchronously inside the effect
      await Promise.resolve();
      if (cancelled) return;

      const savedUser = localStorage.getItem("p360_user");
      const savedToken = localStorage.getItem("p360_token");

      if (savedToken && savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          setUser(parsed);
          setLoading(false);
        } catch {
          await autoLogin();
        }
      } else {
        await autoLogin();
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080c16] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage onLogin={(u) => { if (u) setUser(u); }} />;
  }

  return <AppShell user={user} onLogout={() => setUser(null)} />;
}
