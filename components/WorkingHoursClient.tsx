"use client";

import { addDays, addWeeks } from "date-fns";
import { CalendarDays, CheckCircle2, Sun, Trash2, Umbrella, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { TimeWheelPicker } from "@/components/TimeWheelPicker";
import { WeekSelector } from "@/components/WeekSelector";
import { WeekStrip } from "@/components/WeekStrip";
import { WorkingHoursList } from "@/components/WorkingHoursList";
import { businessDefaults, DEMO_EMPLOYEE_ID, fullDayLabels } from "@/lib/constants";
import { getWeekStart, isoDate } from "@/lib/date";
import { minutesToTime, timeToMinutes } from "@/lib/time";
import { WorkingHoursDto } from "@/lib/types";

type TimeField = "startTime" | "endTime" | "breakStartTime" | "breakEndTime";
type ScheduleMode = "consistent" | "flexible";

type PickerState =
  | {
      type: "day";
      weekday: number;
      field: TimeField;
      value: string;
    }
  | {
      type: "standard";
      field: TimeField;
      value: string;
    };

type StandardHours = {
  startTime: string;
  endTime: string;
  breakEnabled: boolean;
  breakStartTime: string;
  breakEndTime: string;
};

type VacationRange = {
  id: string;
  employeeId?: string;
  employeeName?: string;
  startDate: string;
  endDate: string;
  note?: string | null;
};

export function WorkingHoursClient({ employeeId = DEMO_EMPLOYEE_ID }: { employeeId?: string | null }) {
  const activeEmployeeId = employeeId ?? DEMO_EMPLOYEE_ID;
  const vacationStorageKey = `nail-studio-vacations-${activeEmployeeId}`;
  const modeStorageKey = `nail-studio-working-mode-${activeEmployeeId}`;
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [days, setDays] = useState<WorkingHoursDto[]>(() => localDefaultDays(getWeekStart(new Date()), activeEmployeeId));
  const [mode, setMode] = useState<ScheduleMode>("consistent");
  const [standardHours, setStandardHours] = useState<StandardHours>({
    startTime: businessDefaults.startTime,
    endTime: businessDefaults.endTime,
    breakEnabled: true,
    breakStartTime: businessDefaults.breakStartTime,
    breakEndTime: businessDefaults.breakEndTime
  });
  const [vacations, setVacations] = useState<VacationRange[]>([]);
  const [vacationsHydrated, setVacationsHydrated] = useState(false);
  const [vacationSheetOpen, setVacationSheetOpen] = useState(false);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [message, setMessage] = useState("");
  const selectedDate = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => isoDate(new Date()), []);
  const vacationDates = useMemo(() => collectVacationDates(vacations), [vacations]);
  const displayDays = useMemo(() => applyVacationDisplay(days, vacationDates), [days, vacationDates]);

  useEffect(() => {
    let active = true;
    setMessage("");
    fetch(`/api/staff/working-hours?employeeId=${activeEmployeeId}&weekStartDate=${isoDate(weekStart)}`)
      .then((response) => {
        if (!response.ok) throw new Error("working hours failed");
        return response.json();
      })
      .then((data) => {
        if (active) setDays(data.workingHours ?? []);
      })
      .catch(() => {
        if (active) setDays(localDefaultDays(weekStart, activeEmployeeId));
      });

    return () => {
      active = false;
    };
  }, [activeEmployeeId, weekStart]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedMode = window.localStorage.getItem(modeStorageKey);
    if (storedMode === "consistent" || storedMode === "flexible") setMode(storedMode);

    const storedVacations = window.localStorage.getItem(vacationStorageKey);
    if (storedVacations) {
      try {
        const parsed = JSON.parse(storedVacations);
        if (Array.isArray(parsed)) setVacations(parsed);
      } catch {
        setVacations([]);
      }
    }

    setVacationsHydrated(true);

    fetch(`/api/staff/vacations?employeeId=${activeEmployeeId}`)
      .then((response) => {
        if (!response.ok) throw new Error("vacations failed");
        return response.json();
      })
      .then((data) => {
        if (Array.isArray(data.vacations)) setVacations(data.vacations);
      })
      .catch(() => undefined);
  }, [activeEmployeeId, modeStorageKey, vacationStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(modeStorageKey, mode);
  }, [mode]);

  useEffect(() => {
    if (!vacationsHydrated || typeof window === "undefined") return;
    window.localStorage.setItem(vacationStorageKey, JSON.stringify(vacations));
  }, [vacations, vacationsHydrated]);

  function isDayLocked(day: WorkingHoursDto) {
    return day.date < todayIso || vacationDates.includes(day.date);
  }

  function toggleDay(weekday: number) {
    setDays((current) =>
      current.map((day) => {
        if (day.weekday !== weekday || isDayLocked(day)) return day;
        const nextWorking = !day.isWorking;
        return {
          ...day,
          isWorking: nextWorking,
          startTime: nextWorking ? day.startTime ?? standardHours.startTime : null,
          endTime: nextWorking ? day.endTime ?? standardHours.endTime : null,
          breakStartTime: nextWorking && standardHours.breakEnabled ? day.breakStartTime ?? standardHours.breakStartTime : null,
          breakEndTime: nextWorking && standardHours.breakEnabled ? day.breakEndTime ?? standardHours.breakEndTime : null
        };
      })
    );
  }

  function toggleBreak(weekday: number) {
    setDays((current) =>
      current.map((day) => {
        if (day.weekday !== weekday || isDayLocked(day) || !day.isWorking) return day;
        const hasBreak = Boolean(day.breakStartTime && day.breakEndTime);
        return {
          ...day,
          breakStartTime: hasBreak ? null : standardHours.breakStartTime,
          breakEndTime: hasBreak ? null : standardHours.breakEndTime
        };
      })
    );
  }

  function pickTime(weekday: number, field: TimeField) {
    const day = days.find((entry) => entry.weekday === weekday);
    if (!day || isDayLocked(day)) return;
    const fallback = field === "endTime" ? standardHours.endTime : field === "breakEndTime" ? standardHours.breakEndTime : field === "breakStartTime" ? standardHours.breakStartTime : standardHours.startTime;
    setPicker({ type: "day", weekday, field, value: day[field] ?? fallback });
  }

  function pickStandardTime(field: TimeField) {
    const value = field === "breakStartTime" ? standardHours.breakStartTime : field === "breakEndTime" ? standardHours.breakEndTime : standardHours[field];
    setPicker({ type: "standard", field, value });
  }

  function applyTime(value: string) {
    if (!picker) return;

    if (picker.type === "standard") {
      setStandardHours((current) => normalizeStandardHours({ ...current, [picker.field]: value }));
      setPicker(null);
      return;
    }

    setDays((current) => current.map((day) => (day.weekday === picker.weekday && !isDayLocked(day) ? { ...day, [picker.field]: value } : day)));
    setPicker(null);
  }

  function applyStandardToWeek() {
    setDays((current) =>
      current.map((day) => {
        if (day.date < todayIso || vacationDates.includes(day.date)) return day;
        const isDefaultWorkday = day.weekday <= 5;
        return {
          ...day,
          isWorking: isDefaultWorkday,
          startTime: isDefaultWorkday ? standardHours.startTime : null,
          endTime: isDefaultWorkday ? standardHours.endTime : null,
          breakStartTime: isDefaultWorkday && standardHours.breakEnabled ? standardHours.breakStartTime : null,
          breakEndTime: isDefaultWorkday && standardHours.breakEnabled ? standardHours.breakEndTime : null
        };
      })
    );
    setMessage("Standardzeiten auf die bearbeitbaren Tage angewendet.");
  }

  async function addVacation(range: Omit<VacationRange, "id">) {
    const response = await fetch("/api/staff/vacations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: activeEmployeeId,
        startDate: range.startDate,
        endDate: range.endDate,
        note: range.note || "Urlaub"
      })
    });

    if (response.ok) {
      const data = await response.json();
      setVacations((current) => [...current, data.vacation]);
      setVacationSheetOpen(false);
      setMessage("Urlaub eingetragen. Betroffene Tage sind gesperrt.");
      return;
    }

    setMessage("Urlaub konnte nicht gespeichert werden.");
  }

  async function removeVacation(id: string) {
    const response = await fetch(`/api/staff/vacations?id=${encodeURIComponent(id)}&employeeId=${encodeURIComponent(activeEmployeeId)}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("Urlaub konnte nicht entfernt werden.");
      return;
    }
    setVacations((current) => current.filter((vacation) => vacation.id !== id));
    setMessage("Urlaub entfernt.");
  }

  async function save() {
    setMessage("Speichern...");
    const daysForSave = applyVacationDisplay(days, vacationDates);
    const response = await fetch("/api/staff/working-hours", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: activeEmployeeId, weekStartDate: isoDate(weekStart), days: daysForSave })
    });

    if (!response.ok) {
      setMessage("Bitte Zeiten pruefen: Start vor Ende, Pause innerhalb der Arbeitszeit.");
      return;
    }

    setMessage("Arbeitszeiten gespeichert.");
  }

  return (
    <main className="phone-shell pb-[132px]">
      <AppHeader
        title="Arbeitszeiten"
        chrome={false}
        statusBar={false}
        rightAction={
          <button
            type="button"
            onClick={() => setVacationSheetOpen(true)}
            className="ios-button grid h-10 w-10 place-items-center rounded-full bg-neutral-100 text-neutral-900 ring-1 ring-neutral-200"
            aria-label="Urlaub verwalten"
          >
            <Sun size={21} strokeWidth={1.9} />
          </button>
        }
      />

      <WeekSelector
        weekStart={weekStart}
        onPrev={() => setWeekStart((current) => addWeeks(current, -1))}
        onNext={() => setWeekStart((current) => addWeeks(current, 1))}
      />

      <WeekStrip weekStart={weekStart} selectedDate={selectedDate} limitToSaturday />

      <section className="mx-4 mt-4 space-y-3">
        <div className="rounded-2xl bg-neutral-200/90 p-1 shadow-inner">
          <div className="grid grid-cols-2 gap-1">
            <ModeButton active={mode === "consistent"} label="Gleichbleibend" onClick={() => setMode("consistent")} />
            <ModeButton active={mode === "flexible"} label="Flexibel" onClick={() => setMode("flexible")} />
          </div>
        </div>

        {mode === "consistent" ? (
          <StandardScheduleCard
            standardHours={standardHours}
            onPickTime={pickStandardTime}
            onToggleBreak={() => setStandardHours((current) => ({ ...current, breakEnabled: !current.breakEnabled }))}
            onApply={applyStandardToWeek}
          />
        ) : (
          <FlexibleInfoCard />
        )}

      </section>

      <div className="mx-5 mt-5 flex items-center justify-between">
        <p className="text-[18px] font-bold leading-6">Tagesplan</p>
        <span className="rounded-full bg-white px-3 py-1 text-[12px] font-bold text-neutral-600 shadow-sm ring-1 ring-neutral-200">Mo-Sa</span>
      </div>

      <WorkingHoursList days={displayDays} todayIso={todayIso} vacationDates={vacationDates} onToggleDay={toggleDay} onToggleBreak={toggleBreak} onPickTime={pickTime} />

      {message ? (
        <p className="mx-5 mt-4 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-neutral-700 shadow-sm ring-1 ring-neutral-200/70">
          <CheckCircle2 size={18} className="text-neutral-900" />
          {message}
        </p>
      ) : null}

      <div className="mx-5 mt-4">
        <button type="button" onClick={save} className="ios-button h-14 w-full rounded-2xl bg-neutral-900 text-[16px] font-semibold text-white shadow-[0_12px_24px_rgba(0,0,0,0.18)]">
          Speichern
        </button>
      </div>

      <BottomNav active="working-hours" />

      {picker ? (
        <TimeWheelPicker
          title={picker.type === "standard" ? standardPickerTitle(picker.field) : `${dayPickerTitle(picker.field)} - ${fullDayLabels[picker.weekday - 1]}`}
          value={picker.value}
          onClose={() => setPicker(null)}
          onApply={applyTime}
        />
      ) : null}

      {vacationSheetOpen ? <VacationSheet todayIso={todayIso} vacations={vacations} onClose={() => setVacationSheetOpen(false)} onApply={addVacation} onRemove={removeVacation} /> : null}
    </main>
  );
}

function ModeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ios-button h-11 rounded-xl text-[14px] font-bold ${active ? "bg-white text-neutral-950 shadow-sm ring-1 ring-neutral-200/70" : "text-neutral-600"}`}
    >
      {label}
    </button>
  );
}

