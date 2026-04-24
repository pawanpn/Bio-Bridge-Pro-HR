import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  bsDateToAdIso,
  formatBsLongDate,
  formatBsMonthName,
  formatDualDate,
  formatDualMonth,
  getBsDateParts,
  getBsMonthMeta,
  getCalendarModePreference,
  toLocalIsoDate,
} from '@/lib/dateUtils';

type PickerKind = 'date' | 'month';

type BsDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  kind?: PickerKind;
};

const weekdayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const readMode = () => getCalendarModePreference();

export const BsDatePicker: React.FC<BsDatePickerProps> = ({
  value,
  onChange,
  className,
  disabled,
  placeholder = 'Select date',
  label,
  kind = 'date',
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const yearInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<'BS' | 'AD'>(readMode);
  const [open, setOpen] = useState(false);
  const todayIso = toLocalIsoDate(new Date());
  const [yearDraft, setYearDraft] = useState('');

  const currentBs = useMemo(() => {
    const base = kind === 'month' ? (value ? `${value}-01` : todayIso) : (value || todayIso);
    const bs = getBsDateParts(base);
    return bs || getBsDateParts(new Date().toISOString().slice(0, 10)) || { year: 2080, month: 0, date: 1, day: 0 };
  }, [kind, value, todayIso]);

  const [viewYear, setViewYear] = useState(currentBs.year);
  const [viewMonth, setViewMonth] = useState(currentBs.month);

  useEffect(() => {
    const syncMode = () => setMode(readMode());
    const handleModeEvent = () => syncMode();

    window.addEventListener('calendar-mode-changed', handleModeEvent as EventListener);
    window.addEventListener('storage', syncMode);
    syncMode();
    return () => {
      window.removeEventListener('calendar-mode-changed', handleModeEvent as EventListener);
      window.removeEventListener('storage', syncMode);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const bs = getBsDateParts(kind === 'month' ? `${value}-01` : value);
    if (bs) {
      setViewYear(bs.year);
      setViewMonth(bs.month);
    }
  }, [kind, value]);

  useEffect(() => {
    setYearDraft(String(viewYear));
  }, [viewYear]);

  const { daysInMonth, firstWeekday } = useMemo(
    () => getBsMonthMeta(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const selectedBs = getBsDateParts(kind === 'month' ? (value ? `${value}-01` : '') : value);

  const changeMonth = (delta: number) => {
    const nextMonth = viewMonth + delta;
    if (nextMonth < 0) {
      setViewYear(prev => prev - 1);
      setViewMonth(11);
      return;
    }
    if (nextMonth > 11) {
      setViewYear(prev => prev + 1);
      setViewMonth(0);
      return;
    }
    setViewMonth(nextMonth);
  };

  const selectDay = (day: number) => {
    const nextValue = bsDateToAdIso(viewYear, viewMonth, day);
    onChange(nextValue);
    setOpen(false);
  };

  const selectMonth = (monthIndex: number) => {
    const nextValue = bsDateToAdIso(viewYear, monthIndex, 1).slice(0, 7);
    onChange(nextValue);
    setOpen(false);
  };

  const applyYear = () => {
    const parsed = Number.parseInt(yearDraft, 10);
    if (!Number.isFinite(parsed) || parsed < 2000 || parsed > 2200) return;
    setViewYear(parsed);
  };

  const bsDateLabel = value ? formatBsLongDate(value) : '';
  const bsMonthLabel = selectedBs ? `${selectedBs.year}-${String(selectedBs.month + 1).padStart(2, '0')}` : '';
  const adMonthLabel = value ? formatDualMonth(value) : '';

  if (mode === 'AD') {
    return (
      <div ref={rootRef} className={cn('relative', className)}>
        {label && <div className="mb-1 text-[9px] uppercase font-bold text-slate-400">{label}</div>}
        <div className="relative">
          <Input
            type={kind === 'month' ? 'month' : 'date'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={cn('pr-10', className)}
          />
          <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground">
          {value ? `BS: ${bsDateLabel}` : placeholder}
        </div>
      </div>
    );
  }

  if (kind === 'month') {
    return (
      <div ref={rootRef} className={cn('relative', className)}>
        {label && <div className="mb-1 text-[9px] uppercase font-bold text-slate-400">{label}</div>}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(prev => !prev)}
          className={cn(
            'w-full flex items-center justify-between gap-3 rounded-md border border-input bg-background px-3 py-2 text-left text-sm shadow-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          <span className="flex min-w-0 flex-col">
            <span className={cn('truncate font-medium', !value && 'text-muted-foreground')}>
              {value ? bsMonthLabel : placeholder}
            </span>
            <span className="truncate text-[10px] text-muted-foreground">
              {value ? adMonthLabel : 'Select BS month, AD will be stored automatically'}
            </span>
          </span>
          <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>

        {open && !disabled && (
          <div className="absolute left-0 top-full z-50 mt-2 w-[340px] rounded-xl border bg-card p-3 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <button type="button" onClick={() => setViewYear(prev => prev - 1)} className="rounded-md p-1.5 hover:bg-muted">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="text-center">
                <div className="flex items-center gap-2">
                  <Input
                    ref={yearInputRef}
                    value={yearDraft}
                    onChange={(e) => setYearDraft(e.target.value.replace(/[^0-9]/g, ''))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        applyYear();
                      }
                    }}
                    inputMode="numeric"
                    className="h-8 w-20 text-center text-sm font-bold"
                  />
                  <button
                    type="button"
                    onClick={applyYear}
                    className="h-8 rounded-md border px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted"
                  >
                    Go
                  </button>
                </div>
                <div className="text-[10px] text-muted-foreground">BS year</div>
              </div>
              <button type="button" onClick={() => setViewYear(prev => prev + 1)} className="rounded-md p-1.5 hover:bg-muted">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }).map((_, idx) => {
                const monthNumber = idx + 1;
                const selected = selectedBs?.year === viewYear && selectedBs?.month === idx;
                return (
                  <button
                    key={monthNumber}
                    type="button"
                    onClick={() => selectMonth(idx)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
                      selected ? 'border-primary bg-primary text-primary-foreground' : 'border-slate-200 bg-muted/20 hover:bg-muted'
                    )}
                  >
                    {formatBsMonthName(idx)}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 rounded-lg bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              {value ? `Selected: BS ${bsMonthLabel} | AD saved: ${value}` : 'Pick a BS month. AD month will be stored automatically.'}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {label && <div className="mb-1 text-[9px] uppercase font-bold text-slate-400">{label}</div>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(prev => !prev)}
        className={cn(
          'w-full flex items-center justify-between gap-3 rounded-md border border-input bg-background px-3 py-2 text-left text-sm shadow-sm transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <span className="flex min-w-0 flex-col">
          <span className={cn('truncate font-medium', !value && 'text-muted-foreground')}>
            {value ? formatBsLongDate(value) : placeholder}
          </span>
          <span className="truncate text-[10px] text-muted-foreground">
            {value ? formatDualDate(value) : 'Pick a BS date. AD will be stored automatically.'}
          </span>
        </span>
        <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[320px] rounded-xl border bg-card p-3 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => changeMonth(-1)} className="rounded-md p-1.5 hover:bg-muted">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-center">
              <div className="flex items-center gap-2">
                <Input
                  ref={yearInputRef}
                  value={yearDraft}
                  onChange={(e) => setYearDraft(e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      applyYear();
                    }
                  }}
                  inputMode="numeric"
                  className="h-8 w-20 text-center text-sm font-bold"
                />
                <button
                  type="button"
                  onClick={applyYear}
                  className="h-8 rounded-md border px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted"
                >
                  Go
                </button>
              </div>
              <div className="text-[10px] text-muted-foreground">BS calendar</div>
            </div>
            <button type="button" onClick={() => changeMonth(1)} className="rounded-md p-1.5 hover:bg-muted">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-muted-foreground">
            {weekdayLabels.map(day => (
              <div key={day} className="py-1">
                {day}
              </div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1">
            {Array.from({ length: firstWeekday }).map((_, idx) => (
              <div key={`blank-${idx}`} className="h-8" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const isSelected = selectedBs?.year === viewYear && selectedBs?.month === viewMonth && selectedBs?.date === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={cn(
                    'h-8 rounded-md text-xs font-semibold transition-colors hover:bg-primary/10',
                    isSelected
                      ? 'bg-primary text-primary-foreground hover:bg-primary'
                      : 'bg-muted/30 text-foreground'
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-3 rounded-lg bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
            {value ? `Selected: ${formatDualDate(value)} | AD saved: ${value}` : 'Pick a BS date. AD will be stored automatically.'}
          </div>
        </div>
      )}
    </div>
  );
};
