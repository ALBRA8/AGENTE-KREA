"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, Target, BookOpen, Lightbulb, Sparkles, ChevronRight,
  Loader2, Check, X, Circle, ArrowRight, Plus, Eye, Zap,
  FileText, Layers, Brain, Palette, Layout, FileCode2,
  ShieldCheck, Wrench, RefreshCw, Clock, TrendingUp,
  AlertTriangle, ThumbsUp, ThumbsDown, Play, Pause,
  Archive, Trash2, Building2, Rocket, FlaskConical,
  PenTool, BookMarked, CheckCircle2, XCircle, AlertCircle,
  Beaker, Handshake, Gauge, MessageSquare, Star, ChevronDown,
  Globe, Users, Hash, Box, Library, Workflow, Milestone,
  ClipboardCheck, Package, Flag, Send,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* ════════════ Types ════════════ */

interface User {
  id: string;
  name: string;
  email: string;
  credits: number;
  plan: string;
}

interface Opportunity {
  id: string;
  domain: string;
  problem: string;
  audience?: string;
  status: "DETECTED" | "ANALYZING" | "ANALYZED" | "DISMISSED" | "APPROVED";
  createdAt: string;
  fitScore?: number;
  fitDecision?: "BUILD" | "VALIDATE_FIRST" | "DO_NOT_BUILD";
  fitExplanation?: string;
}

type DossierStatus =
  | "IDEA" | "RESEARCHING" | "VALIDATING" | "APPROVED"
  | "ARCHITECTING" | "SPECIFIED" | "BUILDING" | "QA"
  | "READY" | "LAUNCHED" | "ITERATING" | "PAUSED"
  | "KILLED" | "ARCHIVED";

interface Evidence {
  id: string;
  claim: string;
  truthLevel: "confirmed" | "likely" | "unverified" | "refuted";
  source: string;
}

interface Dossier {
  id: string;
  title: string;
  description?: string;
  domain?: string;
  format?: string;
  status: DossierStatus;
  createdAt: string;
  updatedAt: string;
  evidence?: Evidence[];
  architecture?: {
    MUST: string[];
    SHOULD: string[];
    COULD: string[];
    OUT: string[];
  };
}

type BookStepStatus = "pending" | "running" | "completed" | "failed";

interface BookStep {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  status: BookStepStatus;
}

interface BookPipeline {
  id: string;
  title: string;
  steps: BookStep[];
  overallProgress: number;
  status: "idle" | "running" | "completed" | "failed";
}

interface Learning {
  id: string;
  source: string;
  insight: string;
  confidence: number;
  validated: boolean;
  createdAt: string;
}

/* ════════════ Constants ════════════ */

const OPP_STATUS_COLORS: Record<Opportunity["status"], string> = {
  DETECTED: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  ANALYZING: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  ANALYZED: "bg-green-500/15 text-green-400 border-green-500/20",
  DISMISSED: "bg-gray-500/15 text-gray-400 border-gray-500/20",
  APPROVED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
};

const DOSSIER_STATUS_COLORS: Record<DossierStatus, string> = {
  IDEA: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  RESEARCHING: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  VALIDATING: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  APPROVED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  ARCHITECTING: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  SPECIFIED: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  BUILDING: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  QA: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  READY: "bg-green-500/15 text-green-400 border-green-500/20",
  LAUNCHED: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  ITERATING: "bg-teal-500/15 text-teal-400 border-teal-500/20",
  PAUSED: "bg-gray-500/15 text-gray-400 border-gray-500/20",
  KILLED: "bg-red-500/15 text-red-400 border-red-500/20",
  ARCHIVED: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
};

const LIFECYCLE_STAGES: DossierStatus[] = [
  "IDEA", "RESEARCHING", "VALIDATING", "APPROVED",
  "ARCHITECTING", "SPECIFIED", "BUILDING", "QA",
  "READY", "LAUNCHED",
];

const TRUTH_COLORS: Record<Evidence["truthLevel"], string> = {
  confirmed: "text-emerald-400",
  likely: "text-blue-400",
  unverified: "text-yellow-400",
  refuted: "text-red-400",
};

