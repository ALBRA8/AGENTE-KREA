"use client";

import { useState, useEffect } from "react";
import AuthPage from "@/components/app/AuthPage";
import AppShell from "@/components/app/AppShell";

export default function DashboardPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("p360_token");
    const userData = localStorage.getItem("p360_user");
    setAuthed(!!token && !!userData);
  }, []);

  // Loading state
  if (authed === null) {
    return (
      <div className="min-h-screen bg-[#080c16] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authed) {
    return <AuthPage onLogin={() => setAuthed(true)} />;
  }

  return <AppShell onLogout={() => setAuthed(false)} />;
}