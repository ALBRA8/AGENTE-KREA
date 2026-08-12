"use client";

import { useState, useEffect } from "react";
import {
  BarChart3, DollarSign, TrendingUp, TrendingDown, Target,
  ShoppingCart, Receipt, Save, Trash2, Plus, AlertTriangle,
  CheckCircle, Calendar, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";

/* ════════════ Types ════════════ */
interface Entry {
  id: string;
  date: string;
  revenue: number;
  investment: number;
  sales: number;
}

interface MetricsTrackerProps {
  userId: string;
}

function fmt(n: number) {
  return n.toLocaleString("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDec(n: number) {
  return n.toLocaleString("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function roasColor(roas: number) {
  if (roas >= 5) return "text-emerald-400";
  if (roas >= 3) return "text-sky-400";
  if (roas >= 1) return "text-amber-400";
  return "text-red-400";
}

function roasLabel(roas: number) {
  if (roas >= 5) return "EXCELENTE";
  if (roas >= 3) return "MUY BUENO";
  if (roas >= 1) return "ATENCION";
  return "PERDIDA";
}

function roasDot(roas: number) {
  if (roas >= 5) return "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]";
  if (roas >= 3) return "bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.7)]";
  if (roas >= 1) return "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.7)]";
  return "bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.7)]";
}

/* ════════════ Component ════════════ */
export default function MetricsTracker({ userId }: MetricsTrackerProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sortAsc, setSortAsc] = useState(false);
  const [showForm, setShowForm] = useState(true);

  // Form state
  const today = new Date().toISOString().split("T")[0];
  const [formDate, setFormDate] = useState(today);
  const [formRevenue, setFormRevenue] = useState("");
  const [formInvestment, setFormInvestment] = useState("");
  const [formSales, setFormSales] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/metrics?userId=${userId}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setEntries(data.entries || []);
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          date: formDate,
          revenue: formRevenue,
          investment: formInvestment,
          sales: formSales,
        }),
      });
      setFormRevenue("");
      setFormInvestment("");
      setFormSales("");
      const loadEntries = async () => {
        try {
          const res = await fetch(`/api/metrics?userId=${userId}`);
          if (res.ok) setEntries((await res.json()).entries || []);
        } catch { /* ignore */ }
      };
      await loadEntries();
    } catch { /* ignore */ }
    setSaving(false);
  };

  const remove = async (id: string) => {
    await fetch(`/api/metrics?id=${id}&userId=${userId}`, { method: "DELETE" });
    const res = await fetch(`/api/metrics?userId=${userId}`);
    if (res.ok) setEntries((await res.json()).entries || []);
  };

  // Computed
  const totals = entries.reduce(
    (acc, e) => {
      acc.revenue += e.revenue;
      acc.investment += e.investment;
      acc.sales += e.sales;
      return acc;
    },
    { revenue: 0, investment: 0, sales: 0 }
  );
  const profit = totals.revenue - totals.investment;
  const roas = totals.investment > 0 ? totals.revenue / totals.investment : 0;
  const avgTicket = totals.sales > 0 ? totals.revenue / totals.sales : 0;

  const sorted = [...entries].sort((a, b) =>
    sortAsc ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
  );

  const strategicAlert = roas < 1
    ? { type: "danger" as const, msg: "OPERACION CON PERDIDAS", items: ["ROAS por debajo de 1 — pausa campanas de bajo rendimiento", "Revisa tu publico objetivo y creativos"] }
    : roas < 3
    ? { type: "warn" as const, msg: "ROAS BAJO — MARGEN AJUSTADO", items: ["Optimiza los segmentos de audiencia", "Prueba nuevos creativos y copys"] }
    : null;

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-white/30">
      <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando metricas...
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-2xl font-extrabold mb-1"><span className="gradient-text">360 Metrics</span></h1>
        <p className="text-sm text-white/50">Seguimiento de campana diaria — ingresos, inversion y ventas en tiempo real.</p>
      </div>

      {/* Form */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#0f1629] p-5">
        <button onClick={() => setShowForm(!showForm)} className="flex items-center justify-between w-full mb-4">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#3b82f6]" />
            <h2 className="text-sm font-bold">Registrar datos del dia</h2>
          </div>
          {showForm ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
        </button>

        {showForm && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="text-[10px] text-white/40 mb-1 block flex items-center gap-1">
                <Calendar className="w-3 h-3" /> FECHA
              </label>
              <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#3b82f6]" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> INGRESOS
              </label>
              <input type="number" inputMode="decimal" placeholder="0" value={formRevenue} onChange={(e) => setFormRevenue(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#3b82f6]" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> INVERSION
              </label>
              <input type="number" inputMode="decimal" placeholder="0" value={formInvestment} onChange={(e) => setFormInvestment(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#3b82f6]" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block flex items-center gap-1">
                <ShoppingCart className="w-3 h-3" /> VENTAS
              </label>
              <input type="number" inputMode="numeric" placeholder="0" value={formSales} onChange={(e) => setFormSales(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#3b82f6]" />
            </div>
            <div className="flex items-end">
              <button onClick={save} disabled={saving}
                className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[#3b82f6] to-[#1e40af] text-white font-bold text-xs shadow-[0_8px_20px_rgba(30,64,175,0.4)] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Guardar
              </button>
            </div>
          </div>
        )}
        <p className="text-[10px] text-white/30 mt-3">Beneficio, ROAS y ticket promedio se calculan automaticamente. Guardar en la misma fecha sobrescribe el registro.</p>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#0f1629] p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-[#3b82f6] to-[#7c3aed]" />
            <h2 className="text-sm font-bold">Control diario de campana</h2>
          </div>
          <button onClick={() => setSortAsc(!sortAsc)} className="text-[10px] text-white/30 hover:text-white/60 flex items-center gap-1">
            {sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Fecha
          </button>
        </div>

        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-2 px-2 text-[10px] font-medium text-white/30">FECHA</th>
                <th className="text-right py-2 px-2 text-[10px] font-medium text-white/30">INGRESOS</th>
                <th className="text-right py-2 px-2 text-[10px] font-medium text-white/30">INVERSION</th>
                <th className="text-right py-2 px-2 text-[10px] font-medium text-white/30">BENEFICIO</th>
                <th className="text-right py-2 px-2 text-[10px] font-medium text-white/30">ROAS</th>
                <th className="text-right py-2 px-2 text-[10px] font-medium text-white/30">VENTAS</th>
                <th className="text-right py-2 px-2 text-[10px] font-medium text-white/30">TICKET</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-white/20 text-xs">Sin registros. Registra el primer dia arriba.</td></tr>
              ) : (
                sorted.map((e) => {
                  const p = e.revenue - e.investment;
                  const r = e.investment > 0 ? e.revenue / e.investment : 0;
                  const t = e.sales > 0 ? e.revenue / e.sales : 0;
                  return (
                    <tr key={e.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="py-2.5 px-2 text-xs text-white/70">{e.date}</td>
                      <td className="py-2.5 px-2 text-xs text-right text-emerald-400 font-medium">{fmt(e.revenue)}</td>
                      <td className="py-2.5 px-2 text-xs text-right text-amber-400 font-medium">{fmt(e.investment)}</td>
                      <td className={`py-2.5 px-2 text-xs text-right font-medium ${p >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(p)}</td>
                      <td className={`py-2.5 px-2 text-xs text-right font-bold ${roasColor(r)}`}>{r.toFixed(2)}</td>
                      <td className="py-2.5 px-2 text-xs text-right text-white/70">{e.sales}</td>
                      <td className="py-2.5 px-2 text-xs text-right text-white/50">{fmt(t)}</td>
                      <td className="py-2.5 px-2 text-right">
                        <button onClick={() => remove(e.id)} className="p-1 rounded hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Consolidado + Estrategia */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Consolidado */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#0f1629] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-[#3b82f6] to-[#7c3aed]" />
            <h2 className="text-sm font-bold">Consolidado</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard iconName="dollar" label="INGRESOS TOTALES" value={fmt(totals.revenue)} color="text-emerald-400" />
            <StatCard iconName="trending" label="INVERSION" value={fmt(totals.investment)} color="text-amber-400" />
            <StatCard iconName={profit >= 0 ? "trending" : "down"} label="BENEFICIO BRUTO" value={fmt(profit)} color={profit >= 0 ? "text-emerald-400" : "text-red-400"} />
            <StatCard iconName="target" label="ROAS GENERAL" value={roas.toFixed(2)} color={roasColor(roas)} />
            <StatCard iconName="cart" label="VENTAS TOTALES" value={totals.sales.toString()} color="text-violet-400" />
            <StatCard iconName="receipt" label="TICKET PROMEDIO" value={fmt(avgTicket)} color="text-pink-400" />
          </div>
        </div>

        {/* Lectura Estrategica */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#0f1629] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-[#3b82f6] to-[#7c3aed]" />
            <h2 className="text-sm font-bold">Lectura estrategica</h2>
          </div>
          {entries.length === 0 ? (
            <div className="text-center py-10 text-white/20">
              <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">Registra datos para ver tu lectura estrategica</p>
            </div>
          ) : strategicAlert ? (
            <div>
              <div className={`flex items-center gap-2 mb-3 ${strategicAlert.type === "danger" ? "text-red-400" : "text-amber-400"}`}>
                {strategicAlert.type === "danger" ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                <span className="font-black text-sm">ALERTA: {strategicAlert.msg}</span>
              </div>
              <ul className="space-y-2">
                {strategicAlert.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-3 text-emerald-400">
                <CheckCircle className="w-5 h-5" />
                <span className="font-black text-sm">OPERACION SALUDABLE</span>
              </div>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-xs text-white/60">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  ROAS de {roas.toFixed(2)} — por encima del punto de equilibrio
                </li>
                <li className="flex items-start gap-2 text-xs text-white/60">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  Ticket promedio de {fmt(avgTicket)} — {avgTicket > 50000 ? "buen ticket" : "considera subir precios"}
                </li>
                <li className="flex items-start gap-2 text-xs text-white/60">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  Sigue registrando datos diariamente para precision
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#0f1629] p-4">
        <div className="flex items-center gap-4 flex-wrap text-xs">
          <span className="font-semibold mr-2">LEYENDA ROAS</span>
          <Legend color={roasDot(6)} label="EXCELENTE (ROAS >= 5)" />
          <Legend color={roasDot(4)} label="MUY BUENO (ROAS 3-4.99)" />
          <Legend color={roasDot(2)} label="ATENCION (ROAS 1-2.99)" />
          <Legend color={roasDot(0.5)} label="PERDIDA (ROAS < 1)" />
        </div>
      </div>
    </div>
  );
}

/* ════════════ Sub-components ════════════ */
function StatCard({ iconName, label, value, color }: { iconName: string; label: string; value: string; color: string }) {
  const iconMap: Record<string, string> = {
    dollar: "text-emerald-400",
    trending: "",
    down: "",
    target: "text-sky-400",
    cart: "text-violet-400",
    receipt: "text-pink-400",
  };
  const iconColor = iconMap[iconName] || color;
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 hover:scale-[1.02] transition-transform">
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/30 tracking-wider"> {label}</div>
      <div className={`text-lg font-black mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="text-white/30 text-[10px]">{label}</span>
    </span>
  );
}
