"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { studentService } from "@/lib/services/student";
import {
  BookOpen, Search, PlayCircle, CheckCircle2, Clock,
  Star, Award, ExternalLink,
} from "lucide-react";
import Link from "next/link";
import type { Enrollment } from "@/types";

type Tab = "progreso" | "completados" | "sin-iniciar";

const LEVEL_LABEL: Record<string, string> = {
  principiante: "Principiante",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
};

const LEVEL_COLOR: Record<string, string> = {
  principiante: "bg-green-100 text-green-700",
  intermedio: "bg-amber-100 text-amber-700",
  avanzado: "bg-red-100 text-red-700",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} semanas`;
  return formatDate(iso);
}

function MisCursosContent() {
  const searchParams = useSearchParams();
  const explicitTab = searchParams.get("tab") as Tab | null;

  const [tab, setTab] = useState<Tab>(explicitTab ?? "progreso");
  const [autoSelected, setAutoSelected] = useState(false);
  const [search, setSearch] = useState("");

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["mis-inscripciones"],
    queryFn: studentService.getMyEnrollments,
  });

  const enProgreso   = enrollments.filter((e) => !e.completed_at && e.progress_percent > 0);
  const completados  = enrollments.filter((e) => !!e.completed_at);
  const sinIniciar   = enrollments.filter((e) => !e.completed_at && e.progress_percent === 0);

  // Selecciona la pestaña por defecto según el estado de los cursos del estudiante,
  // solo si no llegó con un ?tab= explícito (ej. enlace desde el dashboard).
  useEffect(() => {
    if (explicitTab || autoSelected || isLoading) return;
    if (sinIniciar.length > 0) setTab("sin-iniciar");
    else if (enProgreso.length > 0) setTab("progreso");
    else if (completados.length > 0) setTab("completados");
    setAutoSelected(true);
  }, [explicitTab, autoSelected, isLoading, sinIniciar.length, enProgreso.length, completados.length]);

  const tabData: Record<Tab, Enrollment[]> = {
    progreso:      enProgreso,
    completados:   completados,
    "sin-iniciar": sinIniciar,
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return tabData[tab];
    return tabData[tab].filter((e) =>
      e.course?.title.toLowerCase().includes(q)
    );
  }, [tab, search, enrollments]);

  const tabList: { key: Tab; label: string; count: number; icon: React.ReactNode }[] = [
    { key: "progreso",      label: "En progreso",  count: enProgreso.length,  icon: <PlayCircle size={14} /> },
    { key: "completados",   label: "Completados",  count: completados.length, icon: <CheckCircle2 size={14} /> },
    { key: "sin-iniciar",   label: "Sin iniciar",  count: sinIniciar.length,  icon: <Clock size={14} /> },
  ];

  const TAB_COLORS: Record<Tab, { border: string; text: string; badge: string }> = {
    "sin-iniciar": { border: "border-red-600",       text: "text-red-600",       badge: "bg-red-600" },
    progreso:      { border: "border-brand-primary", text: "text-brand-primary", badge: "bg-brand-primary" },
    completados:   { border: "border-emerald-600",   text: "text-emerald-600",   badge: "bg-emerald-600" },
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div>
        <h1 className="text-2xl font-bold text-brand-primary">Mis cursos</h1>
        <p className="text-gray-500 mt-1">
          {enrollments.length} {enrollments.length === 1 ? "curso matriculado" : "cursos matriculados"}
        </p>
      </div>

      {/* Buscador */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar curso..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#084D95] focus:border-transparent"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabList.map(({ key, label, count, icon }) => {
          const colors = TAB_COLORS[key];
          const isActive = tab === key;
          const isColored = count > 0 || isActive;
          return (
            <button
              key={key}
              onClick={() => { setTab(key); setSearch(""); }}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isColored ? colors.text : "text-gray-500 hover:text-gray-700"
              } ${isActive ? colors.border : "border-transparent"}`}
            >
              {icon}
              {label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${isColored ? `${colors.badge} text-white` : "bg-gray-100 text-gray-500"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Contenido */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 h-32 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState search={search} tab={tab} />
      ) : (
        <div className="space-y-4">
          {filtered.map((enrollment) => (
            <EnrollmentRow key={enrollment.id} enrollment={enrollment} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MisCursosPage() {
  return (
    <Suspense fallback={null}>
      <MisCursosContent />
    </Suspense>
  );
}

function EnrollmentRow({ enrollment }: { enrollment: Enrollment }) {
  const course = enrollment.course;
  if (!course) return null;

  const isCompleted = !!enrollment.completed_at;
  const needsReview = isCompleted && !enrollment.has_review;
  const level = course.level ?? "";
  const isExpired = !!enrollment.access_expires_at && new Date(enrollment.access_expires_at) < new Date();
  const isSuspended = !!enrollment.suspended_at;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex gap-5 hover:shadow-sm transition-shadow">
      {/* Thumbnail */}
      <div className="w-28 h-20 rounded-lg bg-[#084D95]/10 flex items-center justify-center shrink-0 overflow-hidden">
        {course.thumbnail_url
          ? <img src={course.thumbnail_url} alt="" className="w-full h-full object-cover" />
          : <BookOpen size={28} className="text-[#084D95]/40" />
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <h3 className="font-semibold text-brand-primary leading-snug">{course.title}</h3>
          {level && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${LEVEL_COLOR[level] ?? "bg-gray-100 text-gray-600"}`}>
              {LEVEL_LABEL[level] ?? level}
            </span>
          )}
          {needsReview && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
              <Star size={10} />
              Reseña pendiente
            </span>
          )}
          {isCompleted && !needsReview && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
              <Award size={10} />
              Certificado disponible
            </span>
          )}
          {isSuspended && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              Bloqueado
            </span>
          )}
          {!isSuspended && isExpired && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              Acceso vencido
            </span>
          )}
        </div>

        {/* Progreso */}
        <div className="flex items-center gap-3 mt-2">
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full max-w-xs">
            <div
              className={`h-1.5 rounded-full transition-all ${isCompleted ? "bg-emerald-500" : "bg-[#084D95]"}`}
              style={{ width: `${enrollment.progress_percent}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">{enrollment.progress_percent}%</span>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-400">
          <span>Matriculado: {formatDate(enrollment.enrolled_at)}</span>
          {enrollment.last_accessed_at && (
            <span>Último acceso: {formatRelative(enrollment.last_accessed_at)}</span>
          )}
          {course.total_duration_minutes && (
            <span>{Math.round(course.total_duration_minutes / 60)}h de contenido</span>
          )}
          {isCompleted && enrollment.completed_at && (
            <span className="text-emerald-600 font-medium">Completado: {formatDate(enrollment.completed_at)}</span>
          )}
          {enrollment.access_expires_at && (
            <span className={isExpired ? "text-red-600 font-medium" : ""}>
              {isExpired ? "Acceso venció: " : "Acceso vence: "}
              {formatDate(enrollment.access_expires_at)}
            </span>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div className="flex flex-col gap-2 shrink-0 justify-center">
        <Link
          href={`/curso/${enrollment.course_id}`}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            needsReview
              ? "bg-amber-500 text-white hover:bg-amber-600"
              : isCompleted
              ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
              : "bg-[#084D95] text-white hover:bg-[#084D95]/90"
          }`}
        >
          {needsReview ? <Star size={14} /> : isCompleted ? <BookOpen size={14} /> : <PlayCircle size={14} />}
          {needsReview ? "Dejar reseña" : isCompleted ? "Revisar" : enrollment.progress_percent === 0 ? "Empezar" : "Continuar"}
        </Link>
        {isCompleted && !needsReview && (
          <Link
            href={`/certificado/${enrollment.id}`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-emerald-700 border border-emerald-300 hover:bg-emerald-50 transition-colors"
          >
            <ExternalLink size={14} />
            Certificado
          </Link>
        )}
      </div>
    </div>
  );
}

function EmptyState({ search, tab }: { search: string; tab: Tab }) {
  if (search) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-gray-300 py-14 text-center">
        <Search size={36} className="text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No se encontraron cursos con "{search}"</p>
      </div>
    );
  }
  const messages: Record<Tab, string> = {
    progreso:      "No tienes cursos en progreso",
    completados:   "Aún no completaste ningún curso",
    "sin-iniciar": "No tienes cursos pendientes de iniciar",
  };
  return (
    <div className="bg-white rounded-xl border border-dashed border-gray-300 py-14 text-center">
      <BookOpen size={36} className="text-gray-300 mx-auto mb-3" />
      <p className="text-gray-500 font-medium">{messages[tab]}</p>
      {tab !== "completados" && (
        <Link
          href="/cursos"
          className="inline-block mt-4 bg-[#084D95] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#084D95]/90 transition-colors"
        >
          Explorar catálogo
        </Link>
      )}
    </div>
  );
}
