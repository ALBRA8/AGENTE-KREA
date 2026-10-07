"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield, Target, Zap, Stethoscope, Brain, Sparkles, Activity,
  Server, Lock, MessageSquare, ChevronRight, Loader2, RefreshCw,
  CheckCircle2, AlertTriangle, XCircle, Circle, HelpCircle, Clock,
  Cpu, Database, Globe, Key, ArrowRightLeft, Eye, Gauge,
  Wrench, Layers, FileCode2, Radio, UserCircle, Bot, ArrowRight,
  Plug, PlugZap, Send, Handshake, ShieldCheck, ShieldAlert,
  FolderLock, Users, Network, Hash, Percent, TrendingUp, TrendingDown,
  Play, Pause, Archive, Trash2, Lightbulb, BookOpen, Search,
  HardDrive, Timer, AlertCircle, Copy, ExternalLink, Coins
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/* ════════════ Types ════════════ */

interface User {
  id: string;
  name: string;
  email: string;
  credits: number;
  plan: string;
}

interface Identity {
  name: string;
  version: string;
  domain: string;
  mission: string;
  status: string;
  ecosystem: string;
  [key: string]: unknown;
}

interface Mission {
  in_scope?: { name: string; status: string }[];
  out_of_scope?: string[];
  delegatable?: string[];
  [key: string]: unknown;
}

interface Capability {
  name: string;
  status: string;
  risk?: string;
  cost?: number;
  tools_required?: string[];
  [key: string]: unknown;
}

interface DoctorResult {
  status: string;
  checks?: { name: string; status: string; detail?: string; duration_ms?: number }[];
  timestamp?: string;
  [key: string]: unknown;
}

interface MemoryStats {
  type: string;
  count: number;
  size_bytes?: number;
  last_access?: string;
  [key: string]: unknown;
}

interface Skill {
  id: string;
  name: string;
  status: string;
  description?: string;
  version?: string;
  [key: string]: unknown;
}

interface Observability {
  total_executions?: number;
  success_rate?: number;
  avg_latency_ms?: number;
  error_rate?: number;
  provider_usage?: { provider: string; calls: number; errors: number }[];
  recent_errors?: { timestamp: string; error: string; capability: string }[];
  [key: string]: unknown;
}

interface McpData {
  server?: { name: string; tools: { name: string; description: string }[] };
  client?: { name: string; tools: { name: string; description: string }[] };
  [key: string]: unknown;
}

interface AgentComm {
  interactions?: { agent: string; direction: string; capability: string; timestamp: string; status: string }[];
  delegation_rules?: { target: string; capability: string; condition: string }[];
  [key: string]: unknown;
}

interface SecurityData {
  policies?: { name: string; rule: string; effect: string }[];
  permissions?: string[];
  [key: string]: unknown;
}

type TabId =
  | "identity"
  | "mission"
  | "capabilities"
  | "doctor"
  | "memory"
  | "skills"
  | "observability"
  | "mcp"
  | "security"
  | "agent-comm";

/* ════════════ Status Badge Helper ════════════ */

const STATUS_COLORS: Record<string, string> = {
  IMPLEMENTED: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  ACTIVE: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  HEALTHY: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  PARTIAL: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  DEGRADED: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  VALIDATING: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  MISSING: "bg-red-500/20 text-red-400 border-red-500/30",
  UNHEALTHY: "bg-red-500/20 text-red-400 border-red-500/30",
  RETIRED: "bg-red-500/20 text-red-400 border-red-500/30",
  MOCKED: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  DEPRECATED: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  PLACEHOLDER: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  PROPOSED: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  UNKNOWN: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  DENY: "bg-red-500/20 text-red-400 border-red-500/30",
  ALLOW: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  IMPLEMENTED: CheckCircle2,
  ACTIVE: CheckCircle2,
  HEALTHY: CheckCircle2,
  PARTIAL: AlertTriangle,
  DEGRADED: AlertTriangle,
  VALIDATING: AlertTriangle,
  MISSING: XCircle,
  UNHEALTHY: XCircle,
  RETIRED: XCircle,
  MOCKED: Circle,
  DEPRECATED: Circle,
  PLACEHOLDER: Circle,
  PROPOSED: Circle,
  UNKNOWN: HelpCircle,
  DENY: XCircle,
  ALLOW: CheckCircle2,
};

