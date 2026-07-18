"use client";

import { useState, useEffect } from "react";
import AppShell from "@/components/app/AppShell";
import AuthPage from "@/components/app/AuthPage";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try existing session first
    const savedUser = localStorage.getItem("p360_user");
    const savedToken = localStorage.getItem("p360_token");

    if (savedToken && savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        setLoading(false);
      } catch {
        autoLogin();
        return;
      }
    } else {
      autoLogin();
    }
  }, []);

  async function autoLogin() {
    try {
      const res = await fetch("/api/auth/auto-login", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("p360_token", data.id);
        localStorage.setItem("p360_user", JSON.stringify(data));
        setUser(data);
      }
    } catch {}
    setLoading(false);
  }

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