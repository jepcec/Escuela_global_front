// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = "estudiante" | "soporte" | "marketing" | "admin" | "coordinador";
export type UserStatus = "active" | "suspended" | "deleted";
export type CourseLevel = "principiante" | "intermedio" | "avanzado";
export type CourseStatus = "draft" | "published" | "archived";
export type Currency = "USD" | "PEN";
export type MaterialType = "PDF" | "Excel" | "Word" | "Otro";
export type EnrollmentType = "online" | "manual";
export type OfflinePaymentMethod = "transferencia" | "efectivo" | "cortesia" | "otro";
export type PaymentMethod = "stripe" | "paypal" | "mercado_pago" | "niubiz";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type SliderType = "courses" | "banner" | "catalog";
export type SliderPosition = "top" | "middle" | "bottom";
export type PromotionStatus = "active" | "inactive";
export type NotificationType = "nuevo_curso" | "completado" | "recordatorio" | "matriculacion" | "certificado" | "personalizada" | "descuento" | "anuncio";
export type ReviewStatus = "approved" | "hidden";
export type AuditAction = "create" | "update" | "delete";

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  country?: string;
  profession?: string;
  role: UserRole;
  profile_photo_url?: string;
  email_verified: boolean;
  status: UserStatus;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  description?: string;
  display_order: number;
  created_at: string;
}

export interface Instructor {
  id: string;
  course_id: string;
  full_name: string;
  title: string;
  description?: string;
  photo_url?: string;
  display_order: number;
}

