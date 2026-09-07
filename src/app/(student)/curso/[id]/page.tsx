"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { studentService } from "@/lib/services/student";
import {
  ChevronLeft, ChevronRight, CheckCircle2, PlayCircle, Circle,
  FileText, ExternalLink, ChevronDown, Star, X, Award, Loader2,
} from "lucide-react";
import Link from "next/link";
import type { CourseContent } from "@/types";

// ── Tipos YouTube IFrame API ──────────────────────────────────────────────────
declare global {
  interface Window {
    YT: {
      Player: new (el: HTMLElement, opts: YTPlayerOptions) => YTPlayer;
      PlayerState: { PLAYING: 1; PAUSED: 2; ENDED: 0; BUFFERING: 3; UNSTARTED: -1 };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}
interface YTPlayerOptions {
  videoId: string;
  playerVars?: { autoplay?: 0 | 1; rel?: 0 | 1; modestbranding?: 0 | 1; start?: number };
  events?: {
    onReady?: (e: { target: YTPlayer }) => void;
    onStateChange?: (e: { data: number; target: YTPlayer }) => void;
  };
}
interface YTPlayer {
  getCurrentTime(): number;
  getDuration(): number;
  loadVideoById(id: string, start?: number): void;
  destroy(): void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadYouTubeAPI(onReady: () => void) {
  if (typeof window === "undefined") return;
  if (window.YT?.Player) { onReady(); return; }
  if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  }
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => { prev?.(); onReady(); };
}

const MATERIAL_ICON: Record<string, string> = {
  PDF: "📄", Excel: "📊", Word: "📝", Otro: "📎",
};

type AccessBlockReason = "vencido" | "suspendido" | null;

function getAccessBlockReason(err: unknown): AccessBlockReason {
  const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
  if (typeof msg !== "string") return null;
  const lower = msg.toLowerCase();
  if (lower.includes("suspendido")) return "suspendido";
  if (lower.includes("vencido")) return "vencido";
  return null;
}

const ACCESS_BLOCK_MESSAGES: Record<Exclude<AccessBlockReason, null>, string> = {
  vencido: "Tu acceso a este curso ha vencido. Contacta a soporte para renovarlo.",
  suspendido: "Tu acceso a este curso ha sido suspendido. Contacta a soporte para más información.",
};

// ── Página principal ──────────────────────────────────────────────────────────
export default function CourseViewerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: content, isLoading: loadingContent, error: contentError } = useQuery({
    queryKey: ["course-content", id],
    queryFn: () => studentService.getCourseContent(id),
    enabled: !!id,
    retry: false,
  });

  const { data: progressData, isLoading: loadingProgress, error: progressError } = useQuery({
    queryKey: ["course-progress", id],
    queryFn: () => studentService.getMyCourseProgress(id),
    enabled: !!id,
    retry: false,
  });

  // Estado del visor
  const videoSectionRef = useRef<HTMLDivElement>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");
  const [completedSet, setCompletedSet] = useState<Set<string>>(new Set());
  const [progressPercent, setProgressPercent] = useState(0);
  const [hasReview, setHasReview] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showAutoAdvance, setShowAutoAdvance] = useState(false);
  const [autoAdvanceCount, setAutoAdvanceCount] = useState(5);
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());

  // Inicializar estado cuando llegan los datos
  useEffect(() => {
    if (!content || !progressData) return;

    const allSessions = content.modules.flatMap((m) => m.sessions);

    // Progreso por sesión
    const done = new Set<string>();
    for (const lp of progressData.lesson_progress) {
      if (lp.completed) done.add(lp.session_id);
    }
    setCompletedSet(done);
    setProgressPercent(progressData.enrollment.progress_percent);
    setHasReview(progressData.has_review);

    // Sesión inicial: última vista o primera del curso
    if (!currentSessionId) {
      const lastViewed = progressData.lesson_progress
        .filter((lp) => lp.last_watched_at)
        .sort((a, b) => new Date(b.last_watched_at).getTime() - new Date(a.last_watched_at).getTime())[0];

      const initial = lastViewed?.session_id ?? allSessions[0]?.id ?? "";
      setCurrentSessionId(initial);

      // Abrir el módulo que contiene la sesión inicial
      const initialModule = content.modules.find((m) =>
        m.sessions.some((s) => s.id === initial)
      );
      if (initialModule) setOpenModules(new Set([initialModule.id]));
    }
  }, [content, progressData]);

  // Derivados
  const allSessions = content?.modules.flatMap((m) => m.sessions) ?? [];
  const currentSession = allSessions.find((s) => s.id === currentSessionId);
  const currentIndex = allSessions.findIndex((s) => s.id === currentSessionId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allSessions.length - 1;

  // Mutación: marcar sesión como completada
  const updateProgress = useMutation({
    mutationFn: ({ sessionId, forceComplete }: { sessionId: string; forceComplete: boolean }) =>
      studentService.updateSessionProgress(sessionId, 0, forceComplete),
    onSuccess: (data, vars) => {
      if (data.completed && !completedSet.has(vars.sessionId)) {
        setCompletedSet((prev) => new Set([...prev, vars.sessionId]));
        setProgressPercent(data.progress_percent);
        queryClient.invalidateQueries({ queryKey: ["mis-inscripciones"] });
      }
    },
    onError: (err) => {
      const reason = getAccessBlockReason(err);
      if (reason) toast.error(ACCESS_BLOCK_MESSAGES[reason]);
    },
  });

  const handleVideoEnded = useCallback(() => {
    if (hasNext) {
      setShowAutoAdvance(true);
      setAutoAdvanceCount(5);
    }
  }, [hasNext]);

  // Cuenta regresiva auto-avance
  useEffect(() => {
    if (!showAutoAdvance) return;
    if (autoAdvanceCount <= 0) {
      setShowAutoAdvance(false);
      const next = allSessions[currentIndex + 1];
      if (next) goToSession(next.id);
      return;
    }
    const t = setTimeout(() => setAutoAdvanceCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [showAutoAdvance, autoAdvanceCount]);

  const goToSession = (sessionId: string) => {
    setShowAutoAdvance(false);
    setCurrentSessionId(sessionId);
    const mod = content?.modules.find((m) => m.sessions.some((s) => s.id === sessionId));
    if (mod) setOpenModules((prev) => new Set([...prev, mod.id]));
    if (!completedSet.has(sessionId)) {
      updateProgress.mutate({ sessionId, forceComplete: true });
    }
    // En mobile/tablet el video y la lista comparten una sola columna con scroll
    // de página; al elegir una sesión, llevamos la vista al video (como YouTube).
    videoSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toggleModule = (moduleId: string) => {
    setOpenModules((prev) => {
      const next = new Set(prev);
      next.has(moduleId) ? next.delete(moduleId) : next.add(moduleId);
      return next;
    });
  };

  const isCourseDone = progressPercent === 100;

  if (loadingContent || loadingProgress) {
    return (
      <div className="-mx-4 lg:-mx-8 -my-6 lg:-my-8 flex items-center justify-center h-[calc(100vh-64px)]">
        <Loader2 size={32} className="animate-spin text-[#084D95]" />
      </div>
    );
  }

  if (!content || !progressData) {
    const reason = getAccessBlockReason(contentError) ?? getAccessBlockReason(progressError);
    return (
      <div className="-mx-4 lg:-mx-8 -my-6 lg:-my-8 flex flex-col items-center justify-center h-[calc(100vh-64px)] gap-4 px-4 text-center">
        <p className="text-gray-500">
          {reason ? ACCESS_BLOCK_MESSAGES[reason] : "No tienes acceso a este curso."}
        </p>
        <Link href="/mis-cursos" className="text-[#084D95] underline text-sm">Ver mis cursos</Link>
      </div>
    );
  }

  return (
    <div className="-mx-4 lg:-mx-8 -my-6 lg:-my-8">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-2 text-sm">
        <Link href="/mis-cursos" className="text-gray-400 hover:text-gray-600">Mis cursos</Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700 font-medium truncate">{content.title}</span>
      </div>

      {/* Layout principal */}
      {/* En mobile todo fluye normal (scroll de la página); el panel dividido
          con altura fija y scroll independiente por columna es solo desktop. */}
      <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-113px)]">

        {/* ── Columna izquierda (70%) ── */}
        <div ref={videoSectionRef} className="flex-1 min-w-0 lg:overflow-y-auto bg-gray-50">

          {/* Video */}
          {allSessions.length === 0 ? (
            <div className="w-full aspect-video bg-gray-100 flex flex-col items-center justify-center gap-3">
              <FileText size={48} className="text-gray-300" />
              <p className="text-gray-500 text-sm font-medium">
                Próximamente se cargarán las sesiones de este curso
              </p>
            </div>
          ) : currentSession && (
            <YouTubePlayer
              key={currentSession.id}
              videoId={currentSession.youtube_video_id}
              onEnded={handleVideoEnded}
            />
          )}

          {/* Auto-avance overlay */}
          {showAutoAdvance && (
            <div className="bg-gray-800 text-white px-6 py-3 flex items-center justify-between gap-4">
              <span className="text-sm">
                Siguiente sesión en <strong>{autoAdvanceCount}s</strong>:{" "}
                <em>{allSessions[currentIndex + 1]?.title}</em>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowAutoAdvance(false); goToSession(allSessions[currentIndex + 1].id); }}
                  className="bg-[#084D95] text-white text-xs px-3 py-1.5 rounded-lg hover:bg-[#084D95]/80"
                >
                  Ir ahora
                </button>
                <button
                  onClick={() => setShowAutoAdvance(false)}
                  className="text-gray-400 hover:text-white text-xs px-3 py-1.5"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Info de sesión */}
          <div className="bg-white px-6 py-6">
            {currentSession ? (
              <>
                <h1 className="text-xl font-bold text-brand-primary">{currentSession.title}</h1>
                {currentSession.description && (
                  <p className="text-gray-500 mt-2 text-sm leading-relaxed">{currentSession.description}</p>
                )}

                {/* Materiales */}
                {(currentSession.materials?.length ?? 0) > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Material de la sesión</h3>
                    <div className="flex flex-wrap gap-2">
                      {currentSession.materials!.map((mat) => (
                        <a
                          key={mat.id}
                          href={mat.drive_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:border-[#084D95] hover:text-[#084D95] transition-colors"
                        >
                          <span>{MATERIAL_ICON[mat.type] ?? "📎"}</span>
                          <span>{mat.name}</span>
                          <ExternalLink size={12} className="text-gray-400" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Navegación prev/next */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
                  <button
                    disabled={!hasPrev}
                    onClick={() => goToSession(allSessions[currentIndex - 1].id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:border-[#084D95] hover:text-[#084D95] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={16} />
                    Sesión anterior
                  </button>

                  {isCourseDone && !hasReview ? (
                    <button
                      onClick={() => setShowReviewModal(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                    >
                      <Star size={16} />
                      Dejar reseña para obtener certificado
                    </button>
                  ) : isCourseDone && hasReview ? (
                    <Link
                      href={`/certificado/${progressData.enrollment.id}`}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                    >
                      <Award size={16} />
                      Ver certificado
                    </Link>
                  ) : null}

                  <button
                    disabled={!hasNext}
                    onClick={() => goToSession(allSessions[currentIndex + 1].id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:border-[#084D95] hover:text-[#084D95] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Siguiente sesión
                    <ChevronRight size={16} />
                  </button>
                </div>

                {/* Banner curso completado sin reseña */}
                {isCourseDone && !hasReview && (
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <Star size={18} className="text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-amber-800 text-sm">¡Completaste el curso!</p>
                      <p className="text-amber-700 text-sm mt-0.5">
                        Deja una reseña para habilitar tu certificado. Es obligatorio para descargarlo.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowReviewModal(true)}
                      className="bg-amber-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-amber-600 shrink-0"
                    >
                      Dejar reseña
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-gray-400 text-sm">Selecciona una sesión del panel lateral.</p>
            )}
          </div>
        </div>

        {/* ── Sidebar derecho (30%) ── */}
        <aside className="lg:w-80 xl:w-96 bg-white border-l border-gray-200 flex flex-col">
          {/* Progreso general */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Progreso del curso</span>
              <span className="text-sm font-bold text-[#084D95]">{progressPercent}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full">
              <div
                className="h-2 bg-[#084D95] rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {completedSet.size} de {allSessions.length} sesiones completadas
            </p>
          </div>

          {/* Módulos y sesiones */}
          <div className="flex-1 lg:overflow-y-auto">
            {content.modules.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-4 gap-3">
                <Circle size={32} className="text-gray-300" />
                <p className="text-sm text-gray-400 text-center">
                  Próximamente se cargarán las sesiones de este curso
                </p>
              </div>
            )}
            {content.modules.map((mod) => {
              const isOpen = openModules.has(mod.id);
              const modDone = mod.sessions.filter((s) => completedSet.has(s.id)).length;
              return (
                <div key={mod.id} className="border-b border-gray-100 last:border-0">
                  <button
                    onClick={() => toggleModule(mod.id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-semibold text-gray-800 leading-snug">{mod.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {modDone}/{mod.sessions.length} sesiones
                      </p>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`text-gray-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {isOpen && (
                    <div className="bg-gray-50 pb-1">
                      {mod.sessions.map((sess) => {
                        const done = completedSet.has(sess.id);
                        const isActive = sess.id === currentSessionId;
                        return (
                          <button
                            key={sess.id}
                            onClick={() => goToSession(sess.id)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                              isActive
                                ? "bg-[#084D95]/10 border-l-2 border-[#084D95]"
                                : "hover:bg-gray-100 border-l-2 border-transparent"
                            }`}
                          >
                            {done ? (
                              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                            ) : isActive ? (
                              <PlayCircle size={16} className="text-[#084D95] shrink-0" />
                            ) : (
                              <Circle size={16} className="text-gray-300 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs leading-snug truncate ${isActive ? "font-semibold text-[#084D95]" : "text-gray-700"}`}>
                                {sess.title}
                              </p>
                              <p className="text-[10px] text-gray-400 mt-0.5">{sess.duration_minutes} min</p>
                            </div>
                            {(sess.materials?.length ?? 0) > 0 && (
                              <FileText size={12} className="text-gray-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {/* Modal de reseña */}
      {showReviewModal && (
        <ReviewModal
          courseId={id}
          enrollmentId={progressData.enrollment.id}
          onClose={() => setShowReviewModal(false)}
          onSubmitted={() => {
            setHasReview(true);
            setShowReviewModal(false);
            queryClient.invalidateQueries({ queryKey: ["mis-inscripciones"] });
            router.push(`/certificado/${progressData.enrollment.id}`);
          }}
        />
      )}
    </div>
  );
}

// ── YouTube Player ────────────────────────────────────────────────────────────
function YouTubePlayer({
  videoId,
  onEnded,
}: {
  videoId: string;
  onEnded: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);

  useEffect(() => {
    const initPlayer = () => {
      if (!containerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: { autoplay: 0, rel: 0, modestbranding: 1 },
        events: {
          onStateChange: (e) => {
            if (e.data === 0) onEnded();
          },
        },
      });
    };

    loadYouTubeAPI(initPlayer);

    return () => {
      playerRef.current?.destroy();
    };
  }, []);

  return (
    <div className="w-full aspect-video bg-black">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

// ── Modal de reseña ───────────────────────────────────────────────────────────
function ReviewModal({
  courseId,
  enrollmentId,
  onClose,
  onSubmitted,
}: {
  courseId: string;
  enrollmentId: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const charCount = comment.length;
  const valid = rating > 0 && charCount >= 50 && charCount <= 500;

  const handleSubmit = async () => {
    if (!valid) return;
    setSubmitting(true);
    setError("");
    try {
      await studentService.submitReview({ course_id: courseId, enrollment_id: enrollmentId, rating, comment });
      onSubmitted();
    } catch {
      setError("No se pudo enviar la reseña. Intenta de nuevo.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-brand-primary">Dejar reseña del curso</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-5">
          Tu reseña es obligatoria para habilitar el certificado. Una vez enviada no podrás editarla.
        </p>

        {/* Estrellas */}
        <div className="mb-5">
          <p className="text-sm font-medium text-gray-700 mb-2">Calificación *</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setRating(n)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  size={32}
                  className={
                    n <= (hovered || rating)
                      ? "fill-amber-400 text-amber-400"
                      : "fill-gray-200 text-gray-300"
                  }
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              {["", "Muy malo", "Malo", "Regular", "Bueno", "Excelente"][rating]}
            </p>
          )}
        </div>

        {/* Comentario */}
        <div className="mb-5">
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Comentario * <span className="text-gray-400 font-normal">(50–500 caracteres)</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Comparte tu experiencia con este curso..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#084D95] focus:border-transparent resize-none"
          />
          <div className={`text-xs text-right mt-1 ${charCount < 50 ? "text-red-400" : charCount > 490 ? "text-amber-500" : "text-gray-400"}`}>
            {charCount}/500 {charCount < 50 && `(mínimo 50)`}
          </div>
        </div>

        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!valid || submitting}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-[#084D95] text-white hover:bg-[#084D95]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Enviar reseña
          </button>
        </div>
      </div>
    </div>
  );
}
