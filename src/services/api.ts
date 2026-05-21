// ============================================================
// Bio-Bridge Pro HR — Centralized API Service
// ALL data access goes through here. Never call invoke() or
// supabase directly from a page/component.
// Pattern:  Page → api.employees.list() → invoke() → Rust → SQLite
// ============================================================

import { invoke } from "@tauri-apps/api/core";
import type {
  ApiResponse,
  PaginatedResponse,
  Employee,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  EmployeeFilters,
  AttendanceLog,
  AttendanceDaily,
  ManualAttendanceRequest,
  AttendanceFilters,
  LeaveType,
  LeaveBalance,
  LeaveRequest,
  CreateLeaveRequest,
  LeaveApprovalRequest,
  LeaveFilters,
  SalaryComponent,
  EmployeeSalaryStructure,
  PayrollRun,
  PayrollRecord,
  Invoice,
  CreateInvoiceRequest,
  InventoryItem,
  StockUpdateRequest,
  Project,
  Task,
  BiometricDevice,
  DeviceSyncResult,
  SystemSetting,
  AuditLog,
  SyncStats,
  Department,
  Branch,
  Designation,
  AuthUser,
  LoginRequest,
  LoginResponse,
  UUID,
} from "../types";

// ─── Core invoke wrapper ─────────────────────────────────────

/**
 * Typed, error-normalizing wrapper around Tauri's invoke().
 * Throws a human-readable ApiError on failure.
 */