const BOOK_STEPS_TEMPLATE: Omit<BookStep, "status">[] = [
  { name: "Arquitectura", icon: Layers },
  { name: "Contenido", icon: FileText },
  { name: "Dirección Artística", icon: Palette },
  { name: "Portada", icon: BookOpen },
  { name: "Editorial", icon: PenTool },
  { name: "Layout", icon: Layout },
  { name: "PDF", icon: FileCode2 },
  { name: "Visual QA", icon: Eye },
  { name: "Reparación", icon: Wrench },
  { name: "Final", icon: CheckCircle2 },
];

const FIT_DECISION_COLORS: Record<string, string> = {
  BUILD: "text-emerald-400",
  VALIDATE_FIRST: "text-amber-400",
  DO_NOT_BUILD: "text-red-400",
};

const FIT_DECISION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  BUILD: Rocket,
  VALIDATE_FIRST: FlaskConical,
  DO_NOT_BUILD: AlertTriangle,
};

/* ════════════ Tab Definitions ════════════ */

const TABS = [
  { id: "opportunities", label: "Oportunidades", icon: Search },
  { id: "products", label: "Productos", icon: Package },
  { id: "books", label: "Book Factory", icon: BookOpen },
  { id: "learnings", label: "Learnings", icon: Lightbulb },
] as const;

type TabId = (typeof TABS)[number]["id"];

/* ════════════ Helper Components ════════════ */

function GradientText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`bg-gradient-to-r from-[#3b82f6] to-[#7c3aed] bg-clip-text text-transparent ${className}`}>
      {children}
    </span>
  );
}

function StatusBadge({ status, colorClass }: { status: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${colorClass}`}>
      {status}
    </span>
  );
}

function ActionButton({
  label,
  icon: Icon,
  onClick,
  loading = false,
  variant = "primary",
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  const base = "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50";
  const variants = {
    primary: "bg-gradient-to-r from-[#3b82f6] to-[#7c3aed] hover:from-[#2563eb] hover:to-[#6d28d9] text-white shadow-lg shadow-blue-500/20",
    secondary: "bg-white/5 hover:bg-white/10 text-white/70 border border-white/[0.06]",
    danger: "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20",
  };

  return (
    <button onClick={onClick} disabled={loading} className={`${base} ${variants[variant]}`}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {label}
    </button>
  );
}

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-5 rounded-2xl bg-[#0f1629] border border-white/[0.06] ${className}`}>
      {children}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-white/20" />
      </div>
      <p className="text-sm font-medium text-white/40 mb-1">{title}</p>
      <p className="text-xs text-white/20 max-w-xs">{description}</p>
    </div>
  );
}

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-white/50 mb-1.5">{label}</label>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-white/5 border border-white/[0.06] rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#3b82f6]/40 focus:ring-1 focus:ring-[#3b82f6]/20 transition-all ${Icon ? "pl-10" : "pl-3"} pr-3 py-2.5`}
        />
      </div>
    </div>
  );
}

/* ════════════ Main Component ════════════ */

