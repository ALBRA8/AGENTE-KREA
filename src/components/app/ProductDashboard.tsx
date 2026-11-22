"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Lightbulb, FolderOpen, Factory, Send, ChevronRight, Loader2,
  RefreshCw, Plus, Search, Eye, Play, CheckCircle2, AlertTriangle,
  XCircle, Clock, ArrowRight, Sparkles, FileText, BookOpen,
  Target, TrendingUp, Shield, Archive, MoreHorizontal,
  ExternalLink, Copy, Trash2, Zap, Globe, Users, DollarSign,
  Layers, Workflow, CheckCircle, Circle, HelpCircle, AlertCircle,
  Package, Rocket, BarChart3, FileArchive, Wrench, Monitor,
  Gauge, ThumbsUp, ThumbsDown, MessageSquare, Tag,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* ════════════ Types ════════════ */

interface Opportunity {
  id: string;
  name: string;
  productType: string;
  targetAudience: string;
  marketEvidence: string;
  status: string;
  fitScore?: number;
  recommendation?: string;
  createdAt: string;
}

interface Dossier {
  id: string;
  productName: string;
  productType: string;
  status: string;
  fitScore?: number;
  decision?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProductionJob {
  id: string;
  dossierId: string;
  productName: string;
  productType: string;
  status: string;
  progress: number;
  currentStep?: string;
  createdAt: string;
}

interface Handoff {
  id: string;
  dossierId: string;
  productName: string;
  provider: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface CommercialProduct {
  id: string;
  productId: string;
  productName: string;
  productType: string;
  monetizationModel: string;
  positioning: string;
  commercialReadiness?: string;
  evidence: string;
  createdAt: string;
  updatedAt: string;
}

interface FactoryExec {
  id: string;
  executionId: string;
  productId: string;
  factoryType: string;
  status: string;
  progress: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

interface Asset {
  id: string;
  assetId: string;
  productId: string;
  type: string;
  filename: string;
  mimeType: string;
  size: number;
  status: string;
  source: string;
  createdAt: string;
}

interface LaunchPkg {
  id: string;
  packageId: string;
  productId: string;
  corePromise: string;
  positioning: string;
  cta: string;
  evidence: string;
  generatedAt: string;
  createdAt: string;
}

type Section = "opportunities" | "dossiers" | "production" | "handoff" | "commercial" | "factory" | "assets" | "launch";

/* ════════════ Helpers ════════════ */

function getToken(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("p360_token") || "";
  }
  return "";
}

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

function statusColor(status: string): string {
  const s = status.toUpperCase();
  if (["COMPLETED", "GO", "PUBLISHED", "ACKNOWLEDGED"].includes(s)) return "text-emerald-400";
  if (["FAILED", "NO_GO", "ARCHIVED"].includes(s)) return "text-red-400";
  if (["RUNNING", "PRODUCING", "SENT", "CONDITIONAL_GO"].includes(s)) return "text-amber-400";
  if (["PENDING", "CREATED", "IDEA", "READY"].includes(s)) return "text-blue-400";
  return "text-white/50";
}

function statusBg(status: string): string {
  const s = status.toUpperCase();
  if (["COMPLETED", "GO", "PUBLISHED", "ACKNOWLEDGED"].includes(s)) return "bg-emerald-400/10 text-emerald-400 border-emerald-400/20";
  if (["FAILED", "NO_GO", "ARCHIVED"].includes(s)) return "bg-red-400/10 text-red-400 border-red-400/20";
  if (["RUNNING", "PRODUCING", "SENT", "CONDITIONAL_GO"].includes(s)) return "bg-amber-400/10 text-amber-400 border-amber-400/20";
  if (["PENDING", "CREATED", "IDEA", "READY"].includes(s)) return "bg-blue-400/10 text-blue-400 border-blue-400/20";
  return "bg-white/5 text-white/50 border-white/10";
}

function fitScoreColor(score: number): string {
  if (score >= 0.7) return "text-emerald-400";
  if (score >= 0.4) return "text-amber-400";
  return "text-red-400";
}

/* ════════════ Shared UI ════════════ */

function SectionHeader({ icon: Icon, title, subtitle, actions }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold mb-1 flex items-center gap-2">
          <Icon className="w-6 h-6 text-[#3b82f6]" />
          <span className="gradient-text">{title}</span>
        </h1>
        <p className="text-sm text-white/50">{subtitle}</p>
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusBg(status)}`}>
      {status}
    </span>
  );
}

function EmptyState({ icon: Icon, title, subtitle }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="text-center py-16 text-white/20">
      <Icon className="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p className="text-sm font-medium mb-1">{title}</p>
      <p className="text-xs text-white/30">{subtitle}</p>
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
      <p className="text-sm text-red-300 flex-1">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs text-red-300 hover:text-red-200 flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Reintentar
        </button>
      )}
    </div>
  );
}

/* ════════════ Opportunities Section ════════════ */

function OpportunitiesSection() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("ebook");
  const [formAudience, setFormAudience] = useState("");
  const [formEvidence, setFormEvidence] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = getToken();
      const res = await fetch("/api/product/opportunities", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al cargar oportunidades");
      const data = await res.json();
      setOpportunities(Array.isArray(data) ? data : data.opportunities || []);
    } catch (e: any) {
      setError(e.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const createOpportunity = async () => {
    setSubmitting(true);
    setFormError("");
    try {
      const token = getToken();
      const res = await fetch("/api/product/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: formName,
          productType: formType,
          targetAudience: formAudience,
          marketEvidence: formEvidence,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al crear oportunidad");
      }
      setShowForm(false);
      setFormName("");
      setFormAudience("");
      setFormEvidence("");
      load();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const productTypes = ["ebook", "software", "saas", "guide", "template", "kit"];

  return (
    <div>
      <SectionHeader
        icon={Lightbulb}
        title="Oportunidades"
        subtitle="Descubre y evalúa oportunidades de producto con Product Brain"
        actions={
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-xl bg-gradient-to-b from-[#3b82f6] to-[#1e40af] text-white font-bold text-xs shadow-[0_10px_24px_rgba(30,64,175,0.45)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Nueva Oportunidad
          </button>
        }
      />

      {/* Create Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="p-5 rounded-2xl bg-[#0f1629] border border-white/[0.06] space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#3b82f6]" /> Crear Oportunidad
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Nombre del producto</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#3b82f6] transition-colors"
                    placeholder="Ej: Guía de Marketing Digital 2025"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Tipo de producto</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#3b82f6]"
                  >
                    {productTypes.map((t) => (
                      <option key={t} value={t} className="bg-[#0a0f1e]">{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Audiencia objetivo</label>
                <input
                  type="text"
                  value={formAudience}
                  onChange={(e) => setFormAudience(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#3b82f6] transition-colors"
                  placeholder="Ej: Emprendedores digitales hispanohablantes"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Evidencia de mercado</label>
                <textarea
                  value={formEvidence}
                  onChange={(e) => setFormEvidence(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#3b82f6] transition-colors resize-none"
                  placeholder="Describe la evidencia de mercado que sustenta esta oportunidad..."
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={createOpportunity}
                  disabled={submitting || !formName}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-b from-[#3b82f6] to-[#1e40af] text-white font-bold text-xs shadow-[0_10px_24px_rgba(30,64,175,0.45)] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  {submitting ? "Evaluando..." : "Evaluar Oportunidad"}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 text-white/50 hover:text-white/80 text-xs transition-colors"
                >
                  Cancelar
                </button>
              </div>
              {formError && <p className="text-red-400 text-xs">{formError}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {error ? (
        <ErrorBanner message={error} onRetry={load} />
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-white/30">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando oportunidades...
        </div>
      ) : opportunities.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="Sin oportunidades aún"
          subtitle="Crea tu primera oportunidad para empezar a evaluar ideas de producto"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {opportunities.map((opp, i) => (
            <motion.div
              key={opp.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-4 rounded-2xl bg-[#0f1629] border border-white/[0.06] hover:border-[#3b82f6]/20 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3b82f6]/20 to-[#7c3aed]/20 flex items-center justify-center">
                    <Lightbulb className="w-4 h-4 text-[#3b82f6]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold truncate max-w-[180px]">{opp.name}</p>
                    <p className="text-[10px] text-white/30">{opp.productType}</p>
                  </div>
                </div>
                <StatusBadge status={opp.status} />
              </div>

              {opp.fitScore !== undefined && (
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-white/40">Fit Score</span>
                    <span className={`text-sm font-bold ${fitScoreColor(opp.fitScore)}`}>
                      {(opp.fitScore * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        opp.fitScore >= 0.7 ? "bg-emerald-400" : opp.fitScore >= 0.4 ? "bg-amber-400" : "bg-red-400"
                      }`}
                      style={{ width: `${opp.fitScore * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {opp.recommendation && (
                <p className="text-[10px] text-white/30 mb-2 truncate">
                  Recomendación: <span className="text-white/50">{opp.recommendation}</span>
                </p>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                <span className="text-[10px] text-white/30 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {formatDate(opp.createdAt)}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors" />
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════ Dossiers Section ════════════ */

function DossiersSection() {
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = getToken();
      const res = await fetch("/api/product/dossiers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al cargar dossiers");
      const data = await res.json();
      setDossiers(Array.isArray(data) ? data : data.dossiers || []);
    } catch (e: any) {
      setError(e.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const loadDetail = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`/api/product/dossiers/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setDetail(await res.json());
    } catch {}
    setDetailLoading(false);
  };

