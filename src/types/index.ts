// ============================================================
// Bio-Bridge Pro HR — Master TypeScript Types
// Matches Rust structs in src-tauri/src/crud.rs exactly.
// ALL pages must import from here — never define local types.
// ============================================================

// ─── Utility ────────────────────────────────────────────────

export type UUID = string;
export type ISODate = string; // "YYYY-MM-DD"
export type ISODateTime = string; // "YYYY-MM-DDTHH:mm:ssZ"
export type BSDate = string; // "YYYY-MM-DD" Bikram Sambat

/** Standard API response wrapper from Rust backend */
export interface ApiResponse<T = null> {
  success: boolean;
  data: T | null;
  message: string;
  error?: string;
}

/** Paginated list response */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}

// ─── Auth / Session ─────────────────────────────────────────

export type UserRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "MANAGER"
  | "SUPERVISOR"
  | "EMPLOYEE"
  | "OPERATOR"
  | "VIEWER";

export interface AuthUser {
  id: UUID;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  role_id: UUID;
  role_level: number;
  organization_id: UUID;
  branch_id: UUID | null;
  department_id: UUID | null;
  employee_id: UUID | null;
  is_active: boolean;
  last_login: ISODateTime | null;
  permissions: string[]; // ["hr:view_employees", "leave:approve", ...]
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: AuthUser;
  token: string;
  expires_at: ISODateTime;
}

// ─── Organization ────────────────────────────────────────────

export interface Organization {
  id: UUID;
  name: string;
  code: string;
  email: string;
  phone: string;
  address: string;
  logo_url: string | null;
  website: string | null;
  fiscal_year_start: ISODate;
  currency: "NPR" | "USD" | "INR";
  timezone: string;
  calendar_type: "BS" | "AD";
  is_active: boolean;
  created_at: ISODateTime;
}

export interface Branch {
  id: UUID;
  organization_id: UUID;
  name: string;
  code: string;
  address: string;
  phone: string | null;
  email: string | null;
  is_head_office: boolean;
  is_active: boolean;
}

export interface Department {
  id: UUID;
  organization_id: UUID;
  name: string;
  code: string;
  parent_department_id: UUID | null;
  head_employee_id: UUID | null;
  description: string | null;
  is_active: boolean;
}

export interface Designation {
  id: UUID;
  organization_id: UUID;
  name: string;
  code: string;
  grade: string | null;
  description: string | null;
  is_active: boolean;
}

// ─── Employee ────────────────────────────────────────────────

export type EmploymentStatus =
  | "Active"
  | "Inactive"
  | "On_Leave"
  | "Probation"
  | "Resigned"
  | "Terminated"
  | "Retired";

export type Gender = "Male" | "Female" | "Other" | "Prefer_Not_To_Say";

export type BloodGroup =
  | "A+"
  | "A-"
  | "B+"
  | "B-"
  | "O+"
  | "O-"
  | "AB+"
  | "AB-"
  | "Unknown";

export type MaritalStatus =
  | "Single"
  | "Married"
  | "Divorced"
  | "Widowed"
  | "Separated";

export interface Employee {
  id: UUID;
  organization_id: UUID;
  branch_id: UUID;
  department_id: UUID;
  designation_id: UUID;
  role_id: UUID;
  reporting_manager_id: UUID | null;
  employee_code: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  full_name: string; // computed
  gender: Gender;
  date_of_birth: ISODate | null;
  blood_group: BloodGroup;
  marital_status: MaritalStatus;
  nationality: string;
  // Encrypted fields — returned decrypted by Rust layer
  personal_email: string;
  work_email: string | null;
  personal_phone: string;
  work_phone: string | null;
  permanent_address: string;
  current_address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  // Identification
  citizenship_number: string | null;
  pan_number: string | null;
  ssf_number: string | null;
  passport_number: string | null;
  // Bank (encrypted)
  bank_name: string | null;
  bank_account_number: string | null;
  bank_branch: string | null;
  // Employment
  join_date: ISODate;
  confirmation_date: ISODate | null;
  employment_status: EmploymentStatus;
  employment_type: "Full_Time" | "Part_Time" | "Contract" | "Intern";
  // Device
  biometric_id: string | null;
  photo_url: string | null;
  // Meta
  is_active: boolean;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  // Joined fields
  department_name?: string;
  designation_name?: string;
  branch_name?: string;
  reporting_manager_name?: string;
}