export interface Course {
  id: string;
  category_id: string;
  category?: Category;
  title: string;
  slug: string;
  tagline: string;
  description: string;
  thumbnail_url: string;
  level: CourseLevel;
  software_tools: string[];
  price_pen: number;
  discount_price_pen?: number;
  price_usd: number;
  discount_price_usd?: number;
  access_duration_months: number;
  prerequisites: string[];
  outcomes: string[];
  status: CourseStatus;
  published_at?: string;
  avg_rating: number;
  review_count: number;
  enrolled_count: number;
  total_duration_minutes: number;
  academic_hours: number;
  instructors: Instructor[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  display_order: number;
  certificate_template_id?: string | null;
  sessions?: Session[];
  created_at: string;
}

export interface Session {
  id: string;
  module_id: string;
  title: string;
  description?: string;
  youtube_url: string;
  youtube_video_id: string;
  duration_minutes: number;
  display_order: number;
  materials?: Material[];
  created_at: string;
}

export interface Material {
  id: string;
  session_id: string;
  name: string;
  drive_url: string;
  type: MaterialType;
  created_at: string;
}

// ─── Transactional Entities ───────────────────────────────────────────────────

export interface Enrollment {
  id: string;
  user_id: string;
  user?: User;
  course_id: string;
  course?: Pick<Course, "id" | "title" | "slug" | "thumbnail_url" | "level" | "total_duration_minutes">;
  order_id?: string;
  enrolled_at: string;
  access_expires_at?: string | null;
  suspended_at?: string | null;
  enrollment_type: EnrollmentType;
  offline_payment_method?: OfflinePaymentMethod;
  offline_amount?: number;
  enrolled_by?: string;
  internal_notes?: string;
  progress_percent: number;
  completed_at?: string;
  last_accessed_at?: string;
  total_watched_seconds?: number;
  has_review?: boolean;
}

export interface Order {
  id: string;
  user_id: string;
  order_number: string;
  subtotal: number;
  total: number;
  currency: Currency;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  gateway_transaction_id?: string;
  billing_name: string;
  billing_email: string;
  billing_country: string;
  billing_dni_ruc?: string;
  invoice_pdf_url?: string;
  items?: OrderItem[];
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  course_id: string;
  course?: Course;
  unit_price: number;
  discount_price?: number;
  final_price: number;
}

export interface CartItem {
  id: string;
  user_id?: string;
  course_id: string;
  course?: Course;
  session_token?: string;
  added_at: string;
  expires_at?: string;
}

export interface LessonProgress {
  id: string;
  enrollment_id: string;
  session_id: string;
  watched_seconds: number;
  completed: boolean;
  completed_at?: string;
  last_watched_at: string;
}

export interface Review {
  id: string;
  user_id: string;
  user?: Pick<User, "id" | "first_name" | "last_name" | "profile_photo_url">;
  course_id: string;
  enrollment_id: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  created_at: string;
}

export interface Certificate {
  id: string;
  enrollment_id: string;
  enrollment?: Enrollment;
  template_id: string;
  verification_code: string;
  issued_at: string;
}

export interface XYPosition {
  x: number;
  y: number;
}

export interface CertificateFontSizes {
  student_name: number;
}

export interface CertificateTemplate {
  id: string;
  name: string;
  background_image_url: string;
  back_image_url: string | null;
  student_name_position: XYPosition;
  qr_position: XYPosition;
  qr_size: number; // unidades del espacio virtual 3508×2480 (default 300)
  font_family: string;
  font_sizes: CertificateFontSizes;
  is_active: boolean;
  created_at: string;
}

export interface CertificateSummary {
  id: string;
  scope: "course" | "module";
  enrollment_id: string;
  course_title: string;
  module_title: string | null;
  verification_code: string | null;
  issued_at: string;
}

export interface CertificateDetail {
  id: string;
  verification_code: string | null;
  course_title: string;
  student_name: string;
  issued_at: string;
  total_hours: number;
  instructors?: string[];
}

export interface ModuleCertificateDetail {
  id: string;
  verification_code: string | null;
  course_title: string;
  module_title: string;
  student_name: string;
  issued_at: string;
}

// ─── Marketing ────────────────────────────────────────────────────────────────

export interface Promotion {
  id: string;
  title: string;
  image_url: string;
  destination_url?: string;
  destination_course_id?: string;
  display_order: number;
  status: PromotionStatus;
  starts_at?: string;
  ends_at?: string;
  created_at: string;
}

export interface EventType {
  id: string;
  name: string;
  display_order: number;
  created_at: string;
}

export interface Slider {
  id: string;
  title: string;
  subtitle?: string;
  type: SliderType;
  event_type_id?: string | null;
  event_type?: Pick<EventType, "id" | "name"> | null;
  image_url?: string;
  destination_url?: string;
  contact_url?: string;
  position_on_page: SliderPosition;
  display_order: number;
  status: PromotionStatus;
  show_content: boolean;
  courses?: Course[];
  created_at: string;
}

export interface Software {
  id: string;
  name: string;
  image_url: string;
  display_order: number;
  status: PromotionStatus;
  created_at: string;
}

export interface ScrollPopup {
  id: string;
  image_url: string;
  destination_url?: string;
  display_order: number;
  status: PromotionStatus;
  created_at: string;
}

export interface Alliance {
  id: string;
  image_url: string;
  display_order: number;
  status: PromotionStatus;
  created_at: string;
}

export interface UpcomingLaunch {
  id: string;
  category_label: string;
  title: string;
  start_date: string;
  image_url?: string;
  link_url?: string;
  display_order: number;
  status: PromotionStatus;
  created_at: string;
}

export interface StaffMember {
  id: string;
  image_url: string;
  display_order: number;
  status: PromotionStatus;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  is_read: boolean;
  redirect_url?: string;
  image_url?: string;
  created_at: string;
}

// ─── Course Viewer ────────────────────────────────────────────────────────────

export interface CourseContent {
  id: string;
  title: string;
  modules: Array<
    Module & {
      sessions: Array<Session & { materials: Material[] }>;
    }
  >;
}

export interface CourseProgress {
  enrollment: Pick<Enrollment, "id" | "progress_percent" | "completed_at">;
  lesson_progress: LessonProgress[];
  has_review: boolean;
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ApiError {
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}

export interface AuthTokens {
  access_token: string;
  refresh_token?: string;
}

export interface AuthUser extends User {
  access_token: string;
}