  const statusSteps = ["IDEA", "RESEARCH", "EVALUATE", "DECIDE", "ARCHITECT", "SPECIFY", "PRODUCE", "QA", "PUBLISH"];

  const getStepIndex = (status: string) => {
    const idx = statusSteps.indexOf(status.toUpperCase());
    return idx >= 0 ? idx : 0;
  };

  return (
    <div>
      <SectionHeader
        icon={FolderOpen}
        title="Dossiers"
        subtitle="Ciclo de vida completo de cada producto — de idea a publicación"
        actions={
          <button
            onClick={load}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        }
      />

      {error ? (
        <ErrorBanner message={error} onRetry={load} />
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-white/30">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando dossiers...
        </div>
      ) : dossiers.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Sin dossiers"
          subtitle="Los dossiers se crean automáticamente al evaluar oportunidades"
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Dossier List */}
          <div className="lg:col-span-1 space-y-2 max-h-[700px] overflow-y-auto pr-1">
            {dossiers.map((d, i) => (
              <motion.button
                key={d.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => loadDetail(d.id)}
                className={`w-full p-4 rounded-xl text-left transition-all ${
                  selectedId === d.id
                    ? "bg-[#3b82f6]/10 border border-[#3b82f6]/20"
                    : "bg-[#0f1629] border border-white/[0.06] hover:border-white/10"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold truncate">{d.productName}</p>
                  <StatusBadge status={d.status} />
                </div>
                <div className="flex items-center gap-3 text-[10px] text-white/30">
                  <span>{d.productType}</span>
                  {d.fitScore !== undefined && (
                    <span className={fitScoreColor(d.fitScore)}>
                      Fit: {(d.fitScore * 100).toFixed(0)}%
                    </span>
                  )}
                  {d.decision && <span className="text-white/40">{d.decision}</span>}
                </div>
                {/* Pipeline progress */}
                <div className="mt-3 flex items-center gap-1">
                  {statusSteps.map((step, idx) => (
                    <div
                      key={step}
                      className={`h-1 flex-1 rounded-full ${
                        idx <= getStepIndex(d.status)
                          ? "bg-[#3b82f6]"
                          : "bg-white/5"
                      }`}
                      title={step}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-white/20 mt-1.5">
                  {formatDate(d.updatedAt)}
                </p>
              </motion.button>
            ))}
          </div>

          {/* Detail View */}
          <div className="lg:col-span-2">
            {selectedId ? (
              detailLoading ? (
                <div className="flex items-center justify-center py-20 text-white/30">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando detalle...
                </div>
              ) : detail ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-5 rounded-2xl bg-[#0f1629] border border-white/[0.06] space-y-5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold">{detail.productName || detail.name}</h3>
                      <p className="text-xs text-white/40 mt-1">
                        {detail.productType} · {detail.status} · Creado {formatDate(detail.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={detail.status} />
                  </div>

                  {/* Pipeline visualization */}
                  <div>
                    <h4 className="text-xs font-bold text-white/60 mb-2 uppercase tracking-wider">Pipeline</h4>
                    <div className="flex items-center gap-1 overflow-x-auto pb-2">
                      {statusSteps.map((step, idx) => {
                        const currentIdx = getStepIndex(detail.status);
                        const isActive = idx === currentIdx;
                        const isDone = idx < currentIdx;
                        return (
                          <div key={step} className="flex items-center gap-1 flex-shrink-0">
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold ${
                              isDone ? "bg-emerald-400/10 text-emerald-400" :
                              isActive ? "bg-[#3b82f6]/10 text-[#3b82f6]" :
                              "bg-white/5 text-white/20"
                            }`}>
                              {isDone ? <CheckCircle2 className="w-3 h-3" /> : isActive ? <Play className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                              {step}
                            </div>
                            {idx < statusSteps.length - 1 && (
                              <ArrowRight className="w-3 h-3 text-white/10" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Key data sections */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {detail.fitScore && (
                      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                        <h4 className="text-[10px] font-bold text-white/40 mb-2 uppercase tracking-wider">Fit Score</h4>
                        <div className="flex items-center gap-2">
                          <span className={`text-2xl font-extrabold ${fitScoreColor(detail.fitScore.overall || detail.fitScore)}`}>
                            {((detail.fitScore.overall || detail.fitScore) * 100).toFixed(0)}%
                          </span>
                          {detail.fitScore.recommendation && (
                            <span className="text-xs text-white/40">{detail.fitScore.recommendation}</span>
                          )}
                        </div>
                      </div>
                    )}
                    {detail.decision && (
                      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                        <h4 className="text-[10px] font-bold text-white/40 mb-2 uppercase tracking-wider">Decisión</h4>
                        <StatusBadge status={detail.decision.decision || detail.decision} />
                        {detail.decision.rationale && (
                          <p className="text-xs text-white/40 mt-2 line-clamp-3">{detail.decision.rationale}</p>
                        )}
                      </div>
                    )}
                    {detail.architecture && (
                      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] sm:col-span-2">
                        <h4 className="text-[10px] font-bold text-white/40 mb-2 uppercase tracking-wider">Arquitectura</h4>
                        <p className="text-xs text-white/60">{JSON.stringify(detail.architecture, null, 2).substring(0, 500)}</p>
                      </div>
                    )}
                  </div>

                  {/* Raw JSON toggle */}
                  <details className="group">
                    <summary className="text-[10px] text-white/30 cursor-pointer hover:text-white/50 flex items-center gap-1">
                      <Eye className="w-3 h-3" /> Ver JSON completo
                    </summary>
                    <pre className="mt-2 p-3 rounded-xl bg-black/30 text-[10px] text-white/30 overflow-auto max-h-64">
                      {JSON.stringify(detail, null, 2)}
                    </pre>
                  </details>
                </motion.div>
              ) : (
                <div className="flex items-center justify-center py-20 text-white/20">
                  No se pudo cargar el detalle
                </div>
              )
            ) : (
              <div className="flex items-center justify-center py-20 text-white/20">
                <div className="text-center">
                  <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Selecciona un dossier para ver el detalle</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════ Production Section ════════════ */

function ProductionSection() {
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form
  const [dossierId, setDossierId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = getToken();
      const res = await fetch("/api/product/produce", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al cargar trabajos de producción");
      const data = await res.json();
      setJobs(Array.isArray(data) ? data : data.jobs || data.productions || []);
    } catch (e: any) {
      setError(e.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const startProduction = async () => {
    setSubmitting(true);
    setFormError("");
    try {
      const token = getToken();
      const res = await fetch("/api/product/produce", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dossierId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al iniciar producción");
      }
      setShowForm(false);
      setDossierId("");
      load();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const pollJob = async (jobId: string) => {
    try {
      const token = getToken();
      const res = await fetch(`/api/product/produce/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const updated = await res.json();
        setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...updated } : j));
      }
    } catch {}
  };

  return (
    <div>
      <SectionHeader
        icon={Factory}
        title="Producción"
        subtitle="Pipeline de producción de eBooks y otros productos digitales"
        actions={
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-xl bg-gradient-to-b from-[#3b82f6] to-[#1e40af] text-white font-bold text-xs shadow-[0_10px_24px_rgba(30,64,175,0.45)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5" /> Nueva Producción
          </button>
        }
      />

      {/* Start Production Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="p-5 rounded-2xl bg-[#0f1629] border border-white/[0.06] space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Factory className="w-4 h-4 text-[#3b82f6]" /> Iniciar Producción
              </h3>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">ID del Dossier</label>
                <input
                  type="text"
                  value={dossierId}
                  onChange={(e) => setDossierId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#3b82f6] transition-colors"
                  placeholder="Pega el ID del dossier aprobado..."
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={startProduction}
                  disabled={submitting || !dossierId}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-b from-[#3b82f6] to-[#1e40af] text-white font-bold text-xs shadow-[0_10px_24px_rgba(30,64,175,0.45)] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  {submitting ? "Iniciando..." : "Iniciar Pipeline"}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 text-white/50 hover:text-white/80 text-xs transition-colors"
                >
                  Cancelar
                </button>
              </div>
              {formError && <p className="text-red-400 text-xs">{formError}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Jobs List */}
      {error ? (
        <ErrorBanner message={error} onRetry={load} />
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-white/30">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando producciones...
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Factory}
          title="Sin producciones"
          subtitle="Inicia una producción desde un dossier aprobado"
        />
      ) : (
        <div className="space-y-3">
          {jobs.map((job, i) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-4 rounded-2xl bg-[#0f1629] border border-white/[0.06] hover:border-white/10 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    job.status === "COMPLETED" ? "bg-emerald-400/10" :
                    job.status === "FAILED" ? "bg-red-400/10" :
                    job.status === "RUNNING" ? "bg-amber-400/10" :
                    "bg-[#3b82f6]/10"
                  }`}>
                    {job.status === "COMPLETED" ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> :
                     job.status === "FAILED" ? <XCircle className="w-5 h-5 text-red-400" /> :
                     job.status === "RUNNING" ? <Loader2 className="w-5 h-5 text-amber-400 animate-spin" /> :
                     <Factory className="w-5 h-5 text-[#3b82f6]" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{job.productName || job.dossierId}</p>
                    <p className="text-[10px] text-white/30">{job.productType} · {formatDate(job.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={job.status} />
                  {job.status === "RUNNING" && (
                    <button
                      onClick={() => pollJob(job.id)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                      title="Actualizar estado"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-white/40">
                    {job.currentStep || "Progreso"}
                  </span>
                  <span className="text-[10px] text-white/40">{job.progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      job.status === "COMPLETED" ? "bg-emerald-400" :
                      job.status === "FAILED" ? "bg-red-400" :
                      "bg-[#3b82f6]"
                    }`}
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════ Handoff Section ════════════ */

function HandoffSection() {
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = getToken();
      const res = await fetch("/api/product/handoff", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al cargar handoffs");
      const data = await res.json();
      setHandoffs(Array.isArray(data) ? data : data.handoffs || []);
    } catch (e: any) {
      setError(e.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const performAction = async (handoffId: string, action: string) => {
    setActing(handoffId);
    try {
      const token = getToken();
      const res = await fetch(`/api/product/handoff/${handoffId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Error al ejecutar ${action}`);
      }
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActing(null);
    }
  };

  const getActions = (status: string): { action: string; label: string; icon: React.ComponentType<{ className?: string }> }[] => {
    const s = status.toUpperCase();
    if (s === "CREATED") return [{ action: "ready", label: "Marcar Listo", icon: CheckCircle2 }];
    if (s === "READY") return [{ action: "send", label: "Enviar", icon: Send }];
    if (s === "SENT") return [{ action: "acknowledge", label: "Acknowledge", icon: Eye }];
    if (s === "ACKNOWLEDGED") return [{ action: "complete", label: "Completar", icon: CheckCircle2 }];
    return [];
  };

  return (
    <div>
      <SectionHeader
        icon={Send}
        title="Handoff"
        subtitle="Contratos de handoff para implementación externa de productos software"
        actions={
          <button
            onClick={load}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        }
      />

      {/* Status summary */}
      {!loading && !error && handoffs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Creados", count: handoffs.filter(h => h.status === "CREATED").length, icon: Circle, color: "text-blue-400" },
            { label: "Listos", count: handoffs.filter(h => h.status === "READY").length, icon: CheckCircle2, color: "text-amber-400" },
            { label: "Enviados", count: handoffs.filter(h => ["SENT", "ACKNOWLEDGED"].includes(h.status)).length, icon: Send, color: "text-purple-400" },
            { label: "Completados", count: handoffs.filter(h => h.status === "COMPLETED").length, icon: CheckCircle2, color: "text-emerald-400" },
          ].map((s) => (
            <div key={s.label} className="p-3 rounded-xl bg-[#0f1629] border border-white/[0.06] text-center">
              <s.icon className={`w-5 h-5 mx-auto mb-1 ${s.color}`} />
              <p className="text-xl font-extrabold">{s.count}</p>
              <p className="text-[10px] text-white/40">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {error ? (
        <ErrorBanner message={error} onRetry={load} />
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-white/30">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando handoffs...
        </div>
      ) : handoffs.length === 0 ? (
        <EmptyState
          icon={Send}
          title="Sin handoffs"
          subtitle="Los handoffs se crean para productos software que requieren implementación externa"
        />
      ) : (
        <div className="space-y-3">
          {handoffs.map((h, i) => {
            const actions = getActions(h.status);
            return (
              <motion.div
                key={h.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 rounded-2xl bg-[#0f1629] border border-white/[0.06] hover:border-white/10 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      h.status === "COMPLETED" ? "bg-emerald-400/10" :
                      h.status === "FAILED" ? "bg-red-400/10" :
                      h.status === "SENT" || h.status === "ACKNOWLEDGED" ? "bg-purple-400/10" :
                      h.status === "READY" ? "bg-amber-400/10" :
                      "bg-blue-400/10"
                    }`}>
                      <Send className={`w-5 h-5 ${
                        h.status === "COMPLETED" ? "text-emerald-400" :
                        h.status === "FAILED" ? "text-red-400" :
                        h.status === "SENT" || h.status === "ACKNOWLEDGED" ? "text-purple-400" :
                        h.status === "READY" ? "text-amber-400" :
                        "text-blue-400"
                      }`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{h.productName || h.dossierId}</p>
                      <p className="text-[10px] text-white/30 flex items-center gap-2">
                        <span>Provider: {h.provider}</span>
                        <span>·</span>
                        <span>{formatDate(h.updatedAt)}</span>
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={h.status} />
                </div>

                {/* Actions */}
                {actions.length > 0 && (
                  <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                    {actions.map((a) => (
                      <button
                        key={a.action}
                        onClick={() => performAction(h.id, a.action)}
                        disabled={acting === h.id}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        {acting === h.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <a.icon className="w-3 h-3" />
                        )}
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ════════════ Commercial Section ════════════ */

function CommercialSection() {
  const [products, setProducts] = useState<CommercialProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = getToken();
      const res = await fetch("/api/product/dossiers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al cargar productos comerciales");
      const data = await res.json();
      const dossiers = Array.isArray(data) ? data : data.dossiers || [];
      // Load commercial products for each dossier that has one
      const comms: CommercialProduct[] = [];
      for (const d of dossiers) {
        if (d.commercialProduct) comms.push(d.commercialProduct);
      }
      setProducts(comms);
    } catch (e: any) {
      setError(e.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const getReadinessScore = (r?: string): number | null => {
    if (!r) return null;
    try {
      const parsed = JSON.parse(r);
      return typeof parsed.overall === "number" ? parsed.overall : null;
    } catch { return null; }
  };

  const getReadinessLevel = (r?: string): string => {
    if (!r) return "N/A";
    try {
      const parsed = JSON.parse(r);
      return parsed.level || "N/A";
    } catch { return "N/A"; }
  };

  return (
    <div>
      <SectionHeader
        icon={DollarSign}
        title="Comercial"
        subtitle="Definición comercial de productos y readiness score"
        actions={
          <button
            onClick={load}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        }
      />

      {error ? (
        <ErrorBanner message={error} onRetry={load} />
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-white/30">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando productos comerciales...
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="Sin productos comerciales"
          subtitle="Crea un producto comercial desde un dossier para ver su definición comercial aquí"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p, i) => {
            const score = getReadinessScore(p.commercialReadiness);
            const level = getReadinessLevel(p.commercialReadiness);
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 rounded-2xl bg-[#0f1629] border border-white/[0.06] hover:border-[#3b82f6]/20 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400/20 to-[#3b82f6]/20 flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold truncate max-w-[180px]">{p.productName}</p>
                      <p className="text-[10px] text-white/30">{p.productType}</p>
                    </div>
                  </div>
                  <StatusBadge status={level} />
                </div>

                <div className="space-y-2 mb-3">
                  <p className="text-[10px] text-white/40 truncate">
                    <span className="text-white/60">Modelo:</span> {p.monetizationModel || "—"}
                  </p>
                  <p className="text-[10px] text-white/40 truncate">
                    <span className="text-white/60">Posición:</span> {p.positioning || "—"}
                  </p>
                </div>

                {score !== null && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-white/40">Readiness</span>
                      <span className={`text-sm font-bold ${fitScoreColor(score)}`}>
                        {(score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          score >= 0.7 ? "bg-emerald-400" : score >= 0.4 ? "bg-amber-400" : "bg-red-400"
                        }`}
                        style={{ width: `${score * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                  <span className="text-[10px] text-white/30 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatDate(p.createdAt)}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    p.evidence === "VERIFIED" ? "bg-emerald-400/10 text-emerald-400" :
                    p.evidence === "INFERRED" ? "bg-amber-400/10 text-amber-400" :
                    "bg-white/5 text-white/30"
                  }`}>
                    {p.evidence}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ════════════ Factory Section ════════════ */

function FactorySection() {
  const [executions, setExecutions] = useState<FactoryExec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = getToken();
      // Fetch factory executions via dossiers
      const res = await fetch("/api/product/dossiers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al cargar ejecuciones");
      // For now, show empty state until factory executions are loaded directly
      setExecutions([]);
    } catch (e: any) {
      setError(e.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const getProgressSteps = (progress: string): unknown[] => {
    try { return JSON.parse(progress || "[]"); } catch { return []; }
  };

  return (
    <div>
      <SectionHeader
        icon={Factory}
        title="Factory"
        subtitle="Estado de ejecuciones de factory y progreso de producción"
        actions={
          <button
            onClick={load}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        }
      />

      {/* Status summary */}
      {!loading && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Creadas", count: executions.filter(e => e.status === "CREATED").length, icon: Circle, color: "text-blue-400" },
            { label: "Ejecutando", count: executions.filter(e => ["QUEUED", "RUNNING"].includes(e.status)).length, icon: Play, color: "text-amber-400" },
            { label: "QA", count: executions.filter(e => ["QA", "PASSED"].includes(e.status)).length, icon: Shield, color: "text-purple-400" },
            { label: "Completadas", count: executions.filter(e => e.status === "COMPLETED").length, icon: CheckCircle2, color: "text-emerald-400" },
          ].map((s) => (
            <div key={s.label} className="p-3 rounded-xl bg-[#0f1629] border border-white/[0.06] text-center">
              <s.icon className={`w-5 h-5 mx-auto mb-1 ${s.color}`} />
              <p className="text-xl font-extrabold">{s.count}</p>
              <p className="text-[10px] text-white/40">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {error ? (
        <ErrorBanner message={error} onRetry={load} />
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-white/30">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando ejecuciones...
        </div>
      ) : executions.length === 0 ? (
        <EmptyState
          icon={Factory}
          title="Sin ejecuciones de factory"
          subtitle="Ejecuta una factory desde un producto para ver el progreso aquí"
        />
      ) : (
        <div className="space-y-3">
          {executions.map((exec, i) => {
            const steps = getProgressSteps(exec.progress);
            return (
              <motion.div
                key={exec.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 rounded-2xl bg-[#0f1629] border border-white/[0.06] hover:border-white/10 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      exec.status === "COMPLETED" ? "bg-emerald-400/10" :
                      exec.status === "FAILED" ? "bg-red-400/10" :
                      exec.status === "RUNNING" ? "bg-amber-400/10" :
                      "bg-blue-400/10"
                    }`}>
                      <Factory className={`w-5 h-5 ${
                        exec.status === "COMPLETED" ? "text-emerald-400" :
                        exec.status === "FAILED" ? "text-red-400" :
                        exec.status === "RUNNING" ? "text-amber-400" :
                        "text-blue-400"
                      }`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{exec.factoryType}</p>
                      <p className="text-[10px] text-white/30 flex items-center gap-2">
                        <span>Producto: {exec.productId}</span>
                        <span>·</span>
                        <span>{steps.length} pasos</span>
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={exec.status} />
                </div>

                {exec.error && (
                  <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 mb-3">
                    <p className="text-[10px] text-red-300">{exec.error}</p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                  <span className="text-[10px] text-white/30 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatDate(exec.createdAt)}
                  </span>
                  {exec.completedAt && (
                    <span className="text-[10px] text-white/30">
                      Completado: {formatDate(exec.completedAt)}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ════════════ Assets Section ════════════ */

function AssetsSection() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = getToken();
      const res = await fetch("/api/product/assets", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al cargar assets");
      const data = await res.json();
      setAssets(Array.isArray(data) ? data : data.assets || []);
    } catch (e: any) {
      setError(e.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const typeIcon = (type: string): React.ComponentType<{ className?: string }> => {
    if (["pdf", "epub"].includes(type)) return BookOpen;
    if (type === "image" || type === "cover") return Globe;
    if (type === "markdown") return FileText;
    if (type === "data") return BarChart3;
    if (type === "template") return Layers;
    return FileArchive;
  };

  return (
    <div>
      <SectionHeader
        icon={Package}
        title="Assets"
        subtitle="Archivos de producto generados y sus estados"
        actions={
          <button
            onClick={load}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        }
      />

      {error ? (
        <ErrorBanner message={error} onRetry={load} />
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-white/30">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando assets...
        </div>
      ) : assets.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Sin assets"
          subtitle="Los assets se generan al ejecutar factories de producto"
        />
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
          {assets.map((a, i) => {
            const Icon = typeIcon(a.type);
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-[#0f1629] border border-white/[0.06] hover:border-white/10 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400/20 to-[#3b82f6]/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.filename}</p>
                  <p className="text-[10px] text-white/30 flex items-center gap-2">
                    <span className="uppercase">{a.type}</span>
                    <span>·</span>
                    <span>{a.mimeType}</span>
                    <span>·</span>
                    <span>{formatSize(a.size)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] text-white/30">{a.source}</span>
                  <StatusBadge status={a.status} />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ════════════ Launch Section ════════════ */

function LaunchSection() {
  const [packages, setPackages] = useState<LaunchPkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Launch packages are loaded via dossiers for now
      const token = getToken();
      const res = await fetch("/api/product/dossiers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al cargar launch packages");
      setPackages([]);
    } catch (e: any) {
      setError(e.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <SectionHeader
        icon={Rocket}
        title="Launch"
        subtitle="Paquetes de lanzamiento generados con oferta y posicionamiento"
        actions={
          <button
            onClick={load}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        }
      />

      {error ? (
        <ErrorBanner message={error} onRetry={load} />
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-white/30">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando launch packages...
        </div>
      ) : packages.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title="Sin launch packages"
          subtitle="Genera un launch package desde un producto comercial listo para lanzar"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {packages.map((pkg, i) => (
            <motion.div
              key={pkg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-4 rounded-2xl bg-[#0f1629] border border-white/[0.06] hover:border-[#3b82f6]/20 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-400/20 to-amber-400/20 flex items-center justify-center">
                    <Rocket className="w-4 h-4 text-rose-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Launch Package</p>
                    <p className="text-[10px] text-white/30">{pkg.productId}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-3">
                <p className="text-xs text-white/60 line-clamp-2">{pkg.corePromise}</p>
                <p className="text-[10px] text-white/30 truncate">
                  <span className="text-white/50">Posición:</span> {pkg.positioning}
                </p>
                <p className="text-[10px] text-white/30 truncate">
                  <span className="text-white/50">CTA:</span> {pkg.cta}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                <span className="text-[10px] text-white/30 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {formatDate(pkg.generatedAt)}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  pkg.evidence === "VERIFIED" ? "bg-emerald-400/10 text-emerald-400" :
                  "bg-amber-400/10 text-amber-400"
                }`}>
                  {pkg.evidence}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════ Main ProductDashboard ════════════ */

interface ProductDashboardProps {
  initialSection?: Section;
}

export default function ProductDashboard({ initialSection = "opportunities" }: ProductDashboardProps) {
  const [internalSection, setInternalSection] = useState<Section>(initialSection);
  // When the parent changes the initialSection (different nav item clicked), update internal state
  const activeSection = initialSection !== internalSection &&
    ["opportunities", "dossiers", "production", "handoff", "commercial", "factory", "assets", "launch"].includes(initialSection)
    ? initialSection : internalSection;
  const setActiveSection = (s: Section) => { setInternalSection(s); };

  const sections: { id: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "opportunities", label: "Oportunidades", icon: Lightbulb },
    { id: "dossiers", label: "Dossiers", icon: FolderOpen },
    { id: "commercial", label: "Comercial", icon: DollarSign },
    { id: "production", label: "Producción", icon: Factory },
    { id: "factory", label: "Factory", icon: Wrench },
    { id: "assets", label: "Assets", icon: Package },
    { id: "launch", label: "Launch", icon: Rocket },
    { id: "handoff", label: "Handoff", icon: Send },
  ];

  const renderSection = () => {
    switch (activeSection) {
      case "opportunities": return <OpportunitiesSection />;
      case "dossiers": return <DossiersSection />;
      case "commercial": return <CommercialSection />;
      case "production": return <ProductionSection />;
      case "factory": return <FactorySection />;
      case "assets": return <AssetsSection />;
      case "launch": return <LaunchSection />;
      case "handoff": return <HandoffSection />;
      default: return <OpportunitiesSection />;
    }
  };

  return (
    <div>
      {/* Section Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
              activeSection === s.id
                ? "bg-gradient-to-r from-[#3b82f6]/20 to-[#7c3aed]/10 text-white border border-[#3b82f6]/20"
                : "bg-white/5 text-white/50 hover:text-white/80 hover:bg-white/10 border border-transparent"
            }`}
          >
            <s.icon className="w-3.5 h-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      {/* Section Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {renderSection()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