export default function ProductDashboard({ user }: { user: User }) {
  const [activeTab, setActiveTab] = useState<TabId>("opportunities");

  /* ── Opportunities state ── */
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [oppDomain, setOppDomain] = useState("");
  const [oppProblem, setOppProblem] = useState("");
  const [oppAudience, setOppAudience] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [evaluatingFit, setEvaluatingFit] = useState<string | null>(null);
  const [selectedOpp, setSelectedOpp] = useState<string | null>(null);

  /* ── Products state ── */
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [selectedDossier, setSelectedDossier] = useState<string | null>(null);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newFormat, setNewFormat] = useState("ebook");
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  /* ── Book Factory state ── */
  const [bookTitle, setBookTitle] = useState("");
  const [bookTopic, setBookTopic] = useState("");
  const [bookAudience, setBookAudience] = useState("");
  const [bookChapters, setBookChapters] = useState("8");
  const [bookPipelines, setBookPipelines] = useState<BookPipeline[]>([]);
  const [creatingBook, setCreatingBook] = useState(false);
  const [executingPipeline, setExecutingPipeline] = useState<string | null>(null);

  /* ── Learnings state ── */
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [applyingLearning, setApplyingLearning] = useState<string | null>(null);

  /* ════════════ Data Fetching ════════════ */

  const fetchOpportunities = useCallback(async () => {
    try {
      const res = await fetch("/api/product/opportunities");
      if (res.ok) {
        const data = await res.json();
        setOpportunities(data.opportunities || []);
      }
    } catch {}
  }, []);

  const fetchDossiers = useCallback(async () => {
    try {
      const res = await fetch("/api/product/dossiers");
      if (res.ok) {
        const data = await res.json();
        setDossiers(data.dossiers || []);
      }
    } catch {}
  }, []);

  const fetchLearnings = useCallback(async () => {
    try {
      const res = await fetch("/api/adn/feedback?limit=10");
      if (res.ok) {
        const data = await res.json();
        setLearnings(data.feedback || data.learnings || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await Promise.all([fetchOpportunities(), fetchDossiers(), fetchLearnings()]);
    })();
    return () => { cancelled = true; };
  }, [fetchOpportunities, fetchDossiers, fetchLearnings]);

  /* ════════════ Action Handlers ════════════ */

  const handleDetectOpportunity = async () => {
    if (!oppDomain.trim() || !oppProblem.trim()) return;
    setDetecting(true);
    try {
      const res = await fetch("/api/product/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: oppDomain, problem: oppProblem, audience: oppAudience || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setOpportunities((prev) => [data.opportunity, ...prev]);
        setOppDomain("");
        setOppProblem("");
        setOppAudience("");
      }
    } catch {} finally {
      setDetecting(false);
    }
  };

  const handleEvaluateFit = async (oppId: string) => {
    setEvaluatingFit(oppId);
    try {
      const res = await fetch("/api/product/fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: oppId }),
      });
      if (res.ok) {
        const data = await res.json();
        setOpportunities((prev) =>
          prev.map((o) => (o.id === oppId ? { ...o, ...data.fit, status: "ANALYZED" as const } : o))
        );
      }
    } catch {} finally {
      setEvaluatingFit(null);
    }
  };

  const handleCreateProduct = async () => {
    if (!newTitle.trim()) return;
    setCreatingProduct(true);
    try {
      const res = await fetch("/api/product/dossiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, description: newDesc, domain: newDomain, format: newFormat }),
      });
      if (res.ok) {
        const data = await res.json();
        setDossiers((prev) => [data.dossier, ...prev]);
        setShowNewProduct(false);
        setNewTitle("");
        setNewDesc("");
        setNewDomain("");
        setNewFormat("ebook");
      }
    } catch {} finally {
      setCreatingProduct(false);
    }
  };

  const handleDossierAction = async (dossierId: string, action: string, endpoint: string) => {
    setActionLoading(dossierId + action);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dossierId }),
      });
      if (res.ok) {
        const data = await res.json();
        setDossiers((prev) =>
          prev.map((d) => (d.id === dossierId ? { ...d, ...data.dossier, updatedAt: new Date().toISOString() } : d))
        );
      }
    } catch {} finally {
      setActionLoading(null);
    }
  };

  const handleCreateBook = async () => {
    if (!bookTitle.trim() || !bookTopic.trim()) return;
    setCreatingBook(true);
    try {
      const steps: BookStep[] = BOOK_STEPS_TEMPLATE.map((s) => ({ ...s, status: "pending" as BookStepStatus }));
      const pipeline: BookPipeline = {
        id: `book-${Date.now()}`,
        title: bookTitle,
        steps,
        overallProgress: 0,
        status: "idle",
      };
      setBookPipelines((prev) => [pipeline, ...prev]);
      setBookTitle("");
      setBookTopic("");
      setBookAudience("");
      setBookChapters("8");
    } catch {} finally {
      setCreatingBook(false);
    }
  };

  const handleExecutePipeline = async (pipelineId: string) => {
    setExecutingPipeline(pipelineId);
    setBookPipelines((prev) =>
      prev.map((p) => (p.id === pipelineId ? { ...p, status: "running" as const } : p))
    );

    try {
      const pipeline = bookPipelines.find((p) => p.id === pipelineId);
      if (!pipeline) return;

      const res = await fetch("/api/product/produce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "ebook",
          title: pipeline.title,
          pipelineId,
        }),
      });

      if (res.ok) {
        /* Simulate step progression for visual feedback */
        const stepsCopy = [...pipeline.steps];
        for (let i = 0; i < stepsCopy.length; i++) {
          setBookPipelines((prev) =>
            prev.map((p) => {
              if (p.id !== pipelineId) return p;
              const updated = { ...p, steps: [...p.steps] };
              updated.steps[i] = { ...updated.steps[i], status: "running" as BookStepStatus };
              return updated;
            })
          );
          await new Promise((r) => setTimeout(r, 800));
          setBookPipelines((prev) =>
            prev.map((p) => {
              if (p.id !== pipelineId) return p;
              const updated = { ...p, steps: [...p.steps] };
              updated.steps[i] = { ...updated.steps[i], status: "completed" as BookStepStatus };
              updated.overallProgress = Math.round(((i + 1) / updated.steps.length) * 100);
              return updated;
            })
          );
        }
        setBookPipelines((prev) =>
          prev.map((p) => (p.id === pipelineId ? { ...p, status: "completed" as const } : p))
        );
      }
    } catch {} finally {
      setExecutingPipeline(null);
    }
  };

  const handleApplyLearning = async (learningId: string) => {
    setApplyingLearning(learningId);
    try {
      await new Promise((r) => setTimeout(r, 1000));
      setLearnings((prev) =>
        prev.map((l) => (l.id === learningId ? { ...l, validated: true } : l))
      );
    } catch {} finally {
      setApplyingLearning(null);
    }
  };

  /* ════════════ Derived ════════════ */

  const dossier = dossiers.find((d) => d.id === selectedDossier);
  const selectedOpportunity = opportunities.find((o) => o.id === selectedOpp);

  /* ════════════ Render ════════════ */

  return (
    <div className="min-h-screen bg-[#080c16]">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold mb-1">
          <GradientText>Product Dashboard</GradientText>
        </h1>
        <p className="text-sm text-white/40">
          Descubre, valida y produce — todo desde un solo lugar
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-gradient-to-r from-[#3b82f6]/20 to-[#7c3aed]/10 text-white border border-[#3b82f6]/20"
                : "text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "opportunities" && renderOpportunities()}
          {activeTab === "products" && renderProducts()}
          {activeTab === "books" && renderBookFactory()}
          {activeTab === "learnings" && renderLearnings()}
        </motion.div>
      </AnimatePresence>
    </div>
  );

  /* ════════════ Tab: Oportunidades ════════════ */

  function renderOpportunities() {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left: Form + List */}
        <div className="lg:col-span-2 space-y-5">
          {/* Detection Form */}
          <SectionCard>
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
              <Search className="w-4 h-4 text-[#3b82f6]" />
              Detectar Oportunidad
            </h3>
            <div className="space-y-3">
              <FormInput label="Dominio" value={oppDomain} onChange={setOppDomain} placeholder="ej: marketing digital" icon={Globe} />
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Problema</label>
                <textarea
                  value={oppProblem}
                  onChange={(e) => setOppProblem(e.target.value)}
                  placeholder="Describe el problema que quieres resolver..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/[0.06] rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#3b82f6]/40 focus:ring-1 focus:ring-[#3b82f6]/20 transition-all p-3 resize-none"
                />
              </div>
              <FormInput label="Audiencia (opcional)" value={oppAudience} onChange={setOppAudience} placeholder="ej: startups B2B SaaS" icon={Users} />
              <ActionButton
                label="Detectar Oportunidad"
                icon={Sparkles}
                onClick={handleDetectOpportunity}
                loading={detecting}
              />
            </div>
          </SectionCard>

          {/* Opportunity List */}
          <SectionCard>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              Oportunidades
              <span className="ml-auto text-xs text-white/30">{opportunities.length}</span>
            </h3>
            {opportunities.length === 0 ? (
              <EmptyState icon={Target} title="Sin oportunidades" description="Usa el formulario para detectar nuevas oportunidades de producto" />
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
                {opportunities.map((opp) => (
                  <button
                    key={opp.id}
                    onClick={() => setSelectedOpp(selectedOpp === opp.id ? null : opp.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      selectedOpp === opp.id
                        ? "bg-[#3b82f6]/5 border-[#3b82f6]/20"
                        : "bg-white/[0.02] border-white/[0.04] hover:border-white/[0.08]"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <StatusBadge status={opp.status} colorClass={OPP_STATUS_COLORS[opp.status]} />
                      <span className="text-[10px] text-white/20 ml-auto">
                        {new Date(opp.createdAt).toLocaleDateString("es-ES")}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-white/70 truncate">{opp.problem}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">{opp.domain}</p>
                  </button>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right: Fit Evaluation */}
        <div className="lg:col-span-3">
          <SectionCard className="min-h-[300px]">
            {selectedOpportunity ? (
              <div>
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-violet-400" />
                  Evaluación de Fit
                </h3>

                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <p className="text-xs text-white/40 mb-1">Problema</p>
                    <p className="text-sm text-white/80">{selectedOpportunity.problem}</p>
                    <p className="text-xs text-white/30 mt-2">Dominio: {selectedOpportunity.domain}</p>
                    {selectedOpportunity.audience && (
                      <p className="text-xs text-white/30">Audiencia: {selectedOpportunity.audience}</p>
                    )}
                  </div>

                  {selectedOpportunity.fitScore !== undefined ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="space-y-4"
                    >
                      {/* Score */}
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <div className="relative w-20 h-20">
                            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                              <path
                                d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="rgba(255,255,255,0.05)"
                                strokeWidth="3"
                              />
                              <path
                                d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke={selectedOpportunity.fitScore >= 70 ? "#10b981" : selectedOpportunity.fitScore >= 40 ? "#f59e0b" : "#ef4444"}
                                strokeWidth="3"
                                strokeDasharray={`${selectedOpportunity.fitScore}, 100`}
                                strokeLinecap="round"
                              />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-lg font-extrabold">
                              {selectedOpportunity.fitScore}
                            </span>
                          </div>
                          <p className="text-[10px] text-white/30 mt-1">Fit Score</p>
                        </div>

                        {/* Decision */}
                        <div className="flex-1">
                          {selectedOpportunity.fitDecision && (
                            <div className="flex items-center gap-3 mb-2">
                              {(() => {
                                const DecIcon = FIT_DECISION_ICONS[selectedOpportunity.fitDecision] || AlertCircle;
                                return <DecIcon className={`w-5 h-5 ${FIT_DECISION_COLORS[selectedOpportunity.fitDecision]}`} />;
                              })()}
                              <span className={`text-lg font-bold ${FIT_DECISION_COLORS[selectedOpportunity.fitDecision]}`}>
                                {selectedOpportunity.fitDecision === "BUILD" ? "BUILD →" :
                                 selectedOpportunity.fitDecision === "VALIDATE_FIRST" ? "VALIDATE FIRST" : "DO NOT BUILD"}
                              </span>
                            </div>
                          )}
                          {selectedOpportunity.fitExplanation && (
                            <p className="text-xs text-white/40 leading-relaxed">{selectedOpportunity.fitExplanation}</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="flex flex-col items-center py-8">
                      <p className="text-sm text-white/30 mb-4">Evalúa el fit de esta oportunidad</p>
                      <ActionButton
                        label="Evaluar Fit"
                        icon={Brain}
                        onClick={() => handleEvaluateFit(selectedOpportunity.id)}
                        loading={evaluatingFit === selectedOpportunity.id}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Brain}
                title="Selecciona una oportunidad"
                description="Haz click en una oportunidad de la lista para evaluar su fit y obtener una recomendación"
              />
            )}
          </SectionCard>
        </div>
      </div>
    );
  }

  /* ════════════ Tab: Productos ════════════ */

  function renderProducts() {
    if (selectedDossier && dossier) {
      return renderDossierDetail();
    }

    return (
      <div>
        {/* Header + New Product */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Package className="w-4 h-4 text-[#3b82f6]" />
            Dossiers de Producto
            <span className="text-xs text-white/30 ml-1">({dossiers.length})</span>
          </h3>
          <ActionButton
            label="Nuevo Producto"
            icon={Plus}
            onClick={() => setShowNewProduct(true)}
            variant="secondary"
          />
        </div>

        {/* New Product Form */}
        <AnimatePresence>
          {showNewProduct && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-5"
            >
              <SectionCard>
                <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  Nuevo Producto
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormInput label="Título" value={newTitle} onChange={setNewTitle} placeholder="Nombre del producto" icon={FileText} />
                  <FormInput label="Dominio" value={newDomain} onChange={setNewDomain} placeholder="ej: productividad" icon={Globe} />
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-white/50 mb-1.5">Descripción</label>
                    <textarea
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="Describe tu producto..."
                      rows={2}
                      className="w-full bg-white/5 border border-white/[0.06] rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#3b82f6]/40 focus:ring-1 focus:ring-[#3b82f6]/20 transition-all p-3 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5">Formato</label>
                    <select
                      value={newFormat}
                      onChange={(e) => setNewFormat(e.target.value)}
                      className="w-full bg-white/5 border border-white/[0.06] rounded-xl text-sm text-white focus:outline-none focus:border-[#3b82f6]/40 p-2.5 appearance-none cursor-pointer"
                    >
                      <option value="ebook">eBook</option>
                      <option value="app">App</option>
                      <option value="saas">SaaS</option>
                      <option value="template">Template</option>
                      <option value="guide">Guide</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <ActionButton label="Crear" icon={Plus} onClick={handleCreateProduct} loading={creatingProduct} />
                  <ActionButton label="Cancelar" icon={X} onClick={() => setShowNewProduct(false)} variant="secondary" />
                </div>
              </SectionCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dossier List */}
        {dossiers.length === 0 ? (
          <SectionCard>
            <EmptyState icon={Package} title="Sin productos" description="Crea tu primer producto para comenzar el ciclo de vida completo" />
          </SectionCard>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {dossiers.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedDossier(d.id)}
                className="text-left p-4 rounded-2xl bg-[#0f1629] border border-white/[0.06] hover:border-[#3b82f6]/20 hover:bg-[#3b82f6]/5 transition-all group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <StatusBadge status={d.status} colorClass={DOSSIER_STATUS_COLORS[d.status]} />
                  {d.format && (
                    <span className="text-[10px] text-white/20 bg-white/5 px-1.5 py-0.5 rounded">
                      {d.format}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold mb-1 group-hover:text-white transition-colors">{d.title}</p>
                {d.description && (
                  <p className="text-[11px] text-white/30 line-clamp-2 mb-2">{d.description}</p>
                )}
                <div className="flex items-center gap-2 text-[10px] text-white/20">
                  <Clock className="w-3 h-3" />
                  {new Date(d.updatedAt).toLocaleDateString("es-ES")}
                </div>
                <ChevronRight className="w-4 h-4 text-white/10 group-hover:text-white/30 ml-auto transition-all" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ── Dossier Detail ── */

  function renderDossierDetail() {
    if (!dossier) return null;
    const lifecycleIdx = LIFECYCLE_STAGES.indexOf(dossier.status as DossierStatus);
    const lifecycleProgress = lifecycleIdx >= 0 ? ((lifecycleIdx + 1) / LIFECYCLE_STAGES.length) * 100 : 0;

    const STATUS_ACTIONS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; action: string; endpoint: string }[]> = {
      IDEA: [{ label: "Investigar", icon: Search, action: "research", endpoint: "/api/product/research" }],
      APPROVED: [{ label: "Arquitectar", icon: Layers, action: "architect", endpoint: "/api/product/architect" }],
      ARCHITECTING: [{ label: "Especificar", icon: FileCode2, action: "specify", endpoint: "/api/product/specify" }],
      SPECIFIED: [
        { label: "Producir", icon: Play, action: "produce", endpoint: "/api/product/produce" },
        { label: "Handoff", icon: Handshake, action: "handoff", endpoint: "/api/product/handoff" },
      ],
      QA: [{ label: "Verificar QA", icon: ShieldCheck, action: "qa", endpoint: "/api/product/qa" }],
    };

    const actions = STATUS_ACTIONS[dossier.status] || [];

    return (
      <div className="space-y-5">
        {/* Back */}
        <button
          onClick={() => setSelectedDossier(null)}
          className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Volver a productos
        </button>

        {/* Header */}
        <SectionCard>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status={dossier.status} colorClass={DOSSIER_STATUS_COLORS[dossier.status]} />
                {dossier.format && (
                  <span className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded">{dossier.format}</span>
                )}
              </div>
              <h2 className="text-lg font-extrabold">{dossier.title}</h2>
              {dossier.description && <p className="text-sm text-white/40 mt-1">{dossier.description}</p>}
            </div>

            {/* Action Buttons */}
            {actions.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {actions.map((a) => (
                  <ActionButton
                    key={a.action}
                    label={a.label}
                    icon={a.icon}
                    onClick={() => handleDossierAction(dossier.id, a.action, a.endpoint)}
                    loading={actionLoading === dossier.id + a.action}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Lifecycle Progress */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-white/30 mb-1.5">
              <span>Ciclo de Vida</span>
              <span>{Math.round(lifecycleProgress)}%</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#3b82f6] to-[#7c3aed] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${lifecycleProgress}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
            <div className="flex items-center gap-1 mt-2 overflow-x-auto pb-1">
              {LIFECYCLE_STAGES.map((stage, idx) => (
                <div
                  key={stage}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium whitespace-nowrap ${
                    idx <= lifecycleIdx
                      ? "bg-[#3b82f6]/10 text-[#3b82f6]"
                      : "text-white/15"
                  } ${stage === dossier.status ? "ring-1 ring-[#3b82f6]/40" : ""}`}
                >
                  {idx <= lifecycleIdx ? <Check className="w-2.5 h-2.5" /> : <Circle className="w-2.5 h-2.5" />}
                  {stage}
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* Evidence + Architecture */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Evidence */}
          <SectionCard>
            <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Evidencia
              {dossier.evidence && (
                <span className="text-xs text-white/30">({dossier.evidence.length})</span>
              )}
            </h4>
            {dossier.evidence && dossier.evidence.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {dossier.evidence.map((ev) => (
                  <div key={ev.id} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-semibold ${TRUTH_COLORS[ev.truthLevel]}`}>
                        {ev.truthLevel.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-white/20">← {ev.source}</span>
                    </div>
                    <p className="text-xs text-white/60">{ev.claim}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/20 py-4 text-center">Sin evidencia recogida aún</p>
            )}
          </SectionCard>

          {/* Architecture */}
          <SectionCard>
            <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-violet-400" />
              Arquitectura
            </h4>
            {dossier.architecture ? (
              <div className="space-y-3">
                {(["MUST", "SHOULD", "COULD", "OUT"] as const).map((layer) => {
                  const items = dossier.architecture?.[layer] || [];
                  if (items.length === 0) return null;
                  const layerColors = {
                    MUST: "text-red-400 border-red-500/20 bg-red-500/5",
                    SHOULD: "text-amber-400 border-amber-500/20 bg-amber-500/5",
                    COULD: "text-blue-400 border-blue-500/20 bg-blue-500/5",
                    OUT: "text-white/20 border-white/[0.04] bg-white/[0.02]",
                  };
                  return (
                    <div key={layer}>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border mb-1.5 ${layerColors[layer]}`}>
                        {layer}
                      </span>
                      <div className="space-y-1 ml-2">
                        {items.map((item, i) => (
                          <p key={i} className="text-xs text-white/50 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-white/20" />
                            {item}
                          </p>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-white/20 py-4 text-center">Arquitectura no definida aún</p>
            )}
          </SectionCard>
        </div>
      </div>
    );
  }

  /* ════════════ Tab: Book Factory ════════════ */

  function renderBookFactory() {
    return (
      <div className="space-y-5">
        {/* Create Book Form */}
        <SectionCard>
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
            <BookMarked className="w-4 h-4 text-orange-400" />
            Crear eBook
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <FormInput label="Título" value={bookTitle} onChange={setBookTitle} placeholder="Título del eBook" icon={BookOpen} />
            <FormInput label="Tema" value={bookTopic} onChange={setBookTopic} placeholder="ej: Growth Hacking" icon={Lightbulb} />
            <FormInput label="Audiencia" value={bookAudience} onChange={setBookAudience} placeholder="ej: emprendedores" icon={Users} />
            <FormInput label="Capítulos" value={bookChapters} onChange={setBookChapters} placeholder="8" type="number" icon={Hash} />
          </div>
          <div className="mt-4">
            <ActionButton
              label="Crear eBook"
              icon={Plus}
              onClick={handleCreateBook}
              loading={creatingBook}
            />
          </div>
        </SectionCard>

        {/* Pipelines */}
        {bookPipelines.length === 0 ? (
          <SectionCard>
            <EmptyState icon={Workflow} title="Sin pipelines" description="Crea un eBook para iniciar el pipeline de producción automatizado" />
          </SectionCard>
        ) : (
          <div className="space-y-4">
            {bookPipelines.map((pipeline) => (
              <SectionCard key={pipeline.id}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-bold">{pipeline.title}</h4>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                        pipeline.status === "completed" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" :
                        pipeline.status === "running" ? "bg-blue-500/15 text-blue-400 border-blue-500/20" :
                        pipeline.status === "failed" ? "bg-red-500/15 text-red-400 border-red-500/20" :
                        "bg-white/5 text-white/30 border-white/[0.06]"
                      }`}>
                        {pipeline.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-white/30">
                      <span>{pipeline.overallProgress}% completado</span>
                    </div>
                  </div>
                  {pipeline.status === "idle" && (
                    <ActionButton
                      label="Ejecutar Pipeline"
                      icon={Play}
                      onClick={() => handleExecutePipeline(pipeline.id)}
                      loading={executingPipeline === pipeline.id}
                    />
                  )}
                  {pipeline.status === "running" && (
                    <div className="flex items-center gap-2 text-sm text-blue-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Ejecutando...
                    </div>
                  )}
                  {pipeline.status === "completed" && (
                    <div className="flex items-center gap-2 text-sm text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      Completado
                    </div>
                  )}
                </div>

                {/* Overall Progress Bar */}
                <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-4">
                  <motion.div
                    className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
                    animate={{ width: `${pipeline.overallProgress}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>

                {/* Steps */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {pipeline.steps.map((step, idx) => (
                    <div
                      key={idx}
                      className={`relative p-2.5 rounded-xl border text-center transition-all ${
                        step.status === "completed"
                          ? "bg-emerald-500/5 border-emerald-500/20"
                          : step.status === "running"
                          ? "bg-blue-500/5 border-blue-500/20 ring-1 ring-blue-500/20"
                          : step.status === "failed"
                          ? "bg-red-500/5 border-red-500/20"
                          : "bg-white/[0.02] border-white/[0.04]"
                      }`}
                    >
                      <div className="flex justify-center mb-1.5">
                        {step.status === "completed" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : step.status === "running" ? (
                          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                        ) : step.status === "failed" ? (
                          <XCircle className="w-4 h-4 text-red-400" />
                        ) : (
                          <step.icon className="w-4 h-4 text-white/20" />
                        )}
                      </div>
                      <p className={`text-[10px] font-medium ${
                        step.status === "completed" ? "text-emerald-400" :
                        step.status === "running" ? "text-blue-400" :
                        step.status === "failed" ? "text-red-400" :
                        "text-white/30"
                      }`}>
                        {step.name}
                      </p>
                      {/* Step number */}
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#0f1629] border border-white/[0.06] flex items-center justify-center text-[8px] text-white/30">
                        {idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ════════════ Tab: Learnings ════════════ */

  function renderLearnings() {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            Learnings Recientes
            <span className="text-xs text-white/30 ml-1">({learnings.length})</span>
          </h3>
          <button
            onClick={fetchLearnings}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refrescar
          </button>
        </div>

        {learnings.length === 0 ? (
          <SectionCard>
            <EmptyState
              icon={Lightbulb}
              title="Sin learnings"
              description="Los learnings aparecerán aquí cuando el ADN capture feedback de las interacciones"
            />
          </SectionCard>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {learnings.map((learning) => (
              <SectionCard key={learning.id}>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-semibold text-white/30 bg-white/5 px-2 py-0.5 rounded-md">
                        {learning.source}
                      </span>
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400/60" />
                        <span className="text-[10px] text-amber-400/60">{Math.round(learning.confidence * 100)}%</span>
                      </div>
                      {learning.validated ? (
                        <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Validado
                        </span>
                      ) : (
                        <span className="text-[10px] text-white/20 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Pendiente
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white/70 leading-relaxed">{learning.insight}</p>
                    <p className="text-[10px] text-white/20 mt-2">
                      {new Date(learning.createdAt).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  {!learning.validated && (
                    <ActionButton
                      label="Aplicar"
                      icon={Zap}
                      onClick={() => handleApplyLearning(learning.id)}
                      loading={applyingLearning === learning.id}
                      variant="secondary"
                    />
                  )}
                </div>
              </SectionCard>
            ))}
          </div>
        )}
      </div>
    );
  }
}