export interface CreateEmployeeRequest {
  employee_code: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  gender: Gender;
  date_of_birth?: ISODate;
  blood_group?: BloodGroup;
  marital_status?: MaritalStatus;
  nationality?: string;
  personal_email: string;
  work_email?: string;
  personal_phone: string;
  work_phone?: string;
  permanent_address: string;
  current_address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
  citizenship_number?: string;
  pan_number?: string;
  ssf_number?: string;
  passport_number?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_branch?: string;
  join_date: ISODate;
  employment_type: "Full_Time" | "Part_Time" | "Contract" | "Intern";
  branch_id: UUID;
  department_id: UUID;
  designation_id: UUID;
  role_id: UUID;
  reporting_manager_id?: UUID;
  biometric_id?: string;
}

export interface UpdateEmployeeRequest extends Partial<CreateEmployeeRequest> {
  employment_status?: EmploymentStatus;
  confirmation_date?: ISODate;
  is_active?: boolean;
}

export interface EmployeeFilters {
  department_id?: UUID;
  branch_id?: UUID;
  designation_id?: UUID;
  employment_status?: EmploymentStatus;
  employment_type?: string;
  search?: string; // name, code, email
  page?: number;
  per_page?: number;
}

// ─── Attendance ──────────────────────────────────────────────

export type AttendanceStatus =
  | "Present"
  | "Absent"
  | "Late"
  | "Half_Day"
  | "Holiday"
  | "Weekend"
  | "On_Leave";

export type PunchType = "Check_In" | "Check_Out" | "Break_Start" | "Break_End";

export interface AttendanceLog {
  id: UUID;
  employee_id: UUID;
  device_id: UUID | null;
  punch_time: ISODateTime;
  punch_type: PunchType;
  source: "Device" | "Manual" | "Mobile";
  location: string | null;
  is_valid: boolean;
  notes: string | null;
  created_at: ISODateTime;
  // Joined
  employee_name?: string;
  employee_code?: string;
}

export interface AttendanceDaily {
  id: UUID;
  employee_id: UUID;
  date: ISODate;
  check_in: ISODateTime | null;
  check_out: ISODateTime | null;
  total_hours: number | null;
  overtime_hours: number | null;
  late_minutes: number;
  early_leave_minutes: number;
  status: AttendanceStatus;
  shift_id: UUID | null;
  is_regularized: boolean;
  regularized_by: UUID | null;
  notes: string | null;
  // Joined
  employee_name?: string;
  employee_code?: string;
  department_name?: string;
}

export interface ManualAttendanceRequest {
  employee_id: UUID;
  date: ISODate;
  check_in?: ISODateTime;
  check_out?: ISODateTime;
  status: AttendanceStatus;
  reason: string;
}

export interface AttendanceFilters {
  employee_id?: UUID;
  department_id?: UUID;
  branch_id?: UUID;
  date_from?: ISODate;
  date_to?: ISODate;
  status?: AttendanceStatus;
  page?: number;
  per_page?: number;
}

// ─── Leave ───────────────────────────────────────────────────

export type LeaveStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";

export interface LeaveType {
  id: UUID;
  organization_id: UUID;
  name: string;
  code: string;
  days_allowed: number;
  is_paid: boolean;
  carry_forward: boolean;
  max_carry_forward_days: number;
  gender_specific: Gender | null;
  description: string | null;
  color: string | null;
  is_active: boolean;
}

export interface LeaveBalance {
  id: UUID;
  employee_id: UUID;
  leave_type_id: UUID;
  year: number;
  allocated_days: number;
  used_days: number;
  carried_days: number;
  remaining_days: number; // computed
  // Joined
  leave_type_name?: string;
  employee_name?: string;
}

