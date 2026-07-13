"use client";

import { useMemo, useState } from "react";
import {
  addJalaliMonths,
  formatDateKey,
  formatPersianDay,
  getJalaliMonth,
  getJalaliMonthDays,
  getJalaliMonthLabel,
  getSaturdayFirstOffset,
  isSameDay,
  isToday,
  PERSIAN_WEEKDAYS,
} from "@/lib/constants";

interface JalaliCalendarProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  isDateDisabled?: (date: Date) => boolean;
}

export default function JalaliCalendar({
  selectedDate,
  onSelectDate,
  isDateDisabled,
}: JalaliCalendarProps) {
  const [jalaliMonth, setJalaliMonth] = useState(() => getJalaliMonth(new Date()));

  const monthDays = useMemo(
    () => getJalaliMonthDays(jalaliMonth.jy, jalaliMonth.jm),
    [jalaliMonth],
  );
  const monthLabel = useMemo(
    () => getJalaliMonthLabel(jalaliMonth.jy, jalaliMonth.jm),
    [jalaliMonth],
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() =>
            setJalaliMonth((month) => addJalaliMonths(month.jy, month.jm, -1))
          }
          className="rounded-lg border border-border px-3 py-1 text-sm hover:bg-accent"
        >
          ماه قبل
        </button>
        <h2 className="font-medium">{monthLabel}</h2>
        <button
          type="button"
          onClick={() =>
            setJalaliMonth((month) => addJalaliMonths(month.jy, month.jm, 1))
          }
          className="rounded-lg border border-border px-3 py-1 text-sm hover:bg-accent"
        >
          ماه بعد
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-medium text-muted">
        {PERSIAN_WEEKDAYS.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {Array.from({ length: getSaturdayFirstOffset(monthDays[0]) }).map(
          (_, index) => (
            <div key={`empty-${index}`} />
          ),
        )}

        {monthDays.map((day) => {
          const disabled = isDateDisabled?.(day) ?? false;
          const selected = selectedDate ? isSameDay(day, selectedDate) : false;
          const today = isToday(day);

          return (
            <button
              key={formatDateKey(day)}
              type="button"
              disabled={disabled}
              onClick={() => onSelectDate(day)}
              className={`rounded-xl border px-2 py-3 text-sm transition ${
                selected
                  ? "border-primary bg-primary text-white"
                  : today && !disabled
                    ? "border-primary/50 bg-accent font-semibold"
                    : disabled
                      ? "cursor-not-allowed border-border bg-background text-muted/50"
                      : "border-border hover:border-primary hover:bg-accent"
              }`}
            >
              {formatPersianDay(day)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
