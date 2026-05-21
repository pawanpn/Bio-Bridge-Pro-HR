// ============================================================
// Bio-Bridge Pro HR — Nepal Payroll Tax Engine
// Implements Nepal tax law as of FY 2081/82 (2024/25):
//   • Income Tax per IRD tax slabs (individual/couple)
//   • SSF (Social Security Fund) — 31% total
//   • CIT (Citizen Investment Trust) — optional 10%
//   • Gratuity provision
//
// IMPORTANT: This mirrors the Rust engine in
//   src-tauri/src/payroll/tax_engine.rs
// Both must stay in sync. TypeScript version is used for
// real-time payslip preview; Rust version runs the actual
// payroll calculation.
// ============================================================

// ─── Types ───────────────────────────────────────────────────

export type MaritalStatus = "Single" | "Married_Couple";

export interface EmployeeTaxInput {
  /** Annual basic salary in NPR */
  annual_basic: number;
  /** Annual gross (basic + all allowances) */
  annual_gross: number;
  /** SSF contribution type */
  ssf_type: "Contributory" | "Gratuity_Based";
  /** If enrolled in CIT */
  cit_enrolled: boolean;
  /** For tax slab selection */
  marital_status: MaritalStatus;
  /** Disability allowance eligible */
  has_disability: boolean;
  /** Medical insurance premium paid (for deduction, max NPR 20,000) */
  insurance_premium: number;
  /** Life insurance premium (max NPR 40,000) */
  life_insurance: number;
}

export interface MonthlyTaxBreakdown {
  // Earnings
  basic_salary: number;
  gross_salary: number;

  // SSF (Social Security Fund) — both monthly
  ssf_employee: number;   // 11% of basic (employee contribution)
  ssf_employer: number;   // 20% of basic (employer contribution)
  ssf_total: number;      // 31%

  // CIT (optional)
  cit_employee: number;   // 10% of basic (if enrolled)
  cit_employer: number;   // 10% of basic (if enrolled)

  // Income tax (monthly installment of annual tax)
  taxable_income_annual: number;
  income_tax_annual: number;
  income_tax_monthly: number;

  // Net
  total_deductions: number; // ssf_employee + cit_employee + income_tax_monthly
  net_salary: number;

  // Employer cost
  total_employer_cost: number; // gross + ssf_employer + cit_employer

  // Breakdown for payslip display
  tax_breakdown: TaxSlab[];
}

export interface TaxSlab {
  label: string;
  from: number;
  to: number | null;
  rate: number;
  tax_on_slab: number;
}

// ─── SSF Rates ────────────────────────────────────────────────

const SSF_EMPLOYEE_RATE = 0.11; // 11%
const SSF_EMPLOYER_RATE = 0.20; // 20%
export const SSF_TOTAL_RATE = SSF_EMPLOYEE_RATE + SSF_EMPLOYER_RATE; // 31%

// ─── CIT Rates ────────────────────────────────────────────────

const CIT_EMPLOYEE_RATE = 0.10; // 10%
const CIT_EMPLOYER_RATE = 0.10; // 10%

// ─── IRD Income Tax Slabs FY 2081/82 ─────────────────────────

interface SlabDef {
  limit: number | null; // null = no upper limit
  rate: number;
  label: string;
}

const TAX_SLABS_SINGLE: SlabDef[] = [
  { limit: 600_000,   rate: 0.01, label: "Up to NPR 6,00,000 @ 1%" },
  { limit: 800_000,   rate: 0.10, label: "Next NPR 2,00,000 @ 10%" },
  { limit: 1_100_000, rate: 0.20, label: "Next NPR 3,00,000 @ 20%" },
  { limit: 2_000_000, rate: 0.30, label: "Next NPR 9,00,000 @ 30%" },
  { limit: null,      rate: 0.36, label: "Above NPR 20,00,000 @ 36%" },
];

