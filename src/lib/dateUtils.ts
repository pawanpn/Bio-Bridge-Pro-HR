import NepaliDate from 'nepali-date-converter';

const pad2 = (value: number) => String(value).padStart(2, '0');

const BS_MONTH_NAMES = [
  'Baisakh',
  'Jestha',
  'Ashadh',
  'Shrawan',
  'Bhadra',
  'Ashwin',
  'Kartik',
  'Mangsir',
  'Poush',
  'Magh',
  'Falgun',
  'Chaitra',
];

export const parseDateValue = (value?: string | null): Date | null => {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T00:00:00`
    : trimmed.replace(' ', 'T');

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatAdDate = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const formatAdTime = (date: Date) =>
  `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;

const formatBsDate = (date: Date) => {
  const bs = NepaliDate.fromAD(date).getBS();
  return `${bs.year}-${pad2(bs.month + 1)}-${pad2(bs.date)}`;
};

const formatBsLong = (date: Date) => {
  const bs = NepaliDate.fromAD(date).getBS();
  return `${bs.year} ${BS_MONTH_NAMES[bs.month] || bs.month + 1} ${bs.date}`;
};

export const toLocalIsoDate = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const getBsDateParts = (value?: string | null) => {
  const date = parseDateValue(value);
  if (!date) return null;
  return NepaliDate.fromAD(date).getBS();
};

export const getBsMonthMeta = (bsYear: number, bsMonthIndex: number) => {
  const firstDay = new NepaliDate(bsYear, bsMonthIndex, 1);
  const firstDayAd = firstDay.toJsDate();
  const nextMonthYear = bsMonthIndex === 11 ? bsYear + 1 : bsYear;
  const nextMonthIndex = bsMonthIndex === 11 ? 0 : bsMonthIndex + 1;
  const nextMonthFirstDay = new NepaliDate(nextMonthYear, nextMonthIndex, 1).toJsDate();
  const daysInMonth = Math.round((nextMonthFirstDay.getTime() - firstDayAd.getTime()) / (1000 * 60 * 60 * 24));

  return {
    daysInMonth,
    firstWeekday: firstDay.getDay(),
    adStartDate: firstDayAd,
  };
};

export const bsDateToAdIso = (bsYear: number, bsMonthIndex: number, bsDate: number) => {
  const adDate = new NepaliDate(bsYear, bsMonthIndex, bsDate).toJsDate();
  return toLocalIsoDate(adDate);
};

export const formatBsLabel = (value?: string | null) => {
  const bs = getBsDateParts(value);
  if (!bs) return value?.trim() || '-';
  return `${bs.year}-${pad2(bs.month + 1)}-${pad2(bs.date)}`;
};

export const formatDualDate = (value?: string | null): string => {
  const date = parseDateValue(value);
  if (!date) return value?.trim() || '-';
  return `AD ${formatAdDate(date)} | BS ${formatBsDate(date)}`;
};

export const formatDualDateTime = (value?: string | null): string => {
  const date = parseDateValue(value);
  if (!date) return value?.trim() || '-';
  return `AD ${formatAdDate(date)} ${formatAdTime(date)} | BS ${formatBsDate(date)} ${formatAdTime(date)}`;
};

export const formatDualMonth = (value?: string | null): string => {
  if (!value) return '-';

  const monthDate = parseDateValue(`${value}-01`);
  if (!monthDate) return value;

  const bs = NepaliDate.fromAD(monthDate).getBS();
  return `AD ${value} | BS ${bs.year}-${pad2(bs.month + 1)}`;
};

export const formatBsMonthName = (bsMonthIndex: number) => BS_MONTH_NAMES[bsMonthIndex] || `Month ${bsMonthIndex + 1}`;

export const formatBsLongDate = (value?: string | null): string => {
  const date = parseDateValue(value);
  if (!date) return value?.trim() || '-';
  return formatBsLong(date);
};

export const formatDateByMode = (value?: string | null, mode: 'BS' | 'AD' = getCalendarModePreference()): string => {
  if (!value) return '-';
  if (mode === 'AD') {
    const date = parseDateValue(value);
    if (!date) return value.trim();
    return formatAdDate(date);
  }
  return formatBsLabel(value);
};

export const formatDateTimeByMode = (value?: string | null, mode: 'BS' | 'AD' = getCalendarModePreference()): string => {
  if (!value) return '-';
  const date = parseDateValue(value);
  if (!date) return value.trim();
  if (mode === 'AD') {
    return `${formatAdDate(date)} ${formatAdTime(date)}`;
  }
  return `${formatBsLabel(value)} ${formatAdTime(date)}`;
};

export const formatMonthByMode = (value?: string | null, mode: 'BS' | 'AD' = getCalendarModePreference()): string => {
  if (!value) return '-';
  if (mode === 'AD') return value;
  const monthDate = parseDateValue(`${value}-01`);
  if (!monthDate) return value;
  const bs = NepaliDate.fromAD(monthDate).getBS();
  return `${bs.year}-${pad2(bs.month + 1)}`;
};

export const getCalendarModePreference = (): 'BS' | 'AD' => {
  try {
    const value = localStorage.getItem('calendarMode');
    return value === 'AD' ? 'AD' : 'BS';
  } catch {
    return 'BS';
  }
};

export const setCalendarModePreference = (mode: 'BS' | 'AD') => {
  try {
    localStorage.setItem('calendarMode', mode);
    window.dispatchEvent(new CustomEvent('calendar-mode-changed', { detail: mode }));
  } catch {
    // Ignore storage failures.
  }
};
