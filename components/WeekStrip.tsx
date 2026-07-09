"use client";

import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { dayLabels } from "@/lib/constants";
import { getWeekDays, isoDate, sameDate } from "@/lib/date";

type WeekStripProps = {
  weekStart: Date;
  selectedDate: Date;
  onSelectDate?: (date: Date) => void;
  limitToSaturday?: boolean;
  markPast?: boolean;
  onPreviousWeek?: () => void;
  onNextWeek?: () => void;
};

export function WeekStrip({ weekStart, selectedDate, onSelectDate, limitToSaturday = false, markPast = true, onPreviousWeek, onNextWeek }: WeekStripProps) {
  const [todayIso, setTodayIso] = useState<string | null>(null);
  const today = todayIso ? new Date(`${todayIso}T00:00:00`) : null;
  const days = getWeekDays(weekStart).slice(0, limitToSaturday ? 6 : 7);
  const touchStartX = useRef<number | null>(null);
  const hasWeekControls = Boolean(onPreviousWeek && onNextWeek);

  useEffect(() => {
    setTodayIso(isoDate(new Date()));
  }, []);

  function handleTouchEnd(x: number) {
    if (touchStartX.current === null || !hasWeekControls) return;
    const delta = x - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 42) return;
    if (delta > 0) onPreviousWeek?.();
    else onNextWeek?.();
  }

  const grid = (
    <div
      className={`grid min-w-0 flex-1 touch-pan-y select-none ${limitToSaturday ? "grid-cols-6" : "grid-cols-7"} rounded-2xl bg-white p-1 text-center shadow-sm ring-1 ring-neutral-200/70`}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
    >
      {days.map((day, index) => {
        const selected = sameDate(day, selectedDate);
        const isToday = today ? sameDate(day, today) : false;
        const isPast = markPast && todayIso ? isoDate(day) < todayIso : false;
        return (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onSelectDate?.(day)}
            className={`ios-button flex h-[60px] flex-col items-center justify-center gap-1 rounded-xl text-sm active:bg-neutral-100 ${
              isPast && !selected ? "text-neutral-400" : "text-neutral-950"
            }`}
          >
            <span className={`text-[11px] font-medium ${isPast && !selected ? "text-neutral-400" : "text-neutral-500"}`}>{dayLabels[index]}</span>
            <span
              className={`grid h-8 w-8 place-items-center rounded-full text-[16px] font-semibold ${
                selected
                  ? isPast
                    ? "bg-neutral-400 text-white shadow-sm"
                    : "bg-neutral-900 text-white shadow-sm"
                  : isToday
                    ? "bg-neutral-100 text-neutral-950"
                    : isPast
                      ? "bg-neutral-100 text-neutral-400"
                      : "text-neutral-950"
              }`}
            >
              {format(day, "d")}
            </span>
            {isPast ? <span className="-mt-0.5 h-1 w-1 rounded-full bg-neutral-300" aria-hidden="true" /> : <span className="-mt-0.5 h-1 w-1" />}
          </button>
        );
      })}
    </div>
  );

  if (!hasWeekControls) {
    return <div className="mx-4 mt-2">{grid}</div>;
  }

  return (
    <div className="mx-4 mt-2 flex items-center gap-2">
      <button type="button" onClick={onPreviousWeek} className="ios-button grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200" aria-label="Vorherige Woche">
        <ChevronLeft size={21} strokeWidth={1.9} />
      </button>
      {grid}
      <button type="button" onClick={onNextWeek} className="ios-button grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200" aria-label="Nächste Woche">
        <ChevronRight size={21} strokeWidth={1.9} />
      </button>
    </div>
  );
}
