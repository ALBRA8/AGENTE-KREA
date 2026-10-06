"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  Play,
  Sparkles,
  Video,
  Image,
  BookOpen,
  Wand2,
  Zap,
  Clock,
  Target,
  TrendingUp,
  Users,
  Star,
  Check,
  ChevronDown,
  ArrowRight,
  Menu,
  X,
  Palette,
  FileText,
  Bot,
  BarChart3,
  MessageSquare,
  Shield,
  LayoutDashboard,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import AppShell from "@/components/app/AppShell";
import AuthPage from "@/components/app/AuthPage";

/* ─────────── Animated Counter ─────────── */
function AnimatedCounter({
  target,
  suffix = "",
  prefix = "",
}: {
  target: number;
  suffix?: string;
  prefix?: string;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const duration = 2000;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, target]);

  return (
    <span ref={ref}>
      {prefix}
      {count.toLocaleString("es-ES")}
      {suffix}
    </span>
  );
}

/* ─────────── Fade In Section ─────────── */
function FadeInSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─────────── Nav ─────────── */
function Navbar({ onEnterApp }: { onEnterApp: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { label: "Herramientas", href: "#herramientas" },
    { label: "Cómo funciona", href: "#como-funciona" },
    { label: "Beneficios", href: "#beneficios" },
    { label: "Planes", href: "#planes" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "backdrop-blur-xl bg-[rgba(15,22,41,0.6)] border-b border-white/[0.08] py-3 shadow-lg shadow-black/20"
          : "py-5 bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
        <a href="#" className="flex items-center gap-3 group">
          <img
            src="/krea-logo.png"
            alt="Krea"
            className="h-9 w-9 rounded-lg object-contain transition-transform group-hover:scale-110"
          />
          <span className="text-lg font-bold tracking-tight">
            <span className="gradient-text">Krea</span>
          </span>
        </a>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-white/60 hover:text-white transition-colors duration-200"
            >
              {l.label}
            </a>
          ))}
          <button
            onClick={onEnterApp}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-b from-[#3b82f6] to-[#1e40af] text-sm font-bold text-white shadow-[0_10px_24px_rgba(30,64,175,0.45)] hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
          >
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </button>
          <a
            href="#planes"
            className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-white/70 hover:text-white hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Comenzar ahora
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-white/80 hover:text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden backdrop-blur-xl bg-[rgba(15,22,41,0.6)] border border-white/[0.08] mt-2 mx-4 rounded-2xl overflow-hidden"
          >
            <div className="flex flex-col p-4 gap-3">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-sm text-white/70 hover:text-white py-2 px-3 rounded-lg hover:bg-white/5 transition-all"
                >
                  {l.label}
                </a>
              ))}
              <button
                onClick={() => { setMobileOpen(false); onEnterApp(); }}
                className="flex items-center justify-center gap-2 w-full text-center px-5 py-3 rounded-xl bg-gradient-to-b from-[#3b82f6] to-[#1e40af] text-sm font-bold text-white"
              >
                <LayoutDashboard className="w-4 h-4" /> Ir al Dashboard
              </button>
              <a
                href="#planes"
                onClick={() => setMobileOpen(false)}
                className="w-full text-center px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-white/70"
              >
                Comenzar ahora
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

