/**
 * api.ts — typed fetch wrapper for the Nivaas MySQL backend
 * Base URL: http://localhost:4000/api  (override with VITE_API_URL)
 */

export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

// ─── Token helpers ────────────────────────────────────────────────────────────

const TOKEN_KEY = "nivaas_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string): void {
  localStorage.setItem(TOKEN_KEY, t);
}
export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("nivaas_user");
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

async function req<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? res.statusText);
  }
  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface ApiUser {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  city: string | null;
  bio: string | null;
  role: "customer" | "owner" | "admin";
  is_verified: number;
}

interface AuthResponse {
  token: string;
  user: ApiUser;
  message?: string;
}

export const auth = {
  register: (body: {
    full_name?: string;
    email: string;
    phone?: string;
    password: string;
    role?: "customer" | "owner";
  }) => req<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(body) }),

  login: (email: string, password: string) =>
    req<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  sendOtp: (email: string) =>
    req<{ message: string }>("/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  verifyOtp: (email: string, otp: string) =>
    req<AuthResponse>("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp }),
    }),

  me: () => req<ApiUser>("/auth/me"),

  updateProfile: (body: Partial<Pick<ApiUser, "full_name" | "phone" | "city" | "bio" | "avatar_url">>) =>
    req<ApiUser>("/auth/profile", { method: "PUT", body: JSON.stringify(body) }),
};

// ─── Properties ───────────────────────────────────────────────────────────────

export interface ApiProperty {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  property_type: string;
  listing_type: "rent" | "sale" | "pg";
  status: string;
  city: string;
  state: string | null;
  locality: string | null;
  address: string | null;
  pincode: string | null;
  /**
   * Owner-provided Google Maps URL (stored verbatim from nivaas_property_locations).
   * Use this for the "Open in Google Maps" button — it points to the exact place the
   * owner pinned, not a generic lat/lng link.
   */
  map_url: string | null;
  /**
   * Exact GPS latitude from nivaas_property_locations.
   * NULL means the owner never provided a Google Maps link, or the link could not
   * be resolved to coordinates. NEVER a city-center fallback.
   */
  latitude: number | null;
  /**
   * Exact GPS longitude from nivaas_property_locations.
   * NULL means the owner never provided a Google Maps link, or the link could not
   * be resolved to coordinates. NEVER a city-center fallback.
   */
  longitude: number | null;
  /**
   * Always false — the backend no longer injects approximate/city-center coordinates.
   * Kept for API compatibility. Frontend should treat null lat/lng as "no pin".
   * @deprecated Use `latitude === null` check instead.
   */
  location_approximate?: boolean;
  bedrooms: number | null;
  bathrooms: number | null;
  balconies: number;
  area_sqft: number | null;
  carpet_area: number | null;
  floor_number: number | null;
  total_floors: number | null;
  age_years: string | null;
  furnished: string;
  facing: string | null;
  parking_slots: number;
  price: number;
  deposit: number | null;
  maintenance_fee: number;
  brokerage: number;
  price_negotiable: number;
  available_from: string | null;
  min_lease_months: number;
  preferred_tenants: string | null;
  cover_image_url: string | null;
  verified: number;
  rera_id: string | null;
  views_count: number;
  saves_count: number;
  inquiries_count: number;
  created_at: string;
  updated_at: string;
  // Joined
  owner_name?: string | null;
  owner_phone?: string | null;
  owner_email?: string | null;
  owner_avatar?: string | null;
  owner_verified?: number;
  avg_rating?: number | null;
  review_count?: number;
  inquiry_count?: number;
  save_count?: number;
  // Attached
  images: string[];
  amenities?: Array<{ name: string; icon: string; category: string }>;
  reviews?: ApiReview[];
}

export interface ApiReview {
  id: string;
  property_id: string;
  reviewer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_name?: string;
  reviewer_avatar?: string | null;
}

export interface PropertyFilters {
  city?: string;
  listing_type?: string;
  property_type?: string;
  min_price?: number;
  max_price?: number;
  furnished?: string;
  q?: string;
  limit?: number;
  offset?: number;
  sort?: "newest" | "price_asc" | "price_desc";
  /** Bounding box for map viewport queries */
  lat_min?: number;
  lat_max?: number;
  lng_min?: number;
  lng_max?: number;
  /** "true" = only return properties that have coordinates */
  has_coords?: "true";
}