function StatusBadge({ status }: { status: string }) {
  const upper = status.toUpperCase();
  const colors = STATUS_COLORS[upper] ?? STATUS_COLORS.UNKNOWN;
  const Icon = STATUS_ICONS[upper] ?? HelpCircle;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border ${colors}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}

/* ════════════ Section Card ════════════ */

function SectionCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`p-5 rounded-2xl bg-[#0f1629] border border-white/[0.06] ${className}`}
    >
      {children}
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3b82f6]/20 to-[#7c3aed]/20 flex items-center justify-center">
          <Icon className="w-4 h-4 text-[#3b82f6]" />
        </div>
        <h3 className="text-sm font-bold text-white">{title}</h3>
      </div>
      {action}
    </div>
  );
}

function FieldRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-white/[0.04] last:border-b-0">
      {Icon && (
        <Icon className="w-3.5 h-3.5 text-white/30 mt-0.5 flex-shrink-0" />
      )}
      <span className="text-[11px] text-white/40 w-28 flex-shrink-0 pt-0.5">
        {label}
      </span>
      <div className="flex-1 text-[13px] text-white/80">{value}</div>
    </div>
  );
}

/* ════════════ Skeleton Loaders ════════════ */

function CardSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <SectionCard>
      <div className="flex items-center gap-2.5 mb-4">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <Skeleton className="w-32 h-4 rounded" />
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="flex gap-3 py-2">
          <Skeleton className="w-24 h-3 rounded" />
          <Skeleton className="flex-1 h-3 rounded" />
        </div>
      ))}
    </SectionCard>
  );
}

/* ════════════ Tabs Config ════════════ */

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "identity", label: "Identidad", icon: Shield },
  { id: "mission", label: "Misión", icon: Target },
  { id: "capabilities", label: "Capacidades", icon: Zap },
  { id: "doctor", label: "Doctor", icon: Stethoscope },
  { id: "memory", label: "Memoria", icon: Brain },
  { id: "skills", label: "Skills", icon: Sparkles },
  { id: "observability", label: "Observabilidad", icon: Activity },
  { id: "mcp", label: "MCP", icon: Server },
  { id: "security", label: "Seguridad", icon: Lock },
  { id: "agent-comm", label: "Agent Comm", icon: MessageSquare },
];

/* ════════════ Main Component ════════════ */