const TAX_SLABS_COUPLE: SlabDef[] = [
  { limit: 650_000,   rate: 0.01, label: "Up to NPR 6,50,000 @ 1%" },
  { limit: 850_000,   rate: 0.10, label: "Next NPR 2,00,000 @ 10%" },
  { limit: 1_150_000, rate: 0.20, label: "Next NPR 3,00,000 @ 20%" },
  { limit: 2_050_000, rate: 0.30, label: "Next NPR 9,00,000 @ 30%" },
  { limit: null,      rate: 0.36, label: "Above NPR 20,50,000 @ 36%" },
];

// ─── Tax deductions allowed ───────────────────────────────────

const MAX_INSURANCE_DEDUCTION = 20_000;   // Medical insurance
const MAX_LIFE_INSURANCE_DEDUCTION = 40_000; // Life insurance
const DISABILITY_DEDUCTION_RATE = 0.50;   // 50% of income exempt

// ─── Core tax calculation ─────────────────────────────────────

function calcTaxOnSlabs(
  taxableIncome: number,
  slabs: SlabDef[]
): { total_tax: number; breakdown: TaxSlab[] } {
  let remaining = taxableIncome;
  let prevLimit = 0;
  let total_tax = 0;
  const breakdown: TaxSlab[] = [];

  for (const slab of slabs) {
    if (remaining <= 0) break;
    const slabSize = slab.limit !== null ? slab.limit - prevLimit : Infinity;
    const taxable = Math.min(remaining, slabSize);
    const tax_on_slab = taxable * slab.rate;
    breakdown.push({
      label: slab.label,
      from: prevLimit,
      to: slab.limit,
      rate: slab.rate,
      tax_on_slab: round2(tax_on_slab),
    });
    total_tax += tax_on_slab;
    remaining -= taxable;
    if (slab.limit !== null) prevLimit = slab.limit;
  }

  return { total_tax, breakdown };
}

// ─── Main calculation function ────────────────────────────────

/**
 * Calculate monthly payroll deductions for one employee.
 * Call this for payslip preview AND pass same inputs to
 * the Rust engine for the actual payroll run.
 */
export function calculateMonthlyPayroll(
  monthly_basic: number,
  monthly_gross: number,
  input: Omit<EmployeeTaxInput, "annual_basic" | "annual_gross">
): MonthlyTaxBreakdown {
  const annual_basic = monthly_basic * 12;
  const annual_gross = monthly_gross * 12;

  // ── SSF ────────────────────────────────────────────────────
  const ssf_employee = round2(monthly_basic * SSF_EMPLOYEE_RATE);
  const ssf_employer = round2(monthly_basic * SSF_EMPLOYER_RATE);

  // ── CIT ────────────────────────────────────────────────────
  const cit_employee = input.cit_enrolled ? round2(monthly_basic * CIT_EMPLOYEE_RATE) : 0;
  const cit_employer = input.cit_enrolled ? round2(monthly_basic * CIT_EMPLOYER_RATE) : 0;

  // ── Taxable income (annual) ────────────────────────────────
  // Gross − SSF (employee annual) − approved deductions
  const annual_ssf_employee = ssf_employee * 12;
  const annual_cit_employee = cit_employee * 12;
  const insurance_deduction = Math.min(input.insurance_premium, MAX_INSURANCE_DEDUCTION);
  const life_ins_deduction = Math.min(input.life_insurance, MAX_LIFE_INSURANCE_DEDUCTION);

  let taxable_income_annual =
    annual_gross
    - annual_ssf_employee
    - annual_cit_employee
    - insurance_deduction
    - life_ins_deduction;

  // Disability: 50% of income exempt (min threshold)
  if (input.has_disability) {
    taxable_income_annual *= (1 - DISABILITY_DEDUCTION_RATE);
  }

  taxable_income_annual = Math.max(0, taxable_income_annual);

  // ── Income tax ─────────────────────────────────────────────
  const slabs = input.marital_status === "Married_Couple"
    ? TAX_SLABS_COUPLE
    : TAX_SLABS_SINGLE;

  const { total_tax: income_tax_annual, breakdown: tax_breakdown } =
    calcTaxOnSlabs(taxable_income_annual, slabs);

  const income_tax_monthly = round2(income_tax_annual / 12);

  // ── Totals ─────────────────────────────────────────────────
  const total_deductions = ssf_employee + cit_employee + income_tax_monthly;
  const net_salary = round2(monthly_gross - total_deductions);
  const total_employer_cost = round2(monthly_gross + ssf_employer + cit_employer);

  return {
    basic_salary: round2(monthly_basic),
    gross_salary: round2(monthly_gross),
    ssf_employee,
    ssf_employer,
    ssf_total: round2(ssf_employee + ssf_employer),
    cit_employee,
    cit_employer,
    taxable_income_annual: round2(taxable_income_annual),
    income_tax_annual: round2(income_tax_annual),
    income_tax_monthly,
    total_deductions: round2(total_deductions),
    net_salary,
    total_employer_cost,
    tax_breakdown,
  };
}