export const properties = {
  list: (filters: PropertyFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== "" && v !== null) params.set(k, String(v));
    });
    const qs = params.toString();
    return req<{ data: ApiProperty[]; count: number }>(`/properties${qs ? `?${qs}` : ""}`);
  },

  get: (id: string) => req<ApiProperty>(`/properties/${id}`),

  mine: () => req<ApiProperty[]>("/properties/owner/mine"),

  create: (body: Partial<ApiProperty> & { title: string; city: string; price: number }) =>
    req<ApiProperty>("/properties", { method: "POST", body: JSON.stringify(body) }),

  update: (id: string, body: Partial<ApiProperty>) =>
    req<ApiProperty>(`/properties/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  delete: (id: string) =>
    req<{ message: string }>(`/properties/${id}`, { method: "DELETE" }),
};

// ─── Saved properties ─────────────────────────────────────────────────────────

export const saved = {
  list: () => req<ApiProperty[]>("/saved"),
  save: (propertyId: string) =>
    req<{ saved: boolean }>(`/saved/${propertyId}`, { method: "POST" }),
  unsave: (propertyId: string) =>
    req<{ saved: boolean }>(`/saved/${propertyId}`, { method: "DELETE" }),
  check: (propertyId: string) =>
    req<{ saved: boolean }>(`/saved/check/${propertyId}`),
};

// ─── Inquiries ────────────────────────────────────────────────────────────────

export interface ApiInquiry {
  id: string;
  property_id: string;
  customer_id: string;
  owner_id: string;
  message: string | null;
  status: string;
  visit_date: string | null;
  created_at: string;
  property_title?: string;
  city?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  owner_name?: string;
  owner_phone?: string;
}

export const inquiries = {
  list: () => req<ApiInquiry[]>("/inquiries"),
  send: (body: { property_id: string; message?: string; visit_date?: string }) =>
    req<ApiInquiry>("/inquiries", { method: "POST", body: JSON.stringify(body) }),
  updateStatus: (id: string, status: string) =>
    req<{ message: string }>(`/inquiries/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};

// ─── Messages ─────────────────────────────────────────────────────────────────

export interface ApiMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  property_id: string | null;
  content: string;
  is_read: number;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string | null;
  // thread fields
  other_user_id?: string;
  other_user_name?: string;
  other_user_avatar?: string | null;
  property_title?: string | null;
}

export const messages = {
  threads: () => req<ApiMessage[]>("/messages/threads"),
  conversation: (userId: string, propertyId?: string) => {
    const qs = propertyId ? `?property_id=${propertyId}` : "";
    return req<ApiMessage[]>(`/messages/${userId}${qs}`);
  },
  send: (body: { receiver_id: string; content: string; property_id?: string }) =>
    req<ApiMessage>("/messages", { method: "POST", body: JSON.stringify(body) }),
};

// ─── Agreements ───────────────────────────────────────────────────────────────

export interface ApiAgreement {
  id: string;
  property_id: string;
  owner_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  security_deposit: number | null;
  status: string;
  document_url: string | null;
  notes: string | null;
  created_at: string;
  property_title?: string;
  city?: string;
  owner_name?: string;
  tenant_name?: string;
  tenant_email?: string;
  tenant_phone?: string;
}