/* ─────────── Hero ─────────── */
function Hero({ onEnterApp }: { onEnterApp: () => void }) {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-24 pb-16 overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-40"
          style={{
            background:
              "radial-gradient(circle, rgba(124, 58, 237, 0.35) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full opacity-30"
          style={{
            background:
              "radial-gradient(circle, rgba(37, 99, 235, 0.3) 0%, transparent 70%)",
          }}
        />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto text-center flex flex-col items-center gap-6">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs font-medium text-white/70"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#7c3aed]" />
          Potenciado por Inteligencia Artificial
        </motion.div>

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="animate-float"
        >
          <img
            src="/krea-logo.png"
            alt="Krea Logo"
            className="h-20 w-20 md:h-24 md:w-24 object-contain"
          />
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight tracking-tight"
        >
          Tu fábrica de contenido
          <br />
          <span className="gradient-text">con Inteligencia Artificial</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-base sm:text-lg text-white/60 max-w-xl leading-relaxed"
        >
          Crea{" "}
          <span className="text-white font-semibold">Creativos Profesionales</span>{" "}
          en imágenes y videos con IA — incluso sin experiencia y sin saber nada
          de diseño o edición.
        </motion.p>

        {/* Video placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="w-full max-w-xl aspect-video rounded-2xl overflow-hidden border border-white/10 bg-black/40 relative group cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#7c3aed]/20 to-[#2563eb]/20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-white/20 transition-all duration-300">
              <Play className="w-7 h-7 text-white ml-1" fill="white" />
            </div>
          </div>
          <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2 text-xs text-white/50">
            <Clock className="w-3.5 h-3.5" />
            Descubre cómo funciona en 2 minutos
          </div>
        </motion.div>

        {/* Pain point */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center space-y-2 max-w-lg"
        >
          <p className="text-sm text-white/50">
            Basta de perder horas produciendo{" "}
            <span className="text-red-400 font-semibold">creativos amateurs</span>{" "}
            que nunca traen resultados.
          </p>
          <p className="text-base font-bold text-white">
            Krea hace todo el trabajo por ti.
          </p>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="w-full max-w-md"
        >
          <button
            onClick={onEnterApp}
            className="animate-pulse-glow block w-full py-4 px-6 rounded-2xl bg-gradient-to-b from-[#3b82f6] to-[#1e40af] text-center font-extrabold text-base text-white border border-white/10 hover:brightness-110 hover:scale-[1.01] active:scale-[0.99] transition-all"
          >
            Ir al Dashboard
            <ArrowRight className="inline-block w-4 h-4 ml-2" />
          </button>
          <p className="mt-3 text-xs text-white/40 text-center">
            Sin tarjeta de crédito &bull; Acceso inmediato &bull; Resultados
            desde el día 1
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/* ─────────── Tools / Features ─────────── */
const tools = [
  {
    icon: Video,
    title: "Videos con IA",
    desc: "Genera videos profesionales con actores virtuales, voces naturales y efectos cinematográficos. Ideales para reels, ads y contenido viral.",
    color: "from-blue-500 to-blue-700",
  },
  {
    icon: Image,
    title: "Creativos e Imágenes",
    desc: "Crea imágenes de alta resolución para redes sociales, anuncios y campañas. Estilos ilimitados con prompts inteligentes en español.",
    color: "from-purple-500 to-purple-700",
  },
  {
    icon: BookOpen,
    title: "Ebooks y PDFs",
    desc: "Genera ebooks completos, guías y lead magnets profesionales en minutos. Ideal para captar leads y posicionar tu marca.",
    color: "from-emerald-500 to-emerald-700",
  },
  {
    icon: FileText,
    title: "Copywriting IA",
    desc: "Escribe textos que venden: titulares, descripciones, scripts de video, emails y contenido para blogs con IA especializada en conversión.",
    color: "from-orange-500 to-orange-700",
  },
  {
    icon: Bot,
    title: "Chatbots Inteligentes",
    desc: "Crea asistentes virtuales para atención al cliente, ventas y soporte. Se entrenan con tu información y responden 24/7.",
    color: "from-pink-500 to-pink-700",
  },
  {
    icon: BarChart3,
    title: "Estrategia de Contenido",
    desc: "Planifica calendarios editoriales, obtén ideas virales y optimiza tu estrategia de contenido con análisis de tendencias en tiempo real.",
    color: "from-cyan-500 to-cyan-700",
  },
];

function ToolsSection() {
  return (
    <section id="herramientas" className="relative py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <FadeInSection className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs font-medium text-white/70 mb-6">
            <Wand2 className="w-3.5 h-3.5 text-[#7c3aed]" />
            Herramientas de IA
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Todo lo que necesitas para
            <br />
            <span className="gradient-text">crear contenido que vende</span>
          </h2>
          <p className="text-white/50 max-w-lg mx-auto leading-relaxed">
            Seis herramientas profesionales de inteligencia artificial diseñadas
            para que produzcas contenido de calidad sin experiencia previa.
          </p>
        </FadeInSection>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {tools.map((tool, i) => (
            <FadeInSection key={tool.title} delay={i * 0.1}>
              <div className="group relative h-full p-6 rounded-2xl bg-[#0f1629] border border-white/[0.06] hover:border-white/15 transition-all duration-300 hover:-translate-y-1">
                <div
                  className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${tool.color} mb-4`}
                >
                  <tool.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-2">{tool.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  {tool.desc}
                </p>
              </div>
            </FadeInSection>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────── How it Works ─────────── */
const steps = [
  {
    num: "01",
    title: "Elige tu herramienta",
    desc: "Selecciona entre videos, imágenes, ebooks, copy, chatbots o estrategia. Cada herramienta está diseñada para un tipo de contenido específico.",
    icon: Palette,
  },
  {
    num: "02",
    title: "Describe lo que quieres",
    desc: "Escribe en español lo que necesitas. La IA entiende contexto, tono y objetivo. No necesitas ser experto en prompts ni en diseño.",
    icon: MessageSquare,
  },
  {
    num: "03",
    title: "La IA crea por ti",
    desc: "En segundos, Krea genera contenido profesional listo para usar. Puedes editarlo, refinarlo y exportarlo en los formatos que necesites.",
    icon: Zap,
  },
  {
    num: "04",
    title: "Publica y vende más",
    desc: "Sube tus creativos a redes, ads o tu web. Contenido profesional que engancha, convierte y posiciona tu marca por encima de la competencia.",
    icon: TrendingUp,
  },
];

function HowItWorksSection() {
  return (
    <section id="como-funciona" className="relative py-24 px-4">
      {/* Accent line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-5xl mx-auto">
        <FadeInSection className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs font-medium text-white/70 mb-6">
            <Clock className="w-3.5 h-3.5 text-[#7c3aed]" />
            En 4 simples pasos
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Cómo funciona
            <span className="gradient-text"> Krea</span>
          </h2>
          <p className="text-white/50 max-w-lg mx-auto leading-relaxed">
            De la idea al contenido publicado en menos de 3 minutos. Así de
            simple es revolucionar tu producción de contenido.
          </p>
        </FadeInSection>

        <div className="relative">
          {/* Vertical line connector (desktop) */}
          <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-[#2563eb]/40 via-[#7c3aed]/40 to-transparent" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            {steps.map((step, i) => (
              <FadeInSection
                key={step.num}
                delay={i * 0.15}
                className={i % 2 === 1 ? "lg:mt-20" : ""}
              >
                <div className="relative flex gap-5">
                  {/* Step number */}
                  <div className="flex-shrink-0 relative">
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center text-sm font-bold ${
                        i % 2 === 0
                          ? "bg-gradient-to-br from-[#3b82f6] to-[#1e40af]"
                          : "bg-gradient-to-br from-[#7c3aed] to-[#5b21b6]"
                      }`}
                    >
                      {step.num}
                    </div>
                    {i < steps.length - 1 && (
                      <div className="lg:hidden absolute top-14 left-1/2 -translate-x-1/2 w-px h-8 bg-white/10" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-1.5">{step.title}</h3>
                    <p className="text-sm text-white/50 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────── Benefits / Social Proof ─────────── */
const benefits = [
  {
    icon: Clock,
    title: "Ahorra 90% del tiempo",
    desc: "Lo que antes te tomaba horas ahora toma minutos. Automatiza la creación de contenido y enfócate en crecer tu negocio.",
  },
  {
    icon: Target,
    title: "Contenido que convierte",
    desc: "Cada pieza está optimizada para generar engagement y ventas. No más contenido decorativo sin impacto real en tus resultados.",
  },
  {
    icon: Zap,
    title: "Sin curva de aprendizaje",
    desc: "Interfaz intuitiva en español. Si sabes escribir lo que quieres, ya sabes usar Krea. Cero experiencia técnica requerida.",
  },
  {
    icon: Shield,
    title: "Calidad profesional",
    desc: "Resultados comparables a producciones de agencias que cobran miles de dólares. Tu contenido se verá siempre impecable.",
  },
];

const stats = [
  { value: 15000, suffix: "+", label: "Usuarios activos" },
  { value: 500000, suffix: "+", label: "Contenidos creados" },
  { value: 98, suffix: "%", label: "Satisfacción" },
  { value: 3, suffix: " min", label: "Tiempo promedio" },
];

function BenefitsSection() {
  return (
    <section id="beneficios" className="relative py-24 px-4">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-6xl mx-auto">
        <FadeInSection className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs font-medium text-white/70 mb-6">
            <TrendingUp className="w-3.5 h-3.5 text-[#7c3aed]" />
            ¿Por qué Krea?
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Deja de crear contenido
            <br />
            <span className="gradient-text">como un aficionado</span>
          </h2>
        </FadeInSection>

        {/* Benefits grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-16">
          {benefits.map((b, i) => (
            <FadeInSection key={b.title} delay={i * 0.1}>
              <div className="flex gap-4 p-5 rounded-2xl bg-[#0f1629] border border-white/[0.06]">
                <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-[#2563eb]/20 to-[#7c3aed]/20 flex items-center justify-center">
                  <b.icon className="w-5 h-5 text-[#3b82f6]" />
                </div>
                <div>
                  <h3 className="font-bold mb-1">{b.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">
                    {b.desc}
                  </p>
                </div>
              </div>
            </FadeInSection>
          ))}
        </div>

        {/* Stats */}
        <FadeInSection>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="text-center p-6 rounded-2xl bg-[#0f1629] border border-white/[0.06]"
              >
                <div className="text-3xl sm:text-4xl font-extrabold gradient-text mb-1">
                  <AnimatedCounter target={s.value} suffix={s.suffix} />
                </div>
                <p className="text-xs text-white/50">{s.label}</p>
              </div>
            ))}
          </div>
        </FadeInSection>

        {/* Testimonials */}
        <FadeInSection delay={0.2} className="mt-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                name: "María González",
                role: "Marketing Manager",
                text: "Krea transformó nuestra producción de contenido. Pasamos de crear 5 piezas al mes a más de 50, con mejor calidad.",
                avatar: "MG",
              },
              {
                name: "Carlos Méndez",
                role: "Emprendedor Digital",
                text: "Sin saber nada de diseño, ahora creo videos profesionales para mis ads. Mis costos de producción cayeron un 80%.",
                avatar: "CM",
              },
              {
                name: "Laura Patiño",
                role: "Creadora de Contenido",
                text: "La herramienta de ebooks me permitió lanzar 3 lead magnets en una semana. Mi lista de correo se triplicó en un mes.",
                avatar: "LP",
              },
            ].map((t) => (
              <div
                key={t.name}
                className="p-6 rounded-2xl bg-[#0f1629] border border-white/[0.06]"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star
                      key={j}
                      className="w-4 h-4 text-yellow-400 fill-yellow-400"
                    />
                  ))}
                </div>
                <p className="text-sm text-white/60 leading-relaxed mb-4 italic">
                  &ldquo;{t.text}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#7c3aed] flex items-center justify-center text-xs font-bold">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-white/40">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </FadeInSection>
      </div>
    </section>
  );
}

/* ─────────── Pricing ─────────── */
const plans = [
  {
    name: "Starter",
    price: "27",
    period: "/mes",
    desc: "Perfecto para comenzar a crear contenido con IA",
    features: [
      "50 imágenes por mes",
      "10 videos cortos (30s)",
      "5 ebooks / guías",
      "Copywriting básico",
      "Soporte por email",
    ],
    popular: false,
  },
  {
    name: "Profesional",
    price: "57",
    period: "/mes",
    desc: "Para creadores y emprendedores serios",
    features: [
      "500 imágenes por mes",
      "50 videos (hasta 2 min)",
      "Ebooks ilimitados",
      "Copywriting avanzado",
      "1 chatbot personalizado",
      "Calendario editorial IA",
      "Soporte prioritario",
    ],
    popular: true,
  },
  {
    name: "Agencia",
    price: "127",
    period: "/mes",
    desc: "Para equipos y agencias de marketing",
    features: [
      "Imagenes ilimitadas",
      "Videos ilimitados",
      "Todo lo de Profesional",
      "5 chatbots personalizados",
      "Estrategia de contenido IA",
      "API de acceso",
      "Cuenta gerente dedicado",
    ],
    popular: false,
  },
];

function PricingSection() {
  return (
    <section id="planes" className="relative py-24 px-4">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-5xl mx-auto">
        <FadeInSection className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs font-medium text-white/70 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-[#7c3aed]" />
            Planes y precios
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Elige el plan que impulse
            <br />
            <span className="gradient-text">tu producción de contenido</span>
          </h2>
          <p className="text-white/50 max-w-lg mx-auto leading-relaxed">
            Invierte en tu contenido. Todos los planes incluyen acceso
            inmediato y sin compromiso.
          </p>
        </FadeInSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {plans.map((plan, i) => (
            <FadeInSection key={plan.name} delay={i * 0.15}>
              <div
                className={`relative h-full p-6 rounded-2xl border transition-all duration-300 hover:-translate-y-1 ${
                  plan.popular
                    ? "bg-gradient-to-b from-[#0f1e3d] to-[#0a1128] border-[#2563eb]/50 glow-blue"
                    : "bg-[#0f1629] border-white/[0.06]"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#3b82f6] to-[#7c3aed] text-xs font-bold">
                    Más popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                  <p className="text-xs text-white/40">{plan.desc}</p>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-extrabold">
                    ${plan.price}
                  </span>
                  <span className="text-white/40 text-sm">{plan.period}</span>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check className="w-4 h-4 text-[#3b82f6] flex-shrink-0 mt-0.5" />
                      <span className="text-white/60">{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all hover:brightness-110 active:scale-[0.98] ${
                    plan.popular
                      ? "bg-gradient-to-b from-[#3b82f6] to-[#1e40af] text-white shadow-[0_10px_24px_rgba(30,64,175,0.45)]"
                      : "bg-white/5 text-white border border-white/10 hover:bg-white/10"
                  }`}
                >
                  Comenzar con {plan.name}
                </button>
              </div>
            </FadeInSection>
          ))}
        </div>

        <FadeInSection delay={0.3} className="mt-10 text-center">
          <p className="text-xs text-white/30">
            <Shield className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
            Garantía de devolución de 7 días. Sin preguntas. Paga de forma
            segura con tarjeta o PayPal.
          </p>
        </FadeInSection>
      </div>
    </section>
  );
}

/* ─────────── FAQ ─────────── */
const faqs = [
  {
    q: "¿Necesito experiencia en diseño o edición para usar Krea?",
    a: "No, absolutamente. Krea está diseñado para personas sin experiencia técnica. Solo necesitas escribir en español lo que quieres crear y la IA hace el resto. La interfaz es intuitiva y los resultados son profesionales desde el primer uso.",
  },
  {
    q: "¿Qué tipo de contenido puedo crear?",
    a: "Puedes crear videos con actores virtuales, imágenes de alta resolución para redes sociales, ebooks completos, textos publicitarios (copywriting), chatbots inteligentes y planes de estrategia de contenido. Todo en español y optimizado para convertir.",
  },
  {
    q: "¿Cuánto tiempo toma crear un contenido?",
    a: "La mayoría de los contenidos se generan en menos de 3 minutos. Una imagen toma entre 10 y 30 segundos, un video corto de 30 segundos se procesa en 2-3 minutos, y un ebook completo puede estar listo en menos de 5 minutos dependiendo de la extensión.",
  },
  {
    q: "¿Puedo cancelar mi suscripción en cualquier momento?",
    a: "Sí, puedes cancelar tu plan en cualquier momento sin penalizaciones. Además, ofrecemos una garantía de devolución de 7 días. Si no estás satisfecho, te devolvemos tu dinero sin hacer preguntas.",
  },
  {
    q: "¿Los contenidos generados son únicos?",
    a: "Sí, cada pieza de contenido generada es 100% única. La IA crea desde cero cada vez, por lo que nunca tendrás contenido duplicado. Los derechos de uso son tuyos y puedes usarlos comercialmente sin restricciones.",
  },
  {
    q: "¿Ofrecen soporte en español?",
    a: "Sí, todo nuestro equipo de soporte habla español. Ofrecemos asistencia por email, chat en vivo y una base de conocimientos con tutoriales en video. Los planes Profesional y Agencia incluyen soporte prioritario.",
  },
];

function FAQSection() {
  return (
    <section id="faq" className="relative py-24 px-4">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-2xl mx-auto">
        <FadeInSection className="text-center mb-12">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs font-medium text-white/70 mb-6">
            <MessageSquare className="w-3.5 h-3.5 text-[#7c3aed]" />
            Preguntas frecuentes
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            ¿Tienes <span className="gradient-text">dudas</span>?
          </h2>
        </FadeInSection>

        <FadeInSection delay={0.15}>
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="rounded-2xl border border-white/[0.06] bg-[#0f1629] px-6 data-[state=open]:border-white/15 transition-colors"
              >
                <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline py-4">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-white/50 leading-relaxed pb-4">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </FadeInSection>
      </div>
    </section>
  );
}

/* ─────────── Final CTA ─────────── */
function FinalCTA() {
  return (
    <section className="relative py-24 px-4">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-3xl mx-auto">
        <FadeInSection>
          <div className="relative rounded-3xl overflow-hidden p-8 sm:p-12 text-center">
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#1e40af]/30 via-[#0f1629] to-[#5b21b6]/30" />
            <div className="absolute inset-0 border border-white/10 rounded-3xl" />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs font-medium text-white/70 mb-6">
                <Users className="w-3.5 h-3.5 text-[#7c3aed]" />
                Más de 15,000 creadores confían en nosotros
              </div>

              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
                Empieza a crear contenido
                <br />
                <span className="gradient-text">profesional hoy mismo</span>
              </h2>

              <p className="text-white/50 max-w-md mx-auto mb-8 leading-relaxed">
                No más excusas. No más creados amateurs. Krea es tu
                fábrica de contenido con IA lista para trabajar por ti.
              </p>

              <a
                href="#planes"
                className="animate-pulse-glow inline-block px-10 py-4 rounded-2xl bg-gradient-to-b from-[#3b82f6] to-[#1e40af] font-extrabold text-base text-white border border-white/10 hover:brightness-110 hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                Comenzar ahora &mdash; Desde $27/mes
              </a>

              <p className="mt-4 text-xs text-white/30">
                Acceso inmediato &bull; Garantía 7 días &bull; Cancela cuando
                quieras
              </p>
            </div>
          </div>
        </FadeInSection>
      </div>
    </section>
  );
}

/* ─────────── Footer ─────────── */
function Footer() {
  return (
    <footer className="border-t border-white/[0.06] py-10 px-4">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src="/krea-logo.png"
            alt="Krea"
            className="h-7 w-7 rounded-md object-contain"
          />
          <span className="text-sm text-white/40">
            © {new Date().getFullYear()} Krea. Todos los derechos
            reservados.
          </span>
        </div>
        <div className="flex items-center gap-6 text-xs text-white/30">
          <a href="#" className="hover:text-white/60 transition-colors">
            Términos de uso
          </a>
          <a href="#" className="hover:text-white/60 transition-colors">
            Política de privacidad
          </a>
          <a href="#" className="hover:text-white/60 transition-colors">
            Contacto
          </a>
        </div>
      </div>
    </footer>
  );
}

/* ─────────── Landing Page ─────────── */
function LandingPage({ onEnterApp }: { onEnterApp: () => void }) {
  return (
    <main className="min-h-screen flex flex-col">
      <Navbar onEnterApp={onEnterApp} />
      <Hero onEnterApp={onEnterApp} />
      <ToolsSection />
      <HowItWorksSection />
      <BenefitsSection />
      <PricingSection />
      <FAQSection />
      <FinalCTA />
      <Footer />
    </main>
  );
}

/* ════════════ Floating App Button ════════════ */
function FloatingAppButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl bg-gradient-to-b from-[#3b82f6] to-[#1e40af] text-white font-bold text-sm shadow-[0_10px_24px_rgba(30,64,175,0.5)] hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
    >
      <Sparkles className="w-4 h-4" />
      Acceder a la App
    </button>
  );
}

/* ════════════ Root Router ════════════ */
type View = "landing" | "auth" | "app";

/* Fallback demo user saved to localStorage when auto-login API fails */
function saveFallbackUser() {
  const fallback = { id: "demo-fallback", name: "Usuario Demo", email: "demo@krea.ai", credits: 50, plan: "starter" };
  localStorage.setItem("p360_token", fallback.id);
  localStorage.setItem("p360_user", JSON.stringify(fallback));
  return fallback;
}

export default function Home() {
  const [view, setView] = useState<"loading" | View>("loading");
  const [key, setKey] = useState(0);

  async function onEnterApp() {
    try {
      const res = await fetch("/api/auth/auto-login", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("p360_token", data.id);
        localStorage.setItem("p360_user", JSON.stringify(data));
      } else {
        saveFallbackUser();
      }
    } catch {
      saveFallbackUser();
    }
    setView("app");
    setKey(k => k + 1);
  }

  useEffect(() => {
    // On mount: if token exists, enter app directly; otherwise auto-login
    const token = localStorage.getItem("p360_token");
    if (token) {
      setView("app");
    } else {
      // Auto-login on first visit so user goes straight to dashboard
      onEnterApp();
    }
  }, []);

  if (view === "loading") {
    return (
      <div className="min-h-screen bg-[#080c16] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-white/50">Cargando Krea...</p>
        </div>
      </div>
    );
  }

  if (view === "app") {
    return <AppShell key={key} onLogout={() => { setView("auth"); setKey(k => k + 1); }} />;
  }

  if (view === "auth") {
    return <AuthPage onLogin={() => { setView("app"); setKey(k => k + 1); }} />;
  }

  return (
    <>
      <LandingPage onEnterApp={onEnterApp} />
      <FloatingAppButton onClick={onEnterApp} />
    </>
  );
}