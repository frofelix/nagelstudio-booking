"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronRight, Clock3, Mail, SlidersHorizontal, User, UserRound, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AppPickerSheet } from "@/components/AppPickerSheet";
import { TimeWheelPicker } from "@/components/TimeWheelPicker";
import { businessDefaults, DEMO_EMPLOYEE_ID } from "@/lib/constants";
import { isoDate } from "@/lib/date";
import { minutesToTime, timeToMinutes } from "@/lib/time";
import { ServiceDto } from "@/lib/types";

type BookingEmployee = {
  id: string;
  name: string;
};

type BusinessSettings = {
  defaultStartTime: string;
  defaultEndTime: string;
  defaultBreakStartTime: string;
  defaultBreakEndTime: string;
};

const fallbackEmployees: BookingEmployee[] = [
  { id: DEMO_EMPLOYEE_ID, name: "Lisa Müller" },
  { id: "demo-sarah", name: "Sarah Schneider" },
  { id: "demo-anna", name: "Anna Weber" },
  { id: "demo-julia", name: "Julia Wagner" }
];

export function ManualBookingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDate = searchParams.get("date") ?? isoDate(new Date());
  const [services, setServices] = useState<ServiceDto[]>([]);
  const [employees, setEmployees] = useState<BookingEmployee[]>(fallbackEmployees);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(businessDefaults.startTime);
  const [endTime, setEndTime] = useState(minutesToTime(timeToMinutes(businessDefaults.startTime) + 60));
  const [employeeId, setEmployeeId] = useState(DEMO_EMPLOYEE_ID);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState<"service" | "employee" | null>(null);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [timePicker, setTimePicker] = useState<"startTime" | "endTime" | null>(null);
  const todayIso = isoDate(new Date());
  const isPastBookingDate = date < todayIso;
  const selectedEmployeeName = employees.find((employee) => employee.id === employeeId)?.name ?? "Auswählen";

  useEffect(() => {
    fetch("/api/settings")
      .then((response) => {
        if (!response.ok) throw new Error("settings failed");
        return response.json();
      })
      .then((data: { settings?: BusinessSettings }) => {
        const settings = data.settings;
        if (!settings?.defaultStartTime) return;
        const service = services.find((entry) => entry.id === serviceId);
        setStartTime(settings.defaultStartTime);
        setEndTime(minutesToTime(timeToMinutes(settings.defaultStartTime) + (service?.durationMinutes ?? 60)));
      })
      .catch(() => undefined);
  }, [serviceId, services]);

  useEffect(() => {
    fetch("/api/services")
      .then((response) => {
        if (!response.ok) throw new Error("services failed");
        return response.json();
      })
      .then((data) => {
        const loaded = data.services ?? [];
        setServices(loaded);
        if (loaded[0]) {
          setServiceId(loaded[0].id);
          setEndTime(minutesToTime(timeToMinutes(businessDefaults.startTime) + loaded[0].durationMinutes));
        }
      })
      .catch(() => {
        const fallback = [
          { id: "service-gel", name: "Gel Maniküre", durationMinutes: 60 },
          { id: "service-refill-design", name: "Auffüllen + Design", durationMinutes: 90 },
          { id: "service-pedicure", name: "Pediküre", durationMinutes: 60 }
        ];
        setServices(fallback);
        setServiceId(fallback[0].id);
        setEndTime(minutesToTime(timeToMinutes(businessDefaults.startTime) + fallback[0].durationMinutes));
      });
  }, []);

  useEffect(() => {
    fetch("/api/employees")
      .then((response) => {
        if (!response.ok) throw new Error("employees failed");
        return response.json();
      })
      .then((data) => {
        const loaded = data.employees ?? [];
        if (loaded.length) {
          setEmployees(loaded);
          if (!loaded.some((employee: BookingEmployee) => employee.id === DEMO_EMPLOYEE_ID)) setEmployeeId(loaded[0].id);
        }
      })
      .catch(() => setEmployees(fallbackEmployees));
  }, []);

  function handleServiceChange(nextServiceId: string) {
    setServiceId(nextServiceId);
    const service = services.find((entry) => entry.id === nextServiceId);
    if (service) setEndTime(minutesToTime(timeToMinutes(startTime) + service.durationMinutes));
  }

  function handleTimeApply(value: string) {
    if (timePicker === "startTime") {
      setStartTime(value);
      if (timeToMinutes(endTime) <= timeToMinutes(value)) {
        const service = services.find((entry) => entry.id === serviceId);
        setEndTime(minutesToTime(timeToMinutes(value) + (service?.durationMinutes ?? 60)));
      }
    }
    if (timePicker === "endTime") setEndTime(value);
    setTimePicker(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (isPastBookingDate) {
      setError("Vergangene Tage koennen nicht mehr bearbeitet werden. Bitte ein aktuelles oder zukuenftiges Datum waehlen.");
      return;
    }

    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      setError("Die Endzeit muss nach der Startzeit liegen.");
      return;
    }

    setSaving(true);

    const response = await fetch("/api/staff/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId,
        serviceId,
        customerName,
        customerEmail,
        date,
        startTime,
        endTime,
        notes
      })
    });

    if (!response.ok) {
      const data = await response.json();
      setError(typeof data.error === "string" ? data.error : "Termin konnte nicht erstellt werden. Bitte Angaben pruefen.");
      setSaving(false);
      return;
    }

    router.push(`/staff/calendar?date=${date}`);
  }

  return (
    <main className="phone-shell min-h-dvh pb-28">
      <AppHeader title="Termin manuell hinzufügen" back />

      {isPastBookingDate ? (
        <p className="mx-4 mt-4 rounded-2xl bg-neutral-100 px-4 py-3 text-[14px] font-semibold text-neutral-500 ring-1 ring-neutral-200">
          Dieser Tag ist abgelaufen. Du kannst das Datum ändern, aber keinen Termin in der Vergangenheit erstellen.
        </p>
      ) : null}

      <form id="manual-booking-form" onSubmit={submit} className="mx-4 mt-4 overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-neutral-200/80">
        <FormRow icon={<UserRound size={20} />} label="Kundin / Kunde" chevron={false}>
          <input
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            required
            placeholder="Name eingeben"
            className="w-full bg-transparent text-right outline-none placeholder:text-neutral-400"
          />
        </FormRow>

        <FormRow icon={<Mail size={20} />} label="E-Mail" chevron={false}>
          <input
            type="email"
            value={customerEmail}
            onChange={(event) => setCustomerEmail(event.target.value)}
            placeholder="optional"
            className="w-full bg-transparent text-right outline-none placeholder:text-neutral-400"
          />
        </FormRow>

        <FormRow icon={<SlidersHorizontal size={20} />} label="Service" onClick={() => setSheet("service")}>
          <span className="truncate text-neutral-900">{services.find((service) => service.id === serviceId)?.name ?? "Auswählen"}</span>
        </FormRow>

        <FormRow icon={<CalendarDays size={20} />} label="Datum" onClick={() => setDateSheetOpen(true)}>
          <span className="truncate text-neutral-900">{formatDisplayDate(date)}</span>
        </FormRow>

        <FormRow icon={<Clock3 size={20} />} label="Startzeit" onClick={() => setTimePicker("startTime")}>
          <span className="truncate text-neutral-900">{startTime}</span>
        </FormRow>

        <FormRow icon={<Clock3 size={20} />} label="Endzeit" onClick={() => setTimePicker("endTime")}>
          <span className="truncate text-neutral-900">{endTime}</span>
        </FormRow>

        <FormRow icon={<User size={20} />} label="Mitarbeiter" onClick={() => setSheet("employee")}>
          <span className="truncate text-neutral-900">{selectedEmployeeName}</span>
        </FormRow>

        <div className="border-t border-neutral-100 p-4">
          <label className="mb-2 block text-[15px] font-bold">Notiz</label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Notiz hinzufügen"
            rows={5}
            className="h-[148px] w-full resize-none rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-[15px] font-medium outline-none placeholder:text-neutral-400 focus:border-neutral-400"
          />
        </div>
      </form>

      {error ? <p className="mx-5 mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-[min(100vw,430px)] bg-gradient-to-t from-[#f7f7f8] via-[#f7f7f8] to-transparent px-5 pb-5 pt-10">
        <button
          type="submit"
          form="manual-booking-form"
          disabled={saving || isPastBookingDate}
          className="ios-button h-14 w-full rounded-2xl bg-neutral-900 text-[17px] font-semibold text-white shadow-[0_12px_24px_rgba(0,0,0,0.18)] disabled:opacity-60"
        >
          {saving ? "Erstellen..." : isPastBookingDate ? "Nicht bearbeitbar" : "Termin erstellen"}
        </button>
      </div>
      {sheet === "service" ? (
        <AppPickerSheet
          title="Service auswählen"
          options={services.map((service) => ({ value: service.id, label: service.name }))}
          value={serviceId}
          onClose={() => setSheet(null)}
          onSelect={(value) => {
            handleServiceChange(value);
            setSheet(null);
          }}
        />
      ) : null}
      {sheet === "employee" ? (
        <AppPickerSheet
          title="Mitarbeiter auswählen"
          options={employees.map((employee) => ({ value: employee.id, label: employee.name }))}
          value={employeeId}
          onClose={() => setSheet(null)}
          onSelect={(value) => {
            setEmployeeId(value);
            setSheet(null);
          }}
        />
      ) : null}
      {dateSheetOpen ? (
        <DateSelectionSheet
          value={date}
          minDate={todayIso}
          onClose={() => setDateSheetOpen(false)}
          onApply={(value) => {
            setDate(value);
            setDateSheetOpen(false);
          }}
        />
      ) : null}
      {timePicker ? (
        <TimeWheelPicker
          title={timePicker === "startTime" ? "Startzeit" : "Endzeit"}
          value={timePicker === "startTime" ? startTime : endTime}
          onClose={() => setTimePicker(null)}
          onApply={handleTimeApply}
        />
      ) : null}
    </main>
  );
}

function formatDisplayDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function DateSelectionSheet({
  value,
  minDate,
  onClose,
  onApply
}: {
  value: string;
  minDate: string;
  onClose: () => void;
  onApply: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value < minDate ? minDate : value);
  const today = new Date(`${minDate}T00:00:00`);
  const quickDates = [
    { label: "Heute", value: minDate },
    { label: "Morgen", value: isoDate(addDays(today, 1)) },
    { label: "In 1 Woche", value: isoDate(addDays(today, 7)) }
  ];

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
          <h2 className="text-[17px] font-semibold">Datum auswählen</h2>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100" aria-label="Schließen">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {quickDates.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => setDraft(option.value)}
              className={`ios-button h-11 rounded-2xl text-[14px] font-semibold ${
                draft === option.value ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-800"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="mt-4 block rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
          <span className="mb-2 block text-[13px] font-semibold text-neutral-500">Datum</span>
          <input
            type="date"
            min={minDate}
            value={draft}
            onChange={(event) => setDraft(event.target.value < minDate ? minDate : event.target.value)}
            className="h-12 w-full rounded-xl border-0 bg-white px-3 text-[18px] font-semibold outline-none shadow-sm ring-1 ring-neutral-200"
          />
        </label>

        <button type="button" onClick={() => onApply(draft < minDate ? minDate : draft)} className="ios-button mt-4 h-12 w-full rounded-2xl bg-neutral-900 text-[16px] font-semibold text-white shadow-sm">
          Übernehmen
        </button>
      </div>
    </div>
  );
}

function FormRow({
  icon,
  label,
  chevron = true,
  onClick,
  children
}: {
  icon: React.ReactNode;
  label: string;
  chevron?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const content = (
    <>
      <span className="grid h-9 w-9 place-items-center rounded-full bg-neutral-100 text-neutral-900">{icon}</span>
      <span className="text-[15px] font-bold">{label}</span>
      <div className="min-w-0 text-right text-[15px] font-semibold text-neutral-600">{children}</div>
      {chevron ? <ChevronRight size={19} className="text-neutral-400" /> : <span />}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="ios-button grid min-h-[64px] w-full grid-cols-[36px_1fr_1.15fr_18px] items-center gap-3 border-b border-neutral-100 px-4 text-left active:bg-neutral-50">
        {content}
      </button>
    );
  }

  return (
    <div className="grid min-h-[64px] grid-cols-[36px_1fr_1.15fr_18px] items-center gap-3 border-b border-neutral-100 px-4">
      {content}
    </div>
  );
}
