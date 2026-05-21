// ============================================================
// Bio-Bridge Pro HR — Date Utilities (BS / AD)
// All date display and input goes through here.
// Storage is always AD (ISO 8601). Display follows user's
// system setting (BS or AD), set in System Settings.
// ============================================================

import NepaliDate from "nepali-date-converter";

// ─── Config ──────────────────────────────────────────────────

/** Read from settingsService cache — default BS for Nepal */
export function getCalendarType(): "BS" | "AD" {
  return (localStorage.getItem("bb_calendar_type") as "BS" | "AD") ?? "BS";
}

export function setCalendarType(type: "BS" | "AD") {
  localStorage.setItem("bb_calendar_type", type);
}

// ─── Conversion ──────────────────────────────────────────────

/**
 * Convert AD date string → BS date string
 * Input: "2026-05-20"  Output: "2083-02-06"
 */
export function adToBS(adDate: string): string {
  try {
    const [y, m, d] = adDate.split("-").map(Number);
    const nd = new NepaliDate(new Date(y, m - 1, d));
    const year = nd.getYear();
    const month = String(nd.getMonth() + 1).padStart(2, "0");
    const day = String(nd.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return adDate;
  }
}

/**
 * Convert BS date string → AD date string
 * Input: "2083-02-06"  Output: "2026-05-20"
 */
export function bsToAD(bsDate: string): string {
  try {
    const [y, m, d] = bsDate.split("-").map(Number);
    const nd = new NepaliDate(y, m - 1, d);
    const adDate = nd.toJsDate();
    const year = adDate.getFullYear();
    const month = String(adDate.getMonth() + 1).padStart(2, "0");
    const day = String(adDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return bsDate;
  }
}

// ─── Display ─────────────────────────────────────────────────

const BS_MONTHS = [
  "Baisakh", "Jestha", "Ashadh", "Shrawan",
  "Bhadra", "Ashwin", "Kartik", "Mangsir",
  "Poush", "Magh", "Falgun", "Chaitra",
];

const BS_MONTHS_NP = [
  "बैशाख", "जेठ", "असार", "श्रावण",
  "भाद्र", "आश्विन", "कार्तिक", "मंसिर",
  "पौष", "माघ", "फाल्गुन", "चैत",
];

/** Format a stored AD date for display based on system calendar setting */
export function displayDate(
  adDate: string | null | undefined,
  options?: {
    format?: "short" | "long" | "full";
    lang?: "en" | "np";
    forceCalendar?: "BS" | "AD";
  }
): string {
  if (!adDate) return "—";
  const calendar = options?.forceCalendar ?? getCalendarType();
  const format = options?.format ?? "short";
  const lang = options?.lang ?? "en";

  if (calendar === "BS") {
    const bsDate = adToBS(adDate);
    const [y, m, d] = bsDate.split("-").map(Number);
    if (format === "short") return bsDate; // "2083-02-06"
    if (format === "long") {
      const monthName = lang === "np" ? BS_MONTHS_NP[m - 1] : BS_MONTHS[m - 1];
      return `${d} ${monthName} ${y}`; // "6 Jestha 2083"
    }
    if (format === "full") {
      const monthName = lang === "np" ? BS_MONTHS_NP[m - 1] : BS_MONTHS[m - 1];
      const weekday = new Intl.DateTimeFormat("en", { weekday: "long" }).format(
        new Date(adDate)
      );
      return `${weekday}, ${d} ${monthName} ${y}`;
    }
  }

  // AD display
  const date = new Date(adDate + "T00:00:00");
  if (format === "short") return adDate;
  if (format === "long") {
    return date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  if (format === "full") {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  return adDate;
}

/** Display a datetime (stored as ISODateTime) */
export function displayDateTime(isoDateTime: string | null | undefined): string {
  if (!isoDateTime) return "—";
  const date = new Date(isoDateTime);
  const datePart = displayDate(date.toISOString().split("T")[0]);
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${datePart} ${timePart}`;
}

/** "3 hours ago" / "2 days ago" relative time */
export function relativeTime(isoDateTime: string | null | undefined): string {
  if (!isoDateTime) return "—";
  const now = Date.now();
  const then = new Date(isoDateTime).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return displayDate(isoDateTime.split("T")[0]);
}

// ─── Input helpers ────────────────────────────────────────────

/**
 * Get today's date as a string in the user's calendar format.
 * Use this for date input defaultValues.
 */
export function todayInputValue(calendar?: "BS" | "AD"): string {
  const cal = calendar ?? getCalendarType();
  const today = new Date().toISOString().split("T")[0]; // AD
  return cal === "BS" ? adToBS(today) : today;
}

/**
 * Convert a date input value to AD (for storage).
 * Input calendar determined by system setting.
 */
export function inputValueToAD(value: string): string {
  if (!value) return "";
  const cal = getCalendarType();
  return cal === "BS" ? bsToAD(value) : value;
}

/**
 * Convert an AD date (from DB) to input value in user's calendar.
 */
export function adToInputValue(adDate: string): string {
  if (!adDate) return "";
  const cal = getCalendarType();
  return cal === "BS" ? adToBS(adDate) : adDate;
}

// ─── Range helpers ────────────────────────────────────────────

/** Get start/end of current month in AD */
export function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString().split("T")[0];
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString().split("T")[0];
  return { from, to };
}

/** Current BS fiscal year range (Shrawan 1 → Ashadh end) */
export function currentFiscalYear(): { from: string; to: string; year: string } {
  const today = new Date();
  const currentYear = today.getFullYear();
  // Nepal FY: Shrawan 1 (≈ mid-July) → Ashadh end (≈ mid-July next year)
  const fyStart = new Date(currentYear, 6, 16); // July 16 approx
  let startYear = currentYear;
  if (today < fyStart) startYear = currentYear - 1;
  return {
    from: `${startYear}-07-16`,
    to: `${startYear + 1}-07-15`,
    year: `${startYear}/${String(startYear + 1).slice(-2)}`,
  };
}

/** Days between two AD date strings */
export function daysBetween(from: string, to: string): number {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  return Math.round(Math.abs(b - a) / 86_400_000);
}

// ─── BS month name helpers ────────────────────────────────────

export function getBSMonthName(monthIndex: number, lang: "en" | "np" = "en"): string {
  return lang === "np" ? BS_MONTHS_NP[monthIndex] : BS_MONTHS[monthIndex];
}

export { BS_MONTHS, BS_MONTHS_NP };