function StandardScheduleCard({
  standardHours,
  onPickTime,
  onToggleBreak,
  onApply
}: {
  standardHours: StandardHours;
  onPickTime: (field: TimeField) => void;
  onToggleBreak: () => void;
  onApply: () => void;
}) {
  return (
    <div className="rounded-[24px] bg-white p-3.5 shadow-sm ring-1 ring-neutral-200/80">
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 text-[16px] font-bold leading-5">Standard</h3>
        <button type="button" onClick={onApply} className="ios-button h-9 shrink-0 rounded-full bg-neutral-900 px-3 text-[13px] font-semibold text-white">
          Anwenden
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <ScheduleTile label="Start" value={standardHours.startTime} onClick={() => onPickTime("startTime")} />
        <ScheduleTile label="Ende" value={standardHours.endTime} onClick={() => onPickTime("endTime")} />
      </div>

      <div className="mt-2.5 flex items-center justify-between rounded-2xl bg-neutral-50 px-3 py-2 ring-1 ring-neutral-200">
        <button type="button" onClick={onToggleBreak} className="ios-button flex flex-1 items-center justify-between gap-3 rounded-2xl text-left" aria-label={standardHours.breakEnabled ? "Standardpause deaktivieren" : "Standardpause aktivieren"}>
          <span>
            <span className="block text-[14px] font-bold leading-5 text-neutral-900">Pause</span>
            <span className="block text-[12px] font-semibold leading-4 text-neutral-500">{standardHours.breakEnabled ? `${standardHours.breakStartTime}-${standardHours.breakEndTime}` : "aus"}</span>
          </span>
          <MiniSwitch active={standardHours.breakEnabled} />
        </button>
      </div>

      {standardHours.breakEnabled ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <ScheduleTile label="Pause" value={standardHours.breakStartTime} onClick={() => onPickTime("breakStartTime")} />
          <ScheduleTile label="bis" value={standardHours.breakEndTime} onClick={() => onPickTime("breakEndTime")} />
        </div>
      ) : null}
    </div>
  );
}