export const agreements = {
  list: () => req<ApiAgreement[]>("/agreements"),
  create: (body: Omit<ApiAgreement, "id" | "created_at" | "status" | "document_url">) =>
    req<ApiAgreement>("/agreements", { method: "POST", body: JSON.stringify(body) }),
  updateStatus: (id: string, status: string) =>
    req<{ message: string }>(`/agreements/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};

// ─── Rentals ──────────────────────────────────────────────────────────────────

export interface ApiPayment {
  id: string;
  agreement_id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: "pending" | "paid" | "overdue" | "waived";
  payment_method: string | null;
  transaction_id: string | null;
  created_at: string;
  property_title?: string;
  locality?: string;
  city?: string;
  tenant_name?: string;
  tenant_phone?: string;
  monthly_rent?: number;
}

export interface RentalStats {
  collected: number | null;
  pending: number | null;
  overdue: number | null;
}

export const rentals = {
  list: () => req<ApiPayment[]>("/rentals"),
  stats: () => req<RentalStats>("/rentals/stats"),
  updateStatus: (id: string, body: { status: string; paid_date?: string; transaction_id?: string; payment_method?: string }) =>
    req<{ message: string }>(`/rentals/${id}/status`, { method: "PATCH", body: JSON.stringify(body) }),
};

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface AnalyticsSummary {
  total_views: number | null;
  total_saves: number | null;
  total_inquiries: number | null;
  total_listings: number | null;
  active_listings: number | null;
  yearly_collected: number | null;
}

export interface MonthlyIncome {
  month: string;
  month_num: number;
  year: number;
  total: number;
}

export const analytics = {
  summary: () => req<AnalyticsSummary>("/analytics/summary"),
  monthly: () => req<MonthlyIncome[]>("/analytics/monthly"),
};

// ─── Image Upload ─────────────────────────────────────────────────────────────

export interface ApiPropertyImage {
  id: string;
  url: string;
  is_cover: number;
  sort_order: number;
}

export const uploadImages = async (
  propertyId: string,
  files: File[],
): Promise<{ images: ApiPropertyImage[]; count: number }> => {
  const token = getToken();
  const formData = new FormData();
  files.forEach(f => formData.append("images", f));

  const res = await fetch(`${API_BASE}/upload/property-images/${propertyId}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? res.statusText);
  }
  return res.json();
};

export const deleteImage = (imageId: string) =>
  req<{ message: string }>(`/upload/property-images/${imageId}`, { method: "DELETE" });

// ─── Complaints ───────────────────────────────────────────────────────────────

export type ComplaintCategory =
  | "fake_listing"
  | "fraud"
  | "wrong_information"
  | "owner_misbehavior"
  | "payment_issue"
  | "other";

export type ComplaintStatus = "open" | "in_review" | "resolved" | "dismissed";

export interface ApiComplaint {
  id: string;
  property_id: string | null;
  reporter_id: string;
  reported_user_id: string | null;
  category: ComplaintCategory;
  subject: string;
  description: string;
  status: ComplaintStatus;
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  reporter_name?: string;
  reporter_email?: string;
  property_title?: string;
  property_city?: string;
}

