"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatWeekRange, weekNumber } from "@/lib/date";

type WeekSelectorProps = {
  weekStart: Date;
  includeSunday?: boolean;
  onPrev: () => void;
  onNext: () => void;
};

export function WeekSelector({ weekStart, includeSunday = false, onPrev, onNext }: WeekSelectorProps) {
  return (
    <section className="ios-card mx-4 mt-3 rounded-3xl px-3 py-2">
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Vorherige Woche" className="ios-button grid h-11 w-11 place-items-center rounded-full active:bg-neutral-100" onClick={onPrev}>
          <ChevronLeft size={22} strokeWidth={1.8} />
        </button>
        <div className="text-center">
          <p className="text-[17px] font-semibold leading-6">Woche {weekNumber(weekStart)}</p>
          <p className="text-[14px] leading-5 text-neutral-500">{formatWeekRange(weekStart, includeSunday)}</p>
        </div>
        <button type="button" aria-label="Naechste Woche" className="ios-button grid h-11 w-11 place-items-center rounded-full active:bg-neutral-100" onClick={onNext}>
          <ChevronRight size={22} strokeWidth={1.8} />
        </button>
      </div>
    </section>
  );
}
