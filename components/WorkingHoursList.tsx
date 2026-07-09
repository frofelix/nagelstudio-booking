"use client";

import { Lock, Umbrella } from "lucide-react";
import type { ReactNode } from "react";
import { fullDayLabels } from "@/lib/constants";
import { WorkingHoursDto } from "@/lib/types";

type TimeField = "startTime" | "endTime" | "breakStartTime" | "breakEndTime";

type WorkingHoursListProps = {
  days: WorkingHoursDto[];
  todayIso: string;
  vacationDates: string[];
  onToggleDay: (weekday: number) => void;
  onToggleBreak: (weekday: number) => void;
  onPickTime: (weekday: number, field: TimeField) => void;
};

export function WorkingHoursList({ days, todayIso, vacationDates, onToggleDay, onToggleBreak, onPickTime }: WorkingHoursListProps) {
  return (
    <section className="mx-4 mt-3 space-y-2">
      {days.map((day) => {
        const isPast = day.date < todayIso;
        const isVacation = vacationDates.includes(day.date);
        const isLocked = isPast || isVacation;
        const isWorking = day.isWorking && !isVacation;
        const status = isVacation ? "Urlaub" : isPast ? "Abgelaufen" : isWorking ? "" : "Frei";

        return (
          <div
            key={day.weekday}
            className={`rounded-2xl p-2.5 shadow-sm ring-1 transition-colors ${
              isVacation
                ? "bg-[#f0f7f3] ring-[#cfe3d7]"
                : isPast
                  ? "bg-neutral-100 text-neutral-500 ring-neutral-200"
                  : "bg-white ring-neutral-200/80"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="text-[16px] font-bold leading-5 text-neutral-950">{fullDayLabels[day.weekday - 1]}</p>
                  <span className="text-[12px] text-neutral-500">{formatShortDate(day.date)}</span>
                </div>
                {status ? <p className={`text-[12px] font-semibold ${isVacation ? "text-[#34704a]" : "text-neutral-500"}`}>{status}</p> : null}
              </div>

              {isVacation ? (
                <StatusBadge icon={<Umbrella size={15} />} label="Urlaub" />
              ) : isPast ? (
                <StatusBadge icon={<Lock size={14} />} label="Gesperrt" muted />
              ) : (
                <SwitchControl active={isWorking} disabled={isLocked} ariaLabel={isWorking ? "Arbeitstag deaktivieren" : "Arbeitstag aktivieren"} onClick={() => onToggleDay(day.weekday)} />
              )}
            </div>

            {isVacation ? (
              <div className="mt-2 rounded-2xl bg-white/70 px-3 py-2 text-[13px] font-semibold text-[#2f6844] ring-1 ring-[#d7e8de]">
                Keine Termine und keine Arbeitszeit an diesem Tag.
              </div>
            ) : isPast ? (
              <div className="mt-2 rounded-2xl bg-white/70 px-3 py-2 ring-1 ring-neutral-200">
                {isWorking ? (
                  <>
                    <div className="flex items-center justify-between gap-3 text-[14px] font-bold text-neutral-600">
                      <span>{day.startTime ?? "09:00"} - {day.endTime ?? "18:00"}</span>
                      {day.breakStartTime && day.breakEndTime ? <span className="text-[12px] font-semibold text-neutral-500">Pause {day.breakStartTime}-{day.breakEndTime}</span> : null}
                    </div>
                  </>
                ) : (
                  <p className="text-[13px] font-semibold text-neutral-500">Abgeschlossen</p>
                )}
              </div>
            ) : isWorking ? (
              <div className="mt-2 space-y-2">
                <div className="flex items-stretch gap-2">
                  <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
                    <TimeButton disabled={isPast} label="Start" value={day.startTime ?? "09:00"} onClick={() => onPickTime(day.weekday, "startTime")} />
                    <TimeButton disabled={isPast} label="Ende" value={day.endTime ?? "18:00"} onClick={() => onPickTime(day.weekday, "endTime")} />
                  </div>
                  <button
                    type="button"
                    aria-label={day.breakStartTime && day.breakEndTime ? "Pause deaktivieren" : "Pause aktivieren"}
                    onClick={() => onToggleBreak(day.weekday)}
                    className="ios-button flex w-[82px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl bg-neutral-50 px-2 ring-1 ring-neutral-200"
                  >
                    <span className="text-[11px] font-semibold leading-4 text-neutral-500">Pause</span>
                    <SwitchVisual active={Boolean(day.breakStartTime && day.breakEndTime)} compact />
                  </button>
                </div>
                {day.breakStartTime && day.breakEndTime ? (
                  <div className="grid grid-cols-2 gap-2 border-t border-neutral-100 pt-2">
                    <TimeButton disabled={isPast} label="Pause" value={day.breakStartTime} onClick={() => onPickTime(day.weekday, "breakStartTime")} />
                    <TimeButton disabled={isPast} label="bis" value={day.breakEndTime} onClick={() => onPickTime(day.weekday, "breakEndTime")} />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-2 rounded-2xl bg-neutral-50 px-3 py-2 text-[13px] font-semibold text-neutral-500 ring-1 ring-neutral-200">
                Frei
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function SwitchControl({ active, disabled, ariaLabel, onClick }: { active: boolean; disabled: boolean; ariaLabel: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className="shrink-0 rounded-full p-0 leading-none transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <SwitchVisual active={active} />
    </button>
  );
}

function SwitchVisual({ active, compact = false }: { active: boolean; compact?: boolean }) {
  return (
    <span
      className={`relative block rounded-full p-0.5 transition-colors ${compact ? "h-[26px] w-[44px]" : "h-[31px] w-[51px]"} ${
        active ? "bg-neutral-900" : "bg-neutral-200"
      }`}
    >
      <span
        className={`block rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.22)] transition-transform ${
          compact ? `h-[22px] w-[22px] ${active ? "translate-x-[18px]" : "translate-x-0"}` : `h-[27px] w-[27px] ${active ? "translate-x-5" : "translate-x-0"}`
        }`}
      />
    </span>
  );
}

function StatusBadge({ icon, label, muted = false }: { icon: ReactNode; label: string; muted?: boolean }) {
  return (
    <span
      className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold ${
        muted ? "bg-white text-neutral-500 ring-1 ring-neutral-200" : "bg-white text-[#2f6844] ring-1 ring-[#d7e8de]"
      }`}
    >
      {icon}
      {label}
    </span>
  );
}

function TimeButton({ label = "", value, disabled = false, onClick }: { label?: string; value: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="ios-button min-w-0 rounded-2xl bg-neutral-50 px-3 py-1.5 text-left ring-1 ring-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
    >
      {label ? <span className="mb-1 block truncate text-[11px] font-medium leading-4 text-neutral-500">{label}</span> : null}
      <span className={`block text-[16px] font-bold leading-5 ${disabled ? "text-neutral-400" : "text-neutral-900"}`}>{value}</span>
    </button>
  );
}

function formatShortDate(value: string) {
  const [, month, day] = value.split("-");
  return day && month ? `${day}.${month}.` : value;
}