export default function AdnDashboard({ user }: { user: User }) {
  const [activeTab, setActiveTab] = useState<TabId>("identity");
  const [loading, setLoading] = useState(true);
  const [doctorRunning, setDoctorRunning] = useState(false);

  /* Data state */
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [mission, setMission] = useState<Mission | null>(null);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [doctor, setDoctor] = useState<DoctorResult | null>(null);
  const [memory, setMemory] = useState<MemoryStats[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [observability, setObservability] = useState<Observability | null>(null);
  const [mcp, setMcp] = useState<McpData | null>(null);
  const [security, setSecurity] = useState<SecurityData | null>(null);
  const [agentComm, setAgentComm] = useState<AgentComm | null>(null);

  /* ── Fetch helpers ── */
  const fetchJson = useCallback(
    async (path: string): Promise<unknown> => {
      try {
        const res = await fetch(path);
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    },
    []
  );

  /* ── Load all data ── */
  const loadAll = useCallback(async () => {
    setLoading(true);
    const [
      identRes,
      missionRes,
      capRes,
      docRes,
      memRes,
      skillsRes,
      obsRes,
      mcpRes,
      secRes,
      commRes,
    ] = await Promise.all([
      fetchJson("/api/adn/identity"),
      fetchJson("/api/adn/mission"),
      fetchJson("/api/adn/capabilities"),
      fetchJson("/api/adn/doctor"),
      fetchJson("/api/adn/memory?limit=50"),
      fetchJson("/api/adn/skills"),
      fetchJson("/api/adn/observability?range=24h"),
      fetchJson("/api/adn/mcp"),
      fetchJson("/api/adn/security"),
      fetchJson("/api/adn/agent-comm?limit=10"),
    ]);

    setIdentity((identRes as Identity) ?? null);
    setMission((missionRes as Mission) ?? null);
    setCapabilities(
      Array.isArray(capRes) ? (capRes as Capability[]) : (capRes as { capabilities?: Capability[] })?.capabilities ?? []
    );
    setDoctor((docRes as DoctorResult) ?? null);
    setMemory(
      Array.isArray(memRes) ? (memRes as MemoryStats[]) : (memRes as { types?: MemoryStats[] })?.types ?? []
    );
    setSkills(
      Array.isArray(skillsRes) ? (skillsRes as Skill[]) : (skillsRes as { skills?: Skill[] })?.skills ?? []
    );
    setObservability((obsRes as Observability) ?? null);
    setMcp((mcpRes as McpData) ?? null);
    setSecurity((secRes as SecurityData) ?? null);
    setAgentComm((commRes as AgentComm) ?? null);
    setLoading(false);
  }, [fetchJson]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* ── Doctor run ── */
  const runDoctor = useCallback(async () => {
    setDoctorRunning(true);
    const res = await fetchJson("/api/adn/doctor");
    if (res) setDoctor(res as DoctorResult);
    setDoctorRunning(false);
  }, [fetchJson]);

  /* ════════════ Sections ════════════ */

  /* ── Identity ── */
  function IdentitySection() {
    if (!identity) return <EmptyState icon={Shield} text="Sin datos de identidad" />;
    return (
      <SectionCard>
        <SectionHeading icon={Shield} title="Identidad del Agente" />
        <div>
          <FieldRow icon={Bot} label="Nombre" value={<span className="font-semibold gradient-text">{identity.name}</span>} />
          <FieldRow icon={Hash} label="Versión" value={identity.version} />
          <FieldRow icon={Globe} label="Dominio" value={identity.domain} />
          <FieldRow icon={Target} label="Misión" value={identity.mission} />
          <FieldRow icon={Activity} label="Status" value={<StatusBadge status={identity.status} />} />
          <FieldRow icon={Network} label="Ecosistema" value={identity.ecosystem} />
        </div>
      </SectionCard>
    );
  }

  /* ── Mission ── */
  function MissionSection() {
    if (!mission) return <EmptyState icon={Target} text="Sin datos de misión" />;
    return (
      <div className="space-y-4">
        {/* In Scope */}
        <SectionCard>
          <SectionHeading icon={CheckCircle2} title="En Scope (In-Scope)" />
          {mission.in_scope && mission.in_scope.length > 0 ? (
            <div className="space-y-2">
              {mission.in_scope.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                >
                  <span className="text-[13px] text-white/80">{item.name}</span>
                  <StatusBadge status={item.status} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/30">Ningún item en scope</p>
          )}
        </SectionCard>

        {/* Out of Scope */}
        <SectionCard>
          <SectionHeading icon={XCircle} title="Fuera de Scope" />
          {mission.out_of_scope && mission.out_of_scope.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {mission.out_of_scope.map((item, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20"
                >
                  <XCircle className="w-3 h-3" />
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/30">Nada fuera de scope</p>
          )}
        </SectionCard>

        {/* Delegatable */}
        <SectionCard>
          <SectionHeading icon={ArrowRightLeft} title="Delegable" />
          {mission.delegatable && mission.delegatable.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {mission.delegatable.map((item, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20"
                >
                  <ArrowRight className="w-3 h-3" />
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/30">Nada delegable</p>
          )}
        </SectionCard>
      </div>
    );
  }

  /* ── Capabilities ── */
  function CapabilitiesSection() {
    if (capabilities.length === 0 && !loading)
      return <EmptyState icon={Zap} text="Sin capacidades registradas" />;
    return (
      <SectionCard>
        <SectionHeading
          icon={Zap}
          title="Capacidades"
          action={
            <span className="text-[11px] text-white/30">
              {capabilities.length} total
            </span>
          }
        />
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
          {capabilities.map((cap, i) => (
            <div
              key={i}
              className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-colors"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] font-semibold text-white/90">
                  {cap.name}
                </span>
                <StatusBadge status={cap.status} />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/40">
                {cap.risk && (
                  <span className="flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" />
                    Risk: <span className="text-white/60">{cap.risk}</span>
                  </span>
                )}
                {cap.cost !== undefined && (
                  <span className="flex items-center gap-1">
                    <Coins className="w-3 h-3" />
                    Cost: <span className="text-white/60">{cap.cost}</span>
                  </span>
                )}
                {cap.tools_required && cap.tools_required.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Wrench className="w-3 h-3" />
                    Tools:
                    <span className="text-white/60">
                      {cap.tools_required.join(", ")}
                    </span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    );
  }

  /* ── Doctor ── */
  function DoctorSection() {
    return (
      <SectionCard>
        <SectionHeading
          icon={Stethoscope}
          title="Health Check"
          action={
            <button
              onClick={runDoctor}
              disabled={doctorRunning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-gradient-to-r from-[#3b82f6] to-[#7c3aed] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {doctorRunning ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              {doctorRunning ? "Ejecutando..." : "Run Doctor"}
            </button>
          }
        />

        {doctor ? (
          <div className="space-y-3">
            {/* Overall status */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <span className="text-[13px] text-white/70">Estado General</span>
              <StatusBadge status={doctor.status} />
            </div>

            {doctor.timestamp && (
              <div className="flex items-center gap-2 text-[11px] text-white/30">
                <Clock className="w-3 h-3" />
                Último check: {new Date(doctor.timestamp).toLocaleString("es-ES")}
              </div>
            )}

            {/* Individual checks */}
            {doctor.checks && doctor.checks.length > 0 && (
              <div className="space-y-2 mt-2">
                {doctor.checks.map((check, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                  >
                    <div className="flex items-center gap-2">
                      <StatusBadge status={check.status} />
                      <span className="text-[12px] text-white/70">
                        {check.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-white/30">
                      {check.detail && <span>{check.detail}</span>}
                      {check.duration_ms !== undefined && (
                        <span className="flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          {check.duration_ms}ms
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-white/30">
            <Stethoscope className="w-8 h-8 mb-2 text-white/15" />
            <p className="text-xs">Pulsa &quot;Run Doctor&quot; para ejecutar el health check</p>
          </div>
        )}
      </SectionCard>
    );
  }

  /* ── Memory ── */
  function MemorySection() {
    if (memory.length === 0 && !loading)
      return <EmptyState icon={Brain} text="Sin datos de memoria" />;

    const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
      EPISODIC: BookOpen,
      SEMANTIC: Lightbulb,
      FACTUAL: Database,
      PROCEDURAL: FileCode2,
    };

    const TYPE_COLORS: Record<string, string> = {
      EPISODIC: "from-blue-500 to-blue-700",
      SEMANTIC: "from-purple-500 to-purple-700",
      FACTUAL: "from-emerald-500 to-emerald-700",
      PROCEDURAL: "from-orange-500 to-orange-700",
    };

    return (
      <SectionCard>
        <SectionHeading
          icon={Brain}
          title="Memoria"
          action={
            <span className="text-[11px] text-white/30">
              {memory.length} tipos
            </span>
          }
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {memory.map((mem, i) => {
            const TypeIcon = TYPE_ICONS[mem.type.toUpperCase()] ?? HardDrive;
            const color =
              TYPE_COLORS[mem.type.toUpperCase()] ?? "from-gray-500 to-gray-700";
            return (
              <div
                key={i}
                className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br ${color}`}
                  >
                    <TypeIcon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-white/90">
                      {mem.type}
                    </p>
                    {mem.last_access && (
                      <p className="text-[10px] text-white/30">
                        {new Date(mem.last_access).toLocaleString("es-ES")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-white/[0.03]">
                    <p className="text-lg font-bold text-white/90">{mem.count}</p>
                    <p className="text-[10px] text-white/30">registros</p>
                  </div>
                  <div className="p-2 rounded-lg bg-white/[0.03]">
                    <p className="text-lg font-bold text-white/90">
                      {mem.size_bytes
                        ? mem.size_bytes > 1048576
                          ? `${(mem.size_bytes / 1048576).toFixed(1)}MB`
                          : mem.size_bytes > 1024
                            ? `${(mem.size_bytes / 1024).toFixed(1)}KB`
                            : `${mem.size_bytes}B`
                        : "—"}
                    </p>
                    <p className="text-[10px] text-white/30">tamaño</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    );
  }

  /* ── Skills ── */
  function SkillsSection() {
    if (skills.length === 0 && !loading)
      return <EmptyState icon={Sparkles} text="Sin skills registrados" />;

    const LIFECYCLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
      PROPOSED: Lightbulb,
      VALIDATING: Search,
      ACTIVE: Play,
      DEPRECATED: Pause,
      RETIRED: Archive,
    };

    return (
      <SectionCard>
        <SectionHeading
          icon={Sparkles}
          title="Skills"
          action={
            <span className="text-[11px] text-white/30">
              {skills.length} skills
            </span>
          }
        />
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
          {skills.map((skill) => {
            const LifecycleIcon =
              LIFECYCLE_ICONS[skill.status.toUpperCase()] ?? Circle;
            return (
              <div
                key={skill.id}
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center">
                    <LifecycleIcon className="w-4 h-4 text-white/50" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-white/90">
                      {skill.name}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-white/30">
                      {skill.version && <span>v{skill.version}</span>}
                      {skill.description && (
                        <span className="truncate max-w-[200px]">
                          {skill.description}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <StatusBadge status={skill.status} />
              </div>
            );
          })}
        </div>
      </SectionCard>
    );
  }

  /* ── Observability ── */
  function ObservabilitySection() {
    if (!observability)
      return <EmptyState icon={Activity} text="Sin datos de observabilidad" />;

    const stats = [
      {
        label: "Ejecuciones",
        value: observability.total_executions ?? 0,
        icon: Gauge,
        color: "from-blue-500 to-blue-700",
      },
      {
        label: "Tasa de éxito",
        value:
          observability.success_rate !== undefined
            ? `${observability.success_rate.toFixed(1)}%`
            : "—",
        icon: TrendingUp,
        color: "from-emerald-500 to-emerald-700",
      },
      {
        label: "Latencia media",
        value:
          observability.avg_latency_ms !== undefined
            ? `${observability.avg_latency_ms.toFixed(0)}ms`
            : "—",
        icon: Timer,
        color: "from-purple-500 to-purple-700",
      },
      {
        label: "Tasa de error",
        value:
          observability.error_rate !== undefined
            ? `${observability.error_rate.toFixed(2)}%`
            : "—",
        icon: AlertCircle,
        color: "from-red-500 to-red-700",
      },
    ];

    return (
      <div className="space-y-4">
        {/* Stats grid */}
        <SectionCard>
          <SectionHeading icon={Activity} title="Estadísticas de Ejecución" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div
                key={s.label}
                className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]"
              >
                <div
                  className={`inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br ${s.color} mb-2`}
                >
                  <s.icon className="w-4 h-4 text-white" />
                </div>
                <p className="text-xl font-extrabold text-white/90">{s.value}</p>
                <p className="text-[10px] text-white/30">{s.label}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Provider usage */}
        {observability.provider_usage &&
          observability.provider_usage.length > 0 && (
            <SectionCard>
              <SectionHeading icon={Cpu} title="Uso por Provider" />
              <div className="space-y-2">
                {observability.provider_usage.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                  >
                    <span className="text-[12px] font-medium text-white/80 w-24 truncate">
                      {p.provider}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#3b82f6] to-[#7c3aed]"
                        style={{
                          width: `${Math.min(100, (p.calls / Math.max(...observability.provider_usage!.map((x) => x.calls))) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-[11px] text-white/40 w-12 text-right">
                      {p.calls}
                    </span>
                    {p.errors > 0 && (
                      <span className="text-[11px] text-red-400/80">
                        {p.errors} err
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

        {/* Recent errors */}
        {observability.recent_errors &&
          observability.recent_errors.length > 0 && (
            <SectionCard>
              <SectionHeading icon={AlertTriangle} title="Errores Recientes" />
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
                {observability.recent_errors.map((err, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-2.5 rounded-xl bg-red-500/5 border border-red-500/10"
                  >
                    <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[12px] text-white/70">{err.error}</p>
                      <p className="text-[10px] text-white/30">
                        {err.capability} ·{" "}
                        {new Date(err.timestamp).toLocaleString("es-ES")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
      </div>
    );
  }

  /* ── MCP ── */
  function McpSection() {
    if (!mcp) return <EmptyState icon={Server} text="Sin datos MCP" />;
    return (
      <div className="space-y-4">
        {/* Server — what KREA offers */}
        {mcp.server && (
          <SectionCard>
            <SectionHeading
              icon={PlugZap}
              title="KREA ofrece (Server)"
              action={
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  <Send className="w-3 h-3" /> Outbound
                </span>
              }
            />
            {mcp.server.tools && mcp.server.tools.length > 0 ? (
              <div className="space-y-2">
                {mcp.server.tools.map((tool, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                  >
                    <p className="text-[12px] font-semibold text-white/80">
                      {tool.name}
                    </p>
                    <p className="text-[11px] text-white/30 mt-0.5">
                      {tool.description}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/30">Sin herramientas expuestas</p>
            )}
          </SectionCard>
        )}

        {/* Client — what KREA consumes */}
        {mcp.client && (
          <SectionCard>
            <SectionHeading
              icon={Plug}
              title="KREA consume (Client)"
              action={
                <span className="inline-flex items-center gap-1 text-[11px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                  <ExternalLink className="w-3 h-3" /> Inbound
                </span>
              }
            />
            {mcp.client.tools && mcp.client.tools.length > 0 ? (
              <div className="space-y-2">
                {mcp.client.tools.map((tool, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                  >
                    <p className="text-[12px] font-semibold text-white/80">
                      {tool.name}
                    </p>
                    <p className="text-[11px] text-white/30 mt-0.5">
                      {tool.description}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/30">Sin herramientas consumidas</p>
            )}
          </SectionCard>
        )}
      </div>
    );
  }

  /* ── Security ── */
  function SecuritySection() {
    if (!security)
      return <EmptyState icon={Lock} text="Sin datos de seguridad" />;
    return (
      <div className="space-y-4">
        {/* Policies */}
        <SectionCard>
          <SectionHeading
            icon={ShieldCheck}
            title="Políticas"
            action={
              security.policies && (
                <span className="text-[11px] text-white/30">
                  {security.policies.length} reglas
                </span>
              )
            }
          />
          {security.policies && security.policies.length > 0 ? (
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
              {security.policies.map((pol, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-semibold text-white/80">
                      {pol.name}
                    </span>
                    <StatusBadge status={pol.effect} />
                  </div>
                  <p className="text-[11px] text-white/30 font-mono">
                    {pol.rule}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/30">Sin políticas definidas</p>
          )}
        </SectionCard>

        {/* Permissions */}
        <SectionCard>
          <SectionHeading icon={Key} title="Permisos" />
          {security.permissions && security.permissions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {security.permissions.map((perm, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono bg-white/[0.04] text-white/60 border border-white/[0.06]"
                >
                  <Key className="w-3 h-3 text-white/30" />
                  {perm}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/30">Sin permisos definidos</p>
          )}
        </SectionCard>
      </div>
    );
  }

  /* ── Agent Communication ── */
  function AgentCommSection() {
    if (!agentComm)
      return <EmptyState icon={MessageSquare} text="Sin datos de comunicación" />;

    return (
      <div className="space-y-4">
        {/* Interactions */}
        <SectionCard>
          <SectionHeading
            icon={Radio}
            title="Interacciones Recientes"
            action={
              agentComm.interactions && (
                <span className="text-[11px] text-white/30">
                  {agentComm.interactions.length} últimos
                </span>
              )
            }
          />
          {agentComm.interactions && agentComm.interactions.length > 0 ? (
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
              {agentComm.interactions.map((inter, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      inter.direction === "outgoing"
                        ? "bg-blue-500/10"
                        : "bg-emerald-500/10"
                    }`}
                  >
                    {inter.direction === "outgoing" ? (
                      <Send className="w-3.5 h-3.5 text-blue-400" />
                    ) : (
                      <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-white/80">
                        {inter.agent}
                      </span>
                      <ChevronRight className="w-3 h-3 text-white/20" />
                      <span className="text-[11px] text-white/50">
                        {inter.capability}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/30">
                      {new Date(inter.timestamp).toLocaleString("es-ES")}
                    </p>
                  </div>
                  <StatusBadge status={inter.status} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/30">Sin interacciones recientes</p>
          )}
        </SectionCard>

        {/* Delegation rules */}
        <SectionCard>
          <SectionHeading icon={Handshake} title="Reglas de Delegación" />
          {agentComm.delegation_rules &&
          agentComm.delegation_rules.length > 0 ? (
            <div className="space-y-2">
              {agentComm.delegation_rules.map((rule, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[12px] font-semibold text-white/80">
                      {rule.capability}
                    </span>
                    <ArrowRight className="w-3 h-3 text-white/20" />
                    <span className="text-[12px] text-[#3b82f6]">
                      {rule.target}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/30">
                    Condición: {rule.condition}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/30">Sin reglas de delegación</p>
          )}
        </SectionCard>
      </div>
    );
  }

  /* ════════════ Empty State ════════════ */

  function EmptyState({
    icon: Icon,
    text,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    text: string;
  }) {
    return (
      <SectionCard>
        <div className="flex flex-col items-center justify-center py-10 text-white/30">
          <Icon className="w-10 h-10 mb-3 text-white/15" />
          <p className="text-sm">{text}</p>
        </div>
      </SectionCard>
    );
  }

  /* ════════════ Tab Content Router ════════════ */

  function TabContent() {
    if (loading) return <CardSkeleton lines={6} />;

    switch (activeTab) {
      case "identity":
        return <IdentitySection />;
      case "mission":
        return <MissionSection />;
      case "capabilities":
        return <CapabilitiesSection />;
      case "doctor":
        return <DoctorSection />;
      case "memory":
        return <MemorySection />;
      case "skills":
        return <SkillsSection />;
      case "observability":
        return <ObservabilitySection />;
      case "mcp":
        return <McpSection />;
      case "security":
        return <SecuritySection />;
      case "agent-comm":
        return <AgentCommSection />;
      default:
        return null;
    }
  }

  /* ════════════ Render ════════════ */

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold mb-1">
          <span className="gradient-text">ADN</span> General del Agente
        </h1>
        <p className="text-sm text-white/50">
          Visión completa del agente KREA — identidad, capacidades, salud y
          comunicación
        </p>
      </div>

      {/* Overview chips (always visible) */}
      {!loading && (
        <div className="flex flex-wrap gap-2 mb-6">
          {identity && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0f1629] border border-white/[0.06] text-[11px]">
              <Bot className="w-3.5 h-3.5 text-[#3b82f6]" />
              <span className="text-white/70">{identity.name}</span>
              <span className="text-white/30">v{identity.version}</span>
              <StatusBadge status={identity.status} />
            </div>
          )}
          {doctor && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0f1629] border border-white/[0.06] text-[11px]">
              <Stethoscope className="w-3.5 h-3.5 text-[#3b82f6]" />
              <span className="text-white/70">Health</span>
              <StatusBadge status={doctor.status} />
            </div>
          )}
          {capabilities.length > 0 && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0f1629] border border-white/[0.06] text-[11px]">
              <Zap className="w-3.5 h-3.5 text-[#3b82f6]" />
              <span className="text-white/70">
                {capabilities.length} caps
              </span>
              <span className="text-emerald-400">
                {capabilities.filter((c) => c.status.toUpperCase() === "IMPLEMENTED").length}✓
              </span>
            </div>
          )}
          {skills.length > 0 && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0f1629] border border-white/[0.06] text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-[#3b82f6]" />
              <span className="text-white/70">
                {skills.length} skills
              </span>
              <span className="text-emerald-400">
                {skills.filter((s) => s.status.toUpperCase() === "ACTIVE").length}✓
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tab bar */}
      <div className="mb-5 overflow-x-auto scrollbar-none">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#0f1629] border border-white/[0.06]">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-gradient-to-r from-[#3b82f6]/20 to-[#7c3aed]/10 text-white border border-[#3b82f6]/20"
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <TabContent />
    </div>
  );
}