async function call<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  try {
    const response = await invoke<ApiResponse<T>>(command, args);
    if (!response.success) {
      throw new ApiError(response.message || response.error || "Unknown error", command);
    }
    return response.data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new ApiError(msg, command);
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly command: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Auth ────────────────────────────────────────────────────

export const auth = {
  login: (req: LoginRequest) =>
    call<LoginResponse>("login", { request: req }),

  logout: () =>
    call<null>("logout"),

  get_current_user: () =>
    call<AuthUser>("get_current_user"),

  change_password: (current_password: string, new_password: string) =>
    call<null>("change_password", { current_password, new_password }),
};

// ─── Employees ───────────────────────────────────────────────

export const employees = {
  create: (req: CreateEmployeeRequest) =>
    call<Employee>("create_employee", { request: req }),

  get: (id: UUID) =>
    call<Employee>("get_employee", { employee_id: id }),

  list: (filters?: EmployeeFilters) =>
    call<PaginatedResponse<Employee>>("list_employees", { filters: filters ?? null }),

  update: (id: UUID, req: UpdateEmployeeRequest) =>
    call<Employee>("update_employee", { employee_id: id, request: req }),

  delete: (id: UUID) =>
    call<null>("delete_employee", { employee_id: id }),

  /** Search employees — used for manager dropdowns, assignee pickers */
  search: (query: string, limit = 20) =>
    call<Employee[]>("search_employees", { query, limit }),

  /** Get org-chart tree structure */
  get_hierarchy: () =>
    call<Employee[]>("get_employee_hierarchy"),

  /** Upload photo — base64 encoded */
  upload_photo: (id: UUID, base64: string, mime_type: string) =>
    call<string>("upload_employee_photo", { employee_id: id, base64, mime_type }),
};

// ─── Attendance ──────────────────────────────────────────────

export const attendance = {
  get_logs: (filters?: AttendanceFilters) =>
    call<PaginatedResponse<AttendanceLog>>("get_attendance_logs", { filters: filters ?? null }),

  get_daily: (filters?: AttendanceFilters) =>
    call<PaginatedResponse<AttendanceDaily>>("get_daily_attendance", { filters: filters ?? null }),

  create_manual: (req: ManualAttendanceRequest) =>
    call<AttendanceLog>("create_manual_attendance", { request: req }),

  regularize: (attendance_id: UUID, reason: string) =>
    call<AttendanceDaily>("regularize_attendance", { attendance_id, reason }),

  /** Monthly summary per employee */
  get_monthly_summary: (employee_id: UUID, month: number, year: number) =>
    call<AttendanceDaily[]>("get_monthly_attendance", { employee_id, month, year }),

  /** Department-wise summary for a date range */
  get_department_report: (
    department_id: UUID,
    date_from: string,
    date_to: string
  ) =>
    call<AttendanceDaily[]>("get_department_attendance", {
      department_id,
      date_from,
      date_to,
    }),
};

// ─── Leave ───────────────────────────────────────────────────

export const leave = {
  // Types
  get_types: () =>
    call<LeaveType[]>("get_leave_types"),

  create_type: (data: Partial<LeaveType>) =>
    call<LeaveType>("create_leave_type", { request: data }),

  // Balances
  get_balances: (employee_id: UUID, year?: number) =>
    call<LeaveBalance[]>("get_leave_balances", { employee_id, year: year ?? null }),

  // Requests
  list: (filters?: LeaveFilters) =>
    call<PaginatedResponse<LeaveRequest>>("list_leave_requests", { filters: filters ?? null }),

  get: (id: UUID) =>
    call<LeaveRequest>("get_leave_request", { leave_request_id: id }),

  apply: (req: CreateLeaveRequest) =>
    call<LeaveRequest>("create_leave_request", { request: req }),

  approve: (req: LeaveApprovalRequest) =>
    call<LeaveRequest>("update_leave_status", { request: req }),

  cancel: (id: UUID, reason: string) =>
    call<LeaveRequest>("cancel_leave_request", { leave_request_id: id, reason }),

  /** Pending approvals for current manager */
  get_pending_approvals: () =>
    call<LeaveRequest[]>("get_pending_leave_approvals"),
};

// ─── Payroll ─────────────────────────────────────────────────

export const payroll = {
  // Salary structure
  get_salary_structure: (employee_id: UUID) =>
    call<EmployeeSalaryStructure | null>("get_salary_structure", { employee_id }),

  set_salary_structure: (employee_id: UUID, data: Partial<EmployeeSalaryStructure>) =>
    call<EmployeeSalaryStructure>("create_salary_structure", { employee_id, request: data }),

  // Components
  get_components: () =>
    call<SalaryComponent[]>("get_salary_components"),

  // Payroll runs
  list_runs: (year?: number) =>
    call<PayrollRun[]>("list_payroll_runs", { year: year ?? null }),

  get_run: (run_id: UUID) =>
    call<PayrollRun>("get_payroll_run", { payroll_run_id: run_id }),

  /** Trigger monthly payroll calculation */
  process_payroll: (month: number, year: number, department_id?: UUID) =>
    call<PayrollRun>("process_payroll", { month, year, department_id: department_id ?? null }),

  get_records: (run_id: UUID) =>
    call<PayrollRecord[]>("get_payroll_records", { payroll_run_id: run_id }),

  get_employee_payslip: (employee_id: UUID, run_id: UUID) =>
    call<PayrollRecord>("get_payslip", { employee_id, payroll_run_id: run_id }),

  /** Generate payslip PDF — returns base64 encoded PDF */
  generate_payslip_pdf: (employee_id: UUID, run_id: UUID) =>
    call<string>("generate_payslip_pdf", { employee_id, payroll_run_id: run_id }),

  /** Export bank transfer CSV */
  export_bank_file: (run_id: UUID) =>
    call<string>("export_bank_transfer_file", { payroll_run_id: run_id }),
};

// ─── Finance ─────────────────────────────────────────────────

export const finance = {
  list_invoices: (status?: Invoice["status"]) =>
    call<Invoice[]>("list_invoices", { status: status ?? null }),

  get_invoice: (id: UUID) =>
    call<Invoice>("get_invoice", { invoice_id: id }),

  create_invoice: (req: CreateInvoiceRequest) =>
    call<Invoice>("create_invoice", { request: req }),

  update_invoice_status: (id: UUID, status: Invoice["status"]) =>
    call<Invoice>("update_invoice_status", { invoice_id: id, status }),

  record_payment: (invoice_id: UUID, amount: number, date: string) =>
    call<Invoice>("record_invoice_payment", { invoice_id, amount, date }),

  /** Trial balance / P&L summary */
  get_summary: (from: string, to: string) =>
    call<Record<string, number>>("get_finance_summary", { date_from: from, date_to: to }),
};

// ─── Inventory ───────────────────────────────────────────────

export const inventory = {
  list_items: (category_id?: UUID) =>
    call<InventoryItem[]>("list_items", { category_id: category_id ?? null }),

  get_item: (id: UUID) =>
    call<InventoryItem>("get_item", { item_id: id }),

  create_item: (data: Partial<InventoryItem>) =>
    call<InventoryItem>("create_item", { request: data }),

  update_stock: (req: StockUpdateRequest) =>
    call<InventoryItem>("update_stock", { request: req }),

  get_low_stock: () =>
    call<InventoryItem[]>("get_low_stock_items"),
};

// ─── Projects ────────────────────────────────────────────────

export const projects = {
  list: () =>
    call<Project[]>("list_projects"),

  get: (id: UUID) =>
    call<Project>("get_project", { project_id: id }),

  create: (data: Partial<Project>) =>
    call<Project>("create_project", { request: data }),

  update: (id: UUID, data: Partial<Project>) =>
    call<Project>("update_project", { project_id: id, request: data }),

  get_tasks: (project_id: UUID) =>
    call<Task[]>("get_tasks", { project_id }),

  create_task: (project_id: UUID, data: Partial<Task>) =>
    call<Task>("create_task", { project_id, request: data }),

  update_task: (task_id: UUID, data: Partial<Task>) =>
    call<Task>("update_task", { task_id, request: data }),
};

// ─── Devices ─────────────────────────────────────────────────

export const devices = {
  list: () =>
    call<BiometricDevice[]>("list_devices"),

  test_connection: (device_id: UUID) =>
    call<{ reachable: boolean; latency_ms: number }>("test_device_connection", { device_id }),

  sync: (device_id: UUID) =>
    call<DeviceSyncResult>("sync_device_logs", { device_id }),

  sync_all: () =>
    call<DeviceSyncResult[]>("sync_all_devices"),
};

// ─── Organization ────────────────────────────────────────────

export const org = {
  get_departments: () =>
    call<Department[]>("get_departments"),

  get_branches: () =>
    call<Branch[]>("get_branches"),

  get_designations: () =>
    call<Designation[]>("get_designations"),

  create_department: (data: Partial<Department>) =>
    call<Department>("create_department", { request: data }),

  create_branch: (data: Partial<Branch>) =>
    call<Branch>("create_branch", { request: data }),

  create_designation: (data: Partial<Designation>) =>
    call<Designation>("create_designation", { request: data }),
};

// ─── Settings ────────────────────────────────────────────────

export const settings = {
  get_all: () =>
    call<SystemSetting[]>("get_system_settings"),

  get: (key: string) =>
    call<SystemSetting>("get_setting", { key }),

  set: (key: string, value: string) =>
    call<SystemSetting>("set_setting", { key, value }),

  delete: (key: string) =>
    call<null>("delete_setting", { key }),
};

// ─── Audit ───────────────────────────────────────────────────

export const audit = {
  list: (table?: string, limit = 50) =>
    call<AuditLog[]>("get_audit_logs", { table_name: table ?? null, limit }),
};

// ─── Sync ────────────────────────────────────────────────────

export const sync = {
  get_stats: () =>
    call<SyncStats>("get_sync_stats"),

  push: () =>
    call<SyncStats>("sync_to_supabase"),

  pull: () =>
    call<SyncStats>("pull_from_supabase"),

  resolve_conflict: (record_id: UUID, resolution: "local" | "remote") =>
    call<null>("resolve_sync_conflict", { record_id, resolution }),
};

// ─── Notifications ───────────────────────────────────────────

export const notifications = {
  list: (unread_only = false) =>
    call<Notification[]>("get_notifications", { unread_only }),

  mark_read: (id: UUID) =>
    call<null>("mark_notification_read", { notification_id: id }),

  mark_all_read: () =>
    call<null>("mark_all_notifications_read"),
};

// ─── Default export ──────────────────────────────────────────

const api = {
  auth,
  employees,
  attendance,
  leave,
  payroll,
  finance,
  inventory,
  projects,
  devices,
  org,
  settings,
  audit,
  sync,
  notifications,
};

export default api;