function ScheduleTile({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="ios-button rounded-2xl bg-neutral-50 px-3 py-2 text-left ring-1 ring-neutral-200">
      <span className="block text-[11px] font-semibold leading-4 text-neutral-500">{label}</span>
      <span className="block text-[17px] font-bold leading-6 text-neutral-950">{value}</span>
    </button>
  );
}

function MiniSwitch({ active }: { active: boolean }) {
  return (
    <span className={`relative block h-[30px] w-[50px] shrink-0 rounded-full p-0.5 transition-colors ${active ? "bg-neutral-900" : "bg-neutral-200"}`}>
      <span className={`block h-[26px] w-[26px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.22)] transition-transform ${active ? "translate-x-5" : "translate-x-0"}`} />
    </span>
  );
}

function FlexibleInfoCard() {
  return (
    <div className="rounded-[22px] bg-white px-4 py-3 shadow-sm ring-1 ring-neutral-200/80">
      <h3 className="text-[17px] font-bold leading-6">Flexible Woche</h3>
    </div>
  );
}

function VacationSheet({
  todayIso,
  vacations,
  onClose,
  onApply,
  onRemove
}: {
  todayIso: string;
  vacations: VacationRange[];
  onClose: () => void;
  onApply: (range: Omit<VacationRange, "id">) => void | Promise<void>;
  onRemove: (id: string) => void | Promise<void>;
}) {
  const [startDate, setStartDate] = useState(todayIso);
  const [endDate, setEndDate] = useState(todayIso);
  const [note, setNote] = useState("Urlaub");
  const invalid = endDate < startDate || startDate < todayIso;

  function setRange(start: string, days: number) {
    setStartDate(start);
    setEndDate(isoDate(addDays(new Date(`${start}T00:00:00`), days - 1)));
  }

  return (
    <div
      className="fixed inset-0 z-50 mx-auto flex w-[min(100vw,430px)] items-end bottom-sheet-backdrop"
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <div className="w-full rounded-t-[28px] bg-white px-5 pb-5 pt-3 shadow-[0_-18px_42px_rgba(0,0,0,0.18)]" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-neutral-300" />
        <div className="mb-3 flex items-center justify-between">
          <span className="h-10 w-10" />
          <h2 className="text-[17px] font-semibold">Urlaub</h2>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100" aria-label="Schließen">
            <X size={20} />
          </button>
        </div>

        {vacations.length ? (
          <div className="mb-4 max-h-36 divide-y divide-neutral-100 overflow-auto rounded-2xl bg-neutral-50 ring-1 ring-neutral-200">
            {vacations.map((vacation) => (
              <div key={vacation.id} className="flex items-center gap-3 px-3 py-3">
                <CalendarDays size={18} className="shrink-0 text-neutral-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-neutral-950">{formatDateRange(vacation.startDate, vacation.endDate)}</p>
                  <p className="truncate text-[12px] text-neutral-500">{vacation.note || "Urlaub"}</p>
                </div>
                <button type="button" onClick={() => onRemove(vacation.id)} className="ios-button grid h-9 w-9 place-items-center rounded-full text-neutral-500 active:bg-neutral-100" aria-label="Urlaub entfernen">
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => setRange(todayIso, 1)} className="ios-button h-11 rounded-2xl bg-neutral-100 text-[14px] font-semibold">
            Heute
          </button>
          <button type="button" onClick={() => setRange(todayIso, 3)} className="ios-button h-11 rounded-2xl bg-neutral-100 text-[14px] font-semibold">
            3 Tage
          </button>
          <button type="button" onClick={() => setRange(isoDate(addDays(new Date(`${todayIso}T00:00:00`), 7)), 5)} className="ios-button h-11 rounded-2xl bg-neutral-100 text-[14px] font-semibold">
            Nächste Woche
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <label className="rounded-2xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
            <span className="mb-2 block text-[12px] font-semibold text-neutral-500">Von</span>
            <input
              type="date"
              min={todayIso}
              value={startDate}
              onChange={(event) => {
                const value = event.target.value;
                setStartDate(value);
                if (endDate < value) setEndDate(value);
              }}
              className="h-11 w-full rounded-xl border-0 bg-white px-2 text-[15px] font-semibold outline-none shadow-sm ring-1 ring-neutral-200"
            />
          </label>
          <label className="rounded-2xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
            <span className="mb-2 block text-[12px] font-semibold text-neutral-500">Bis</span>
            <input
              type="date"
              min={startDate}
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="h-11 w-full rounded-xl border-0 bg-white px-2 text-[15px] font-semibold outline-none shadow-sm ring-1 ring-neutral-200"
            />
          </label>
        </div>

        <label className="mt-3 block rounded-2xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
          <span className="mb-2 block text-[12px] font-semibold text-neutral-500">Notiz</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="h-11 w-full rounded-xl border-0 bg-white px-3 text-[15px] font-semibold outline-none shadow-sm ring-1 ring-neutral-200"
          />
        </label>

        <button
          type="button"
          disabled={invalid}
          onClick={() => onApply({ startDate, endDate, note })}
          className="ios-button mt-4 h-12 w-full rounded-2xl bg-neutral-900 text-[16px] font-semibold text-white shadow-sm disabled:opacity-50"
        >
          Urlaub speichern
        </button>
      </div>
    </div>
  );
}

function normalizeStandardHours(value: StandardHours): StandardHours {
  if (timeToMinutes(value.endTime) <= timeToMinutes(value.startTime)) {
    return { ...value, endTime: minutesToTime(timeToMinutes(value.startTime) + 60) };
  }
  if (timeToMinutes(value.breakEndTime) <= timeToMinutes(value.breakStartTime)) {
    return { ...value, breakEndTime: minutesToTime(timeToMinutes(value.breakStartTime) + 30) };
  }
  return value;
}

function applyVacationDisplay(days: WorkingHoursDto[], vacationDates: string[]) {
  return days.map((day) =>
    vacationDates.includes(day.date)
      ? {
          ...day,
          isWorking: false,
          startTime: null,
          endTime: null,
          breakStartTime: null,
          breakEndTime: null
        }
      : day
  );
}

function collectVacationDates(vacations: VacationRange[]) {
  const dates = new Set<string>();
  vacations.forEach((vacation) => {
    const start = new Date(`${vacation.startDate}T00:00:00`);
    const end = new Date(`${vacation.endDate}T00:00:00`);
    for (let current = start; current <= end; current = addDays(current, 1)) {
      dates.add(isoDate(current));
    }
  });
  return Array.from(dates);
}

function formatDateRange(startDate: string, endDate: string) {
  if (startDate === endDate) return formatDisplayDate(startDate);
  return `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;
}

function formatDisplayDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}

function standardPickerTitle(field: TimeField) {
  if (field === "startTime") return "Standard Startzeit";
  if (field === "endTime") return "Standard Endzeit";
  if (field === "breakEndTime") return "Standard Pausenende";
  return "Standard Pausenstart";
}

function dayPickerTitle(field: TimeField) {
  if (field === "startTime") return "Startzeit";
  if (field === "endTime") return "Endzeit";
  if (field === "breakEndTime") return "Pausenende";
  return "Pausenstart";
}

function localDefaultDays(weekStart: Date, employeeId: string): WorkingHoursDto[] {
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const isWorking = index < 5;
    return {
      id: `local-${isoDate(date)}`,
      employeeId,
      weekStartDate: isoDate(weekStart),
      date: isoDate(date),
      weekday: index + 1,
      isWorking,
      startTime: isWorking ? businessDefaults.startTime : null,
      endTime: isWorking ? businessDefaults.endTime : null,
      breakStartTime: isWorking ? businessDefaults.breakStartTime : null,
      breakEndTime: isWorking ? businessDefaults.breakEndTime : null
    };
  });
}