export interface LeaveRequest {
  id: UUID;
  employee_id: UUID;
  leave_type_id: UUID;
  start_date: ISODate;
  end_date: ISODate;
  total_days: number;
  reason: string;
  status: LeaveStatus;
  applied_at: ISODateTime;
  approved_by: UUID | null;
  approved_at: ISODateTime | null;
  rejection_reason: string | null;
  handover_notes: string | null;
  // Joined
  employee_name?: string;
  employee_code?: string;
  leave_type_name?: string;
  approver_name?: string;
}

export interface CreateLeaveRequest {
  leave_type_id: UUID;
  start_date: ISODate;
  end_date: ISODate;
  reason: string;
  handover_notes?: string;
}

export interface LeaveApprovalRequest {
  leave_request_id: UUID;
  status: "Approved" | "Rejected";
  comment?: string;
}

export interface LeaveFilters {
  employee_id?: UUID;
  department_id?: UUID;
  leave_type_id?: UUID;
  status?: LeaveStatus;
  date_from?: ISODate;
  date_to?: ISODate;
  page?: number;
  per_page?: number;
}

// ─── Payroll ─────────────────────────────────────────────────

export type ComponentType = "Earning" | "Deduction" | "Employer_Contribution";
export type PayrollStatus = "Draft" | "Processing" | "Processed" | "Paid" | "Cancelled";

export interface SalaryComponent {
  id: UUID;
  organization_id: UUID;
  name: string;
  code: string;
  component_type: ComponentType;
  calculation_type: "Fixed" | "Percentage_Of_Basic" | "Percentage_Of_Gross";
  default_value: number;
  is_taxable: boolean;
  is_mandatory: boolean;
  description: string | null;
  is_active: boolean;
}

export interface EmployeeSalaryStructure {
  id: UUID;
  employee_id: UUID;
  effective_from: ISODate;
  effective_to: ISODate | null;
  basic_salary: number;
  gross_salary: number; // computed
  components: SalaryStructureComponent[];
  is_active: boolean;
}

export interface SalaryStructureComponent {
  component_id: UUID;
  component_name: string;
  component_type: ComponentType;
  amount: number;
}

export interface PayrollRun {
  id: UUID;
  organization_id: UUID;
  month: number;
  year: number;
  period_start: ISODate;
  period_end: ISODate;
  status: PayrollStatus;
  total_employees: number;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  total_employer_contributions: number;
  processed_by: UUID | null;
  processed_at: ISODateTime | null;
  remarks: string | null;
}

export interface PayrollRecord {
  id: UUID;
  payroll_run_id: UUID;
  employee_id: UUID;
  basic_salary: number;
  gross_salary: number;
  total_earnings: number;
  total_deductions: number;
  net_salary: number;
  // Nepal-specific
  ssf_employee: number;
  ssf_employer: number;
  income_tax: number;
  cit: number;
  working_days: number;
  present_days: number;
  absent_days: number;
  leave_days: number;
  overtime_hours: number;
  overtime_amount: number;
  components: PayrollRecordComponent[];
  is_paid: boolean;
  paid_at: ISODateTime | null;
  // Joined
  employee_name?: string;
  employee_code?: string;
}

export interface PayrollRecordComponent {
  component_id: UUID;
  component_name: string;
  component_type: ComponentType;
  amount: number;
}

// ─── Finance ─────────────────────────────────────────────────

export type InvoiceStatus = "Draft" | "Sent" | "Paid" | "Overdue" | "Cancelled";

export interface Invoice {
  id: UUID;
  organization_id: UUID;
  invoice_number: string;
  client_name: string;
  client_email: string | null;
  client_address: string | null;
  issue_date: ISODate;
  due_date: ISODate;
  status: InvoiceStatus;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount: number;
  total: number;
  paid_amount: number;
  balance: number; // computed
  notes: string | null;
  items: InvoiceItem[];
  created_at: ISODateTime;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number; // computed
}

export interface CreateInvoiceRequest {
  client_name: string;
  client_email?: string;
  client_address?: string;
  issue_date: ISODate;
  due_date: ISODate;
  tax_rate: number;
  discount: number;
  notes?: string;
  items: Omit<InvoiceItem, "total">[];
}

// ─── Inventory ───────────────────────────────────────────────

