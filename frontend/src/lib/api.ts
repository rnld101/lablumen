import { clearToken, getToken } from "@/lib/auth";

// Empty string (the docker/nginx build) -> relative URLs proxied same-origin (no CORS).
// Unset (local `npm run dev`) -> direct service ports.
const APPOINTMENT_API = import.meta.env.VITE_APPOINTMENT_API ?? "http://localhost:8001";
const REPORT_API = import.meta.env.VITE_REPORT_API ?? "http://localhost:8002";

export interface LabTest {
  test_id: string;
  name: string;
  description: string;
  base_cost: number | string;
  is_active: boolean;
}

export interface PatientProfile {
  patient_id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  date_of_birth: string;
  biological_gender: string;
  relationship_to_owner: string;
}

export type PatientProfileCreate = Omit<PatientProfile, "patient_id">;

export interface Appointment {
  appointment_id: string;
  appointment_date: string;
  time_slot: string;
  status: string;
}

export interface TestSelection {
  test_id: string;
  patient_id: string;
}

export interface BookingPayload {
  appointment_date: string;
  time_slot: string;
  tests: TestSelection[];
}

export interface OpsRow {
  mapping_id: string;
  appointment_id: string;
  appointment_date: string;
  time_slot: string;
  status: string;
  patient_name: string;
  test_name: string;
  price_at_booking: string;
  report_id: string | null;
  has_report: boolean;
}

export interface Report {
  report_id: string;
  test_name: string;
  patient_name: string;
  created_at: string;
  has_summary: boolean;
  summary: string | null;
  processing_failed: boolean;
}

export interface ReportView {
  url: string;
  expires_in: number;
}

export interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  answer: string;
  disclaimer: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const isForm = init?.body instanceof FormData;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    clearToken();
    if (window.location.pathname !== "/login") window.location.href = "/login";
    throw new Error("Session expired. Please sign in again.");
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  // Catalog + patients
  listLabTests: () => request<LabTest[]>(`${APPOINTMENT_API}/api/v1/lab-tests`),
  listPatients: () => request<PatientProfile[]>(`${APPOINTMENT_API}/api/v1/patients`),
  createPatient: (payload: PatientProfileCreate) =>
    request<PatientProfile>(`${APPOINTMENT_API}/api/v1/patients`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Appointments
  bookAppointment: (payload: BookingPayload) =>
    request<Appointment>(`${APPOINTMENT_API}/api/v1/appointments`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listMyAppointments: () => request<Appointment[]>(`${APPOINTMENT_API}/api/v1/appointments`),
  listOps: () => request<OpsRow[]>(`${APPOINTMENT_API}/api/v1/appointments/ops`),
  updateAppointmentStatus: (appointmentId: string, newStatus: string) =>
    request<Appointment>(
      `${APPOINTMENT_API}/api/v1/appointments/${appointmentId}/status?new_status=${encodeURIComponent(newStatus)}`,
      { method: "PATCH" },
    ),

  // Reports
  listReports: () => request<Report[]>(`${REPORT_API}/api/v1/reports`),
  viewReport: (reportId: string) =>
    request<ReportView>(`${REPORT_API}/api/v1/reports/${reportId}/view`),
  uploadReport: (mappingId: string, file: File) => {
    const form = new FormData();
    form.append("mapping_id", mappingId);
    form.append("file", file);
    return request<{ report_id: string; status: string }>(
      `${REPORT_API}/api/v1/reports/upload`,
      { method: "POST", body: form },
    );
  },
  chatWithReport: (reportId: string, question: string, history: ChatHistoryItem[] = []) =>
    request<ChatResponse>(`${REPORT_API}/api/v1/reports/${reportId}/chat`, {
      method: "POST",
      body: JSON.stringify({ question, history }),
    }),
};