export const complaints = {
  list: () => req<ApiComplaint[]>("/complaints"),
  get: (id: string) => req<ApiComplaint>(`/complaints/${id}`),
  create: (body: {
    property_id?: string;
    reported_user_id?: string;
    category: ComplaintCategory;
    subject: string;
    description: string;
  }) => req<ApiComplaint>("/complaints", { method: "POST", body: JSON.stringify(body) }),
  updateStatus: (id: string, status: ComplaintStatus, admin_notes?: string) =>
    req<{ message: string }>(`/complaints/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, admin_notes }),
    }),
  submitReview: (propertyId: string, rating: number, comment?: string) =>
    req<ApiReview>(`/complaints/reviews/${propertyId}`, {
      method: "POST",
      body: JSON.stringify({ rating, comment }),
    }),
};

// ─── Visits ───────────────────────────────────────────────────────────────────

export type VisitType   = "in_person" | "video_call";
export type VisitStatus = "pending" | "confirmed" | "completed" | "cancelled" | "rescheduled";

export interface ApiVisit {
  id: string;
  property_id: string;
  customer_id: string;
  owner_id: string;
  visit_date: string;
  visit_time: string;
  visit_type: VisitType;
  status: VisitStatus;
  notes: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  property_title?: string;
  locality?: string;
  city?: string;
  cover_image_url?: string | null;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  owner_name?: string;
  owner_phone?: string;
}

export const visits = {
  list: (role?: "owner" | "customer") => {
    const qs = role ? `?role=${role}` : "";
    return req<ApiVisit[]>(`/visits${qs}`);
  },
  get: (id: string) => req<ApiVisit>(`/visits/${id}`),
  book: (body: {
    property_id: string;
    visit_date: string;
    visit_time: string;
    visit_type?: VisitType;
    notes?: string;
  }) => req<ApiVisit>("/visits", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: {
    status?: VisitStatus;
    visit_date?: string;
    visit_time?: string;
    cancel_reason?: string;
    notes?: string;
  }) => req<ApiVisit>(`/visits/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  cancel: (id: string, cancel_reason?: string) =>
    req<ApiVisit>(`/visits/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled", cancel_reason }),
    }),
};

// ─── Notifications ────────────────────────────────────────────────────────────

export interface ApiNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  is_read: number;
  created_at: string;
}

export const notifications = {
  list: (limit?: number) => {
    const qs = limit ? `?limit=${limit}` : "";
    return req<{ data: ApiNotification[]; unread: number }>(`/notifications${qs}`);
  },
  markRead: (id: string) =>
    req<{ message: string }>(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () =>
    req<{ message: string }>("/notifications/read-all", { method: "PATCH" }),
  delete: (id: string) =>
    req<{ message: string }>(`/notifications/${id}`, { method: "DELETE" }),
  triggerReminders: () =>
    req<{ processed: number }>("/notifications/trigger-reminders", { method: "POST" }),
};

// ─── Documents ────────────────────────────────────────────────────────────────

export type DocType =
  | "sale_deed"
  | "tax_receipt"
  | "electricity_bill"
  | "noc"
  | "society_letter"
  | "occupancy_certificate"
  | "rental_agreement"
  | "identity_proof"
  | "other";

export interface ApiDocument {
  id: string;
  owner_id: string;
  property_id: string | null;
  doc_type: DocType;
  title: string;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  is_verified: number;
  created_at: string;
  // Joined
  property_title?: string;
  owner_name?: string;
}

export const documents = {
  list: (propertyId?: string) => {
    const qs = propertyId ? `?property_id=${propertyId}` : "";
    return req<ApiDocument[]>(`/documents${qs}`);
  },
  create: (body: {
    property_id?: string;
    doc_type: DocType;
    title: string;
    file_url: string;
    file_name?: string;
    file_size?: number;
  }) => req<ApiDocument>("/documents", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: Partial<Pick<ApiDocument, "title" | "doc_type" | "is_verified">>) =>
    req<ApiDocument>(`/documents/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (id: string) =>
    req<{ message: string }>(`/documents/${id}`, { method: "DELETE" }),
};

// ─── Pricing ──────────────────────────────────────────────────────────────────

export interface PricingSuggestion {
  suggested_min: number;
  suggested_max: number;
  suggested_optimal: number;
  comparables_count: number;
  basis: "market_data" | "market_defaults";
  breakdown?: {
    p25_market: number;
    p50_market: number;
    p75_market: number;
    area_multiplier: number;
    locality_premium: number;
  };
}

export interface PricingTrend {
  city: string;
  property_type: string;
  listing_type: string;
  count: number;
  avg_price: number;
  min_price: number;
  max_price: number;
}

export const pricing = {
  suggest: (params: {
    city: string;
    property_type: string;
    listing_type: string;
    bedrooms?: number;
    area_sqft?: number;
    locality?: string;
    property_id?: string;
  }) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return req<PricingSuggestion>(`/pricing/suggest?${qs}`);
  },
  trending: () => req<PricingTrend[]>("/pricing/trending"),
};

// ─── Verification ─────────────────────────────────────────────────────────────

export interface ApiVerificationLog {
  id: string;
  property_id: string;
  verifier_id: string;
  action: "submitted" | "approved" | "rejected" | "inspection_done";
  notes: string | null;
  report_url: string | null;
  created_at: string;
  verifier_name?: string;
}

export const verification = {
  pending: () => req<ApiProperty[]>("/verification/pending"),
  logs: (propertyId: string) => req<ApiVerificationLog[]>(`/verification/logs/${propertyId}`),
  submit: (propertyId: string) =>
    req<{ message: string }>(`/verification/submit/${propertyId}`, { method: "POST" }),
  action: (propertyId: string, action: "approved" | "rejected" | "inspection_done", notes?: string, report_url?: string) =>
    req<{ message: string }>(`/verification/action/${propertyId}`, {
      method: "POST",
      body: JSON.stringify({ action, notes, report_url }),
    }),
};

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface AdminStats {
  users: { total: number; verified: number };
  properties: { total: number; verified: number; total_views: number };
  complaints: { total: number; open: number };
  visits: { total: number; pending: number };
  revenue: { total_collected: number };
  agreements: { total: number; active: number };
}

export interface ApiAuditLog {
  id: string;
  actor_id: string;
  action: string;
  entity: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
  actor_name?: string;
  actor_role?: string;
}

export const admin = {
  stats: () => req<AdminStats>("/admin/stats"),
  users: (params?: { role?: string; q?: string; limit?: number; offset?: number }) => {
    const qs = params ? new URLSearchParams(Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)])).toString() : "";
    return req<{ data: ApiUser[]; total: number }>(`/admin/users${qs ? `?${qs}` : ""}`);
  },
  updateUser: (id: string, body: { role?: string; is_verified?: boolean; kyc_status?: string }) =>
    req<{ message: string }>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  properties: (params?: { status?: string; verification_status?: string; city?: string; q?: string }) => {
    const qs = params ? new URLSearchParams(Object.entries(params).filter(([,v]) => v != null && v !== "").map(([k,v]) => [k, String(v)])).toString() : "";
    return req<{ data: ApiProperty[]; count: number }>(`/admin/properties${qs ? `?${qs}` : ""}`);
  },
  updateProperty: (id: string, body: { status?: string; verified?: boolean; verification_status?: string }) =>
    req<{ message: string }>(`/admin/properties/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  complaints: (params?: { status?: string; limit?: number }) => {
    const qs = params ? new URLSearchParams(Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)])).toString() : "";
    return req<{ data: ApiComplaint[]; count: number }>(`/admin/complaints${qs ? `?${qs}` : ""}`);
  },
  auditLogs: (params?: { entity?: string; limit?: number }) => {
    const qs = params ? new URLSearchParams(Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)])).toString() : "";
    return req<{ data: ApiAuditLog[] }>(`/admin/audit-logs${qs ? `?${qs}` : ""}`);
  },
  revenue: () => req<{ monthly: Array<{ month: string; total: number; transactions: number }>; by_city: Array<{ city: string; total: number }> }>("/admin/revenue"),
};

// ─── Enhanced Rentals ─────────────────────────────────────────────────────────

export interface ApiRentReceipt extends ApiPayment {
  receipt_number: string;
  generated_at: string;
  property_title: string;
  address: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
  owner_name: string;
  owner_phone: string;
  owner_email: string;
  tenant_name: string;
  tenant_phone: string;
  tenant_email: string;
  start_date: string;
  end_date: string;
  security_deposit: number;
}

export interface ExtendedRentalStats extends RentalStats {
  total_agreements?: number;
}

// Extend rentals object
export const rentalsExt = {
  listTenant: () => req<ApiPayment[]>("/rentals/tenant"),
  statsTenant: () => req<ExtendedRentalStats>("/rentals/stats?role=tenant"),
  generatePayments: (agreementId: string) =>
    req<{ message: string; total_months: number; created: number }>(
      `/rentals/generate/${agreementId}`, { method: "POST" }
    ),
  receipt: (paymentId: string) => req<ApiRentReceipt>(`/rentals/receipt/${paymentId}`),
};

// ─── Enhanced Analytics ───────────────────────────────────────────────────────

export interface ExtendedAnalyticsSummary extends AnalyticsSummary {
  rented_listings: number | null;
  verified_listings: number | null;
  monthly_collected: number | null;
  pending_rent: number | null;
  total_transactions: number | null;
  total_visits: number | null;
  pending_visits: number | null;
  completed_visits: number | null;
  open_inquiries: number | null;
  conversion_rate: number;
}

export interface VisitStats {
  month: string;
  month_num: number;
  year: number;
  total: number;
  completed: number;
}

export interface TenantDashboard {
  active_agreement: ApiAgreement | null;
  next_payment: ApiPayment | null;
  payment_history: ApiPayment[];
  complaints: { total: number; open: number };
  visits: { total: number; upcoming: number };
}

// Extend analytics object
export const analyticsExt = {
  summary: () => req<ExtendedAnalyticsSummary>("/analytics/summary"),
  monthly: () => req<MonthlyIncome[]>("/analytics/monthly"),
  visits: () => req<VisitStats[]>("/analytics/visits"),
  tenantSummary: () => req<TenantDashboard>("/analytics/tenant-summary"),
};