export interface InventoryItem {
  id: UUID;
  organization_id: UUID;
  category_id: UUID;
  code: string;
  name: string;
  description: string | null;
  unit: string;
  hsn_code: string | null;
  current_stock: number;
  min_stock: number;
  max_stock: number;
  reorder_point: number;
  unit_cost: number;
  is_active: boolean;
  // Joined
  category_name?: string;
  warehouse_stock?: WarehouseStock[];
}

export interface WarehouseStock {
  warehouse_id: UUID;
  warehouse_name: string;
  quantity: number;
}

export interface StockUpdateRequest {
  item_id: UUID;
  warehouse_id: UUID;
  quantity: number;
  type: "In" | "Out" | "Adjustment";
  reference: string | null;
  notes: string | null;
}

// ─── Projects ────────────────────────────────────────────────

export type ProjectStatus = "Planning" | "Active" | "On_Hold" | "Completed" | "Cancelled";
export type TaskStatus = "Backlog" | "Todo" | "In_Progress" | "In_Review" | "Done";
export type TaskPriority = "Low" | "Medium" | "High" | "Critical";

export interface Project {
  id: UUID;
  organization_id: UUID;
  name: string;
  code: string;
  description: string | null;
  client_name: string | null;
  start_date: ISODate;
  end_date: ISODate | null;
  status: ProjectStatus;
  budget: number | null;
  manager_id: UUID;
  is_billable: boolean;
  // Joined
  manager_name?: string;
  task_count?: number;
  completed_task_count?: number;
}

export interface Task {
  id: UUID;
  project_id: UUID;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: UUID | null;
  due_date: ISODate | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  parent_task_id: UUID | null;
  created_by: UUID;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  // Joined
  assignee_name?: string;
}

// ─── Devices (Biometric) ─────────────────────────────────────

export type DeviceType = "ZKTeco" | "Hikvision" | "Other";
export type DeviceStatus = "Online" | "Offline" | "Error" | "Unknown";

export interface BiometricDevice {
  id: UUID;
  organization_id: UUID;
  branch_id: UUID;
  name: string;
  device_type: DeviceType;
  ip_address: string;
  port: number;
  serial_number: string | null;
  location: string | null;
  status: DeviceStatus;
  last_sync: ISODateTime | null;
  is_active: boolean;
}

export interface DeviceSyncResult {
  device_id: UUID;
  device_name: string;
  records_pulled: number;
  records_processed: number;
  records_failed: number;
  sync_time: ISODateTime;
  errors: string[];
}

// ─── System / Settings ───────────────────────────────────────

export type SettingType = "string" | "number" | "boolean" | "json";

export interface SystemSetting {
  id: UUID;
  key: string;
  value: string;
  setting_type: SettingType;
  category: string;
  description: string | null;
  is_public: boolean;
}

// ─── Audit ───────────────────────────────────────────────────

export interface AuditLog {
  id: UUID;
  user_id: UUID;
  action: "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT" | "SYNC";
  table_name: string;
  record_id: UUID | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: ISODateTime;
  // Joined
  user_name?: string;
}

// ─── Sync ────────────────────────────────────────────────────

export type SyncStatus = "Pending" | "Syncing" | "Synced" | "Failed" | "Conflict";

export interface SyncStats {
  pending_count: number;
  failed_count: number;
  last_sync_at: ISODateTime | null;
  last_sync_status: SyncStatus | null;
  total_synced_today: number;
}

// ─── Notifications ───────────────────────────────────────────

export type NotificationType =
  | "leave_request"
  | "leave_approved"
  | "leave_rejected"
  | "attendance_alert"
  | "payroll_processed"
  | "device_offline"
  | "low_stock"
  | "task_assigned"
  | "system";

export interface AppNotification {
  id: UUID;
  user_id: UUID;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: ISODateTime;
}

// ─── Form helpers ────────────────────────────────────────────

/** Generic select option used across all dropdowns */
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/** Used for Department/Org hierarchy trees */
export interface TreeNode<T = Record<string, unknown>> {
  id: UUID;
  label: string;
  children: TreeNode<T>[];
  data: T;
}
