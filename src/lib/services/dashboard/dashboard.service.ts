import { api } from "@/lib/http/api";
import type { User } from "@/types";

export interface DashboardStats {
  ingresos: {
    total_mes: number;
    total_mes_anterior: number;
    cambio_porcentual: number;
    online: number;
    manual: number;
  };
  estudiantes: {
    total: number;
    nuevos_mes: number;
  };
  cursos: {
    total_activos: number;
    nuevos_mes: number;
  };
  tasa_finalizacion: number;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user?: { first_name: string; last_name: string; email: string };
  entity_type: string;
  entity_id: string;
  action: "create" | "update" | "delete";
  changes: Record<string, unknown>;
  created_at: string;
}

export interface IngresosChartItem {
  mes: string;
  total: number;
  online: number;
  manual: number;
}

export interface TopCursoChart {
  id: string;
  title: string;
  enrolled_count: number;
  revenue: number;
}

export interface CategoriaDistribucion {
  name: string;
  count: number;
}

export interface EstudiantesActivosItem {
  mes: string;
  activos: number;
  inactivos: number;
}

export interface TopFinalizacionItem {
  id: string;
  title: string;
  enrolled_count: number;
  completion_rate: number;
}

export interface TopEstudianteItem {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  courses_count: number;
  completed_count: number;
  total_watched_hours: number;
}

export interface DashboardFilters {
  desde?: string;
  hasta?: string;
  categoria_id?: string;
}

export interface MatriculadoCurso {
  enrollment_id: string;
  user: { id: string; first_name: string; last_name: string; email: string };
  enrolled_at: string;
  progress_percent: number;
  last_accessed_at?: string;
  suspended_at?: string | null;
  status: "activo" | "completado" | "inactivo" | "suspendido";
  enrollment_type: "online" | "manual";
  offline_payment_method?: string;
}

export interface MatriculadosCursoStats {
  total: number;
  avg_progress: number;
  activos_7_dias: number;
  tasa_finalizacion: number;
}

export interface MatriculadosCursoResponse {
  data: MatriculadoCurso[];
  total: number;
  total_pages: number;
  stats: MatriculadosCursoStats;
}

export interface SesionActividad {
  module_title: string;
  session_title: string;
  duration_minutes: number;
  watched_seconds: number;
  percent_watched: number;
  completed: boolean;
  last_watched_at?: string;
}

export interface ActividadPorDia {
  date: string;
  hours: number;
}

export interface ActividadEstudiante {
  enrollment: {
    enrolled_at: string;
    progress_percent: number;
    last_accessed_at?: string;
    completed_at?: string;
    total_watched_seconds: number;
  };
  user: { id: string; first_name: string; last_name: string; email: string };
  course: { id: string; title: string };
  sessions: SesionActividad[];
  activity_by_day: ActividadPorDia[];
}

export interface StudentDetailEnrollment {
  id: string;
  course_id: string;
  course: {
    id: string;
    title: string;
    slug: string;
    thumbnail_url: string | null;
    level: string;
    total_duration_minutes: number;
  };
  enrolled_at: string;
  enrollment_type: "online" | "manual";
  offline_payment_method?: string;
  progress_percent: number;
  completed_at?: string;
  last_accessed_at?: string;
  total_watched_seconds: number;
  has_review: boolean;
  certificate: {
    id: string;
    verification_code: string | null;
    type: string;
    issued_at: string;
  } | null;
}

export interface StudentDetail {
  user: User;
  enrollments: StudentDetailEnrollment[];
}

export const dashboardService = {
  getStats: (params?: DashboardFilters) =>
    api.get<DashboardStats>("/admin/stats", { params }).then((r) => r.data),

  getAuditLogs: (params?: { page?: number; limit?: number }) =>
    api.get<{ data: AuditLog[]; total: number }>("/admin/auditoria", { params }).then((r) => r.data),

  getIngresosChart: (params?: DashboardFilters) =>
    api.get<IngresosChartItem[]>("/admin/charts/ingresos", { params }).then((r) => r.data),

  getTopCursos: (params?: DashboardFilters) =>
    api.get<TopCursoChart[]>("/admin/charts/top-cursos", { params }).then((r) => r.data),

  getCategoriasDistribucion: (params?: DashboardFilters) =>
    api.get<CategoriaDistribucion[]>("/admin/charts/categorias", { params }).then((r) => r.data),

  getEstudiantesActivos: (params?: DashboardFilters) =>
    api.get<EstudiantesActivosItem[]>("/admin/charts/estudiantes", { params }).then((r) => r.data),

  getTopFinalizacion: (params?: DashboardFilters) =>
    api.get<TopFinalizacionItem[]>("/admin/top-finalizacion", { params }).then((r) => r.data),

  getTopEstudiantes: (params?: DashboardFilters) =>
    api.get<TopEstudianteItem[]>("/admin/top-estudiantes", { params }).then((r) => r.data),

  getMatriculadosCurso: (
    cursoId: string,
    params?: { page?: number; limit?: number; search?: string; status?: string; enrollment_type?: string }
  ) =>
    api
      .get<MatriculadosCursoResponse>(`/admin/cursos/${cursoId}/matriculados`, { params })
      .then((r) => r.data),

  getStudentDetail: (userId: string) =>
    api.get<StudentDetail>(`/admin/estudiantes/${userId}`).then((r) => r.data),

  getActividadEstudiante: (userId: string, courseId: string) =>
    api
      .get<ActividadEstudiante>(`/admin/estudiantes/${userId}/cursos/${courseId}/actividad`)
      .then((r) => r.data),

  exportMatriculadosCurso: (cursoId: string) =>
    api
      .get(`/admin/cursos/${cursoId}/matriculados/export`, { responseType: "blob" })
      .then((r) => r.data as Blob),

  exportDashboard: (params?: DashboardFilters) =>
    api
      .get("/admin/export", { params, responseType: "blob" })
      .then((r) => r.data as Blob),
};