// ─── Gratuity provision ───────────────────────────────────────

/**
 * Monthly gratuity provision per Nepal Labour Act:
 * 1 month salary per year of service → 1/12 per month
 */
export function monthlyGratuityProvision(monthly_basic: number): number {
  return round2(monthly_basic / 12);
}

// ─── Annual bonus (Dashain / festival) ───────────────────────

/**
 * Festival bonus — typically 1 month basic salary per year
 * divided into monthly provision.
 */
export function monthlyFestivalBonus(monthly_basic: number): number {
  return round2(monthly_basic / 12);
}

// ─── Overtime calculation ─────────────────────────────────────

/**
 * Nepal Labour Act: Overtime = 1.5× hourly rate
 * Daily hours: 8 hrs, Monthly standard: 208 hrs (26 working days × 8)
 */
export function calculateOvertime(
  monthly_basic: number,
  overtime_hours: number,
  working_days_per_month = 26
): number {
  const hourly_rate = monthly_basic / (working_days_per_month * 8);
  return round2(hourly_rate * 1.5 * overtime_hours);
}

// ─── Late deduction ───────────────────────────────────────────

/**
 * Deduct proportionally for late arrivals / absent days.
 * Based on monthly working days.
 */
export function calcAbsentDeduction(
  monthly_gross: number,
  absent_days: number,
  working_days_per_month = 26
): number {
  const daily_rate = monthly_gross / working_days_per_month;
  return round2(daily_rate * absent_days);
}

export function calcLateDeduction(
  monthly_gross: number,
  late_minutes: number,
  working_days_per_month = 26
): number {
  const minutely_rate = monthly_gross / (working_days_per_month * 8 * 60);
  return round2(minutely_rate * late_minutes);
}

// ─── IRD remittance format ────────────────────────────────────

/**
 * Generate rows for IRD salary return e-filing (TDS return).
 * Format: PAN, Name, Gross, Taxable Income, Tax Withheld
 */
export interface IRDReturnRow {
  pan_number: string;
  employee_name: string;
  gross_salary_annual: number;
  taxable_income_annual: number;
  tax_withheld_annual: number;
}

// ─── SSF remittance ───────────────────────────────────────────

export interface SSFRemittanceRow {
  ssf_number: string;
  employee_name: string;
  basic_salary: number;
  employee_contribution: number;
  employer_contribution: number;
  total_contribution: number;
  month: number;
  year: number;
}

// ─── Utility ─────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Format NPR currency */
export function formatNPR(amount: number): string {
  return new Intl.NumberFormat("ne-NP", {
    style: "currency",
    currency: "NPR",
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Format number in Nepali number system (लाख, करोड) */
export function formatNepalNumber(n: number): string {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000)    return `${(n / 100_000).toFixed(2)} L`;
  if (n >= 1_000)      return `${(n / 1_000).toFixed(1)} K`;
  return String(n);
}
