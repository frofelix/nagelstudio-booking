"use client";

import { Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Download, Mail, Scissors, UserRound, UsersRound, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { isoDate } from "@/lib/date";
import type { ServiceDto } from "@/lib/types";

type PublicEmployee = {
  id: string;
  name: string;
};

type PublicSlot = {
  employeeId: string;
  employeeName: string;
  startTime: string;
  endTime: string;
};

type BookingData = {
  settings: { studioName: string };
  services: Array<ServiceDto & { description?: string | null; priceCents?: number | null }>;
  employees: PublicEmployee[];
};

type ConfirmedBooking = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  customerName: string;
  serviceName: string;
  employeeName: string;
};

type AvailabilityDay = {
  date: string;
  available: boolean;
  isSunday: boolean;
  isPast: boolean;
};

export function PublicBookingClient() {
  const todayIso = isoDate(new Date());
  const [data, setData] = useState<BookingData>({ settings: { studioName: "Nagelstudio" }, services: [], employees: [] });
  const [serviceId, setServiceId] = useState("");
  const [employeeId, setEmployeeId] = useState("any");
  const [date, setDate] = useState(todayIso);
  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<PublicSlot | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dateNotice, setDateNotice] = useState("");
  const [confirmed, setConfirmed] = useState<ConfirmedBooking | null>(null);

  const selectedService = data.services.find((service) => service.id === serviceId);
  const visibleSlots = useMemo(() => groupSlotsByStartTime(slots, employeeId === "any"), [slots, employeeId]);

  useEffect(() => {
    fetch("/api/public/booking-data")
      .then((response) => response.json())
      .then((result: BookingData) => {
        setData(result);
        if (result.services[0]) setServiceId(result.services[0].id);
      })
      .catch(() => setError("Buchungsdaten konnten nicht geladen werden."))
      .finally(() => setLoadingData(false));
  }, []);

  useEffect(() => {
    if (!serviceId || !date) {
      setSlots([]);
      setSelectedSlot(null);
      return;
    }

    setSelectedSlot(null);
    setLoadingSlots(true);
    setError("");
    const params = new URLSearchParams({ serviceId, date, employeeId });
    fetch(`/api/public/slots?${params.toString()}`)
      .then((response) => response.json().then((result) => ({ ok: response.ok, result })))
      .then(({ ok, result }) => {
        if (!ok) throw new Error(typeof result.error === "string" ? result.error : "Zeiten konnten nicht geladen werden.");
        setSlots(result.slots ?? []);
        if ((result.slots ?? []).length > 0) setDateNotice("");
      })
      .catch((err) => {
        setSlots([]);
        setError(err instanceof Error ? err.message : "Zeiten konnten nicht geladen werden.");
      })
      .finally(() => setLoadingSlots(false));
  }, [serviceId, date, employeeId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (customerName.trim().length < 3) {
      setError("Bitte trage deinen Namen mit mindestens 3 Zeichen ein.");
      return;
    }
    if (!customerEmail.includes("@")) {
      setError("Bitte trage eine E-Mail-Adresse mit @ ein.");
      return;
    }
    if (!selectedSlot || !selectedService) {
      setError("Bitte wähle eine freie Uhrzeit aus.");
      return;
    }

    setSaving(true);
    setError("");
    const response = await fetch("/api/public/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: selectedSlot.employeeId,
        serviceId,
        customerName,
        customerEmail,
        date,
        startTime: selectedSlot.startTime
      })
    });
    const result = await response.json().catch(() => null);
    setSaving(false);

    if (!response.ok) {
      setError(typeof result?.error === "string" ? result.error : "Termin konnte nicht gebucht werden.");
      return;
    }

    setConfirmed(result.booking);
  }

  if (confirmed) {
    return (
      <main className="min-h-dvh bg-[#f5f5f7] px-4 py-5">
        <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-[430px] items-center">
          <section className="w-full rounded-[30px] bg-white p-6 text-center shadow-sm ring-1 ring-neutral-200">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-neutral-950 text-white">
              <Check size={34} />
            </span>
            <h1 className="mt-5 text-[28px] font-black tracking-tight">Termin gebucht</h1>
            <p className="mt-2 text-[15px] font-semibold leading-6 text-neutral-500">Wir haben deinen Termin eingetragen.</p>
            <div className="mt-5 rounded-3xl bg-neutral-50 p-4 text-left ring-1 ring-neutral-200">
              <p className="text-[17px] font-black">{confirmed.serviceName}</p>
              <p className="mt-1 text-[15px] font-bold text-neutral-600">
                {formatLongDate(confirmed.date)} · {confirmed.startTime}
              </p>
              <p className="mt-1 text-[15px] font-bold text-neutral-600">{confirmed.employeeName}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setConfirmed(null);
                setCustomerName("");
                setCustomerEmail("");
                setSelectedSlot(null);
              }}
              className="ios-button mt-5 h-12 w-full rounded-2xl bg-neutral-950 text-[16px] font-bold text-white"
            >
              Weiteren Termin buchen
            </button>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <a
                href={buildIcsDataUrl(confirmed, data.settings.studioName)}
                download={`${confirmed.serviceName}-${confirmed.date}.ics`}
                className="ios-button flex h-12 items-center justify-center gap-2 rounded-2xl bg-neutral-100 text-[15px] font-black text-neutral-950"
              >
                <Download size={18} />
                Apple Kalender
              </a>
              <a
                href={buildGoogleCalendarUrl(confirmed, data.settings.studioName)}
                target="_blank"
                rel="noreferrer"
                className="ios-button flex h-12 items-center justify-center rounded-2xl bg-neutral-100 text-[15px] font-black text-neutral-950"
              >
                Google Kalender
              </a>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#f5f5f7] px-4 py-4">
      <form onSubmit={submit} className="mx-auto w-full max-w-[430px] pb-5">
        <header className="mb-4">
          <p className="text-[13px] font-black uppercase tracking-[0.14em] text-neutral-500">Online buchen</p>
          <h1 className="mt-1 text-[32px] font-black tracking-tight text-neutral-950">{data.settings.studioName}</h1>
        </header>

        <section className="rounded-[30px] bg-white p-4 shadow-sm ring-1 ring-neutral-200">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-neutral-100 text-neutral-950">
              <Scissors size={18} />
            </span>
            <h2 className="text-[19px] font-black">Service wählen</h2>
          </div>

          <div className="mt-4 grid gap-2">
            {loadingData ? <p className="rounded-2xl bg-neutral-50 px-4 py-5 text-center text-[14px] font-bold text-neutral-500">Services werden geladen...</p> : null}
            {data.services.map((service) => {
              const active = service.id === serviceId;
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => setServiceId(service.id)}
                  className={`ios-button flex min-h-[66px] items-center justify-between gap-3 rounded-2xl px-4 text-left ring-1 ${
                    active ? "bg-neutral-950 text-white ring-neutral-950" : "bg-neutral-50 text-neutral-950 ring-neutral-200"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-black">{service.name}</span>
                    <span className={`mt-1 block text-[13px] font-bold ${active ? "text-white/65" : "text-neutral-500"}`}>
                      {service.durationMinutes} Min.
                    </span>
                  </span>
                  {typeof service.priceCents === "number" ? <span className="shrink-0 text-[14px] font-black">{formatPrice(service.priceCents)}</span> : null}
                </button>
              );
            })}
          </div>
        </section>

        {selectedService ? (
          <>
            <section className="mt-3 rounded-[30px] bg-white p-4 shadow-sm ring-1 ring-neutral-200">
              <button
                type="button"
                onClick={() => setDatePickerOpen(true)}
                className="ios-button flex min-h-[58px] w-full items-center justify-between gap-3 rounded-2xl bg-neutral-50 px-3 text-left ring-1 ring-neutral-200"
              >
                <span>
                  <span className="block text-[12px] font-black uppercase text-neutral-500">Datum</span>
                  <span className="mt-1 block text-[17px] font-black text-neutral-950">{formatFullDate(date)}</span>
                </span>
                <ChevronDown size={19} className="text-neutral-400" />
              </button>
              {dateNotice ? <p className="mt-3 rounded-2xl bg-neutral-100 px-3 py-2 text-[13px] font-bold text-neutral-600">{dateNotice}</p> : null}

              <label className="mt-3 grid min-h-[58px] grid-cols-[34px_1fr_20px] items-center gap-2 rounded-2xl bg-neutral-50 px-3 ring-1 ring-neutral-200">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-neutral-900 ring-1 ring-neutral-200">
                  <UsersRound size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-black uppercase text-neutral-500">Mitarbeiter</span>
                  <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="plain-select mt-1 w-full bg-transparent text-[15px] font-black outline-none">
                    <option value="any">Beliebig</option>
                    {data.employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                </span>
                <ChevronDown size={18} className="text-neutral-400" />
              </label>
            </section>

            <section className="mt-3 rounded-[30px] bg-white p-4 shadow-sm ring-1 ring-neutral-200">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-neutral-100 text-neutral-950">
                    <Clock3 size={18} />
                  </span>
                  <h2 className="text-[19px] font-black">Uhrzeit</h2>
                </div>
                <span className="shrink-0 text-[13px] font-black text-neutral-500">{formatLongDate(date)}</span>
              </div>

              {loadingSlots ? <p className="rounded-2xl bg-neutral-50 px-4 py-6 text-center text-[14px] font-bold text-neutral-500 ring-1 ring-neutral-200">Zeiten werden geladen...</p> : null}
              {!loadingSlots && visibleSlots.length === 0 ? (
                <p className="rounded-2xl bg-neutral-50 px-4 py-6 text-center text-[14px] font-bold text-neutral-500 ring-1 ring-neutral-200">Für diesen Tag ist kein Termin frei.</p>
              ) : null}
              <div className="grid grid-cols-3 gap-2">
                {visibleSlots.map((slot) => {
                  const active = selectedSlot?.employeeId === slot.employeeId && selectedSlot.startTime === slot.startTime;
                  return (
                    <button
                      key={`${slot.employeeId}-${slot.startTime}`}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`ios-button h-13 min-h-[52px] rounded-2xl text-[17px] font-black ring-1 ${
                        active ? "bg-neutral-950 text-white ring-neutral-950" : "bg-neutral-50 text-neutral-950 ring-neutral-200"
                      }`}
                    >
                      {slot.startTime}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-3 rounded-[30px] bg-white p-4 shadow-sm ring-1 ring-neutral-200">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-neutral-100 text-neutral-950">
                  <UserRound size={18} />
                </span>
                <h2 className="text-[19px] font-black">Deine Daten</h2>
              </div>
              <div className="mt-4 space-y-2">
                <InputField icon={<UserRound size={18} />} label="Name">
                  <input required minLength={3} value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Vor- und Nachname" className="w-full bg-transparent text-[15px] font-bold outline-none placeholder:text-neutral-400" />
                </InputField>
                <InputField icon={<Mail size={18} />} label="E-Mail">
                  <input required type="text" inputMode="email" pattern=".*@.*" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} placeholder="name@mail.de" className="w-full bg-transparent text-[15px] font-bold outline-none placeholder:text-neutral-400" />
                </InputField>
              </div>
            </section>

            <div className="sticky bottom-0 z-10 -mx-4 mt-3 bg-gradient-to-t from-[#f5f5f7] via-[#f5f5f7] to-transparent px-4 pb-4 pt-5">
              {error ? <p className="mb-2 rounded-2xl bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700 ring-1 ring-red-100">{error}</p> : null}
              <button
                type="submit"
                disabled={saving || !selectedSlot}
                className="ios-button h-14 w-full rounded-2xl bg-neutral-950 text-[16px] font-black text-white shadow-[0_12px_26px_rgba(0,0,0,0.18)] disabled:bg-neutral-300"
              >
                {saving ? "Buchen..." : selectedSlot ? `Termin um ${selectedSlot.startTime} buchen` : "Uhrzeit auswählen"}
              </button>
            </div>
          </>
        ) : null}
      </form>
      {datePickerOpen && selectedService ? (
        <BookingDatePicker
          date={date}
          serviceId={serviceId}
          employeeId={employeeId}
          todayIso={todayIso}
          onClose={() => setDatePickerOpen(false)}
          onSelect={(value) => {
            setDate(value);
            setDatePickerOpen(false);
          }}
        />
      ) : null}
    </main>
  );
}

function BookingDatePicker({
  date,
  serviceId,
  employeeId,
  todayIso,
  onClose,
  onSelect
}: {
  date: string;
  serviceId: string;
  employeeId: string;
  todayIso: string;
  onClose: () => void;
  onSelect: (date: string) => void;
}) {
  const [monthDate, setMonthDate] = useState(() => {
    const [year, month] = date.split("-").map(Number);
    return new Date(year, month - 1, 1);
  });
  const [availability, setAvailability] = useState<Record<string, AvailabilityDay>>({});
  const [loading, setLoading] = useState(false);
  const monthKey = `${monthDate.getFullYear()}-${`${monthDate.getMonth() + 1}`.padStart(2, "0")}`;
  const gridStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  gridStart.setDate(gridStart.getDate() - ((gridStart.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ serviceId, employeeId, month: monthKey });
    fetch(`/api/public/availability?${params.toString()}`)
      .then((response) => response.json())
      .then((result) => {
        const next: Record<string, AvailabilityDay> = {};
        for (const day of (result.days ?? []) as AvailabilityDay[]) next[day.date] = day;
        setAvailability(next);
      })
      .catch(() => setAvailability({}))
      .finally(() => setLoading(false));
  }, [employeeId, monthKey, serviceId]);

  return (
    <div
      className="fixed inset-0 z-50 mx-auto flex w-[min(100vw,430px)] items-end bottom-sheet-backdrop"
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <div className="w-full rounded-t-[30px] bg-white px-5 pb-5 pt-3 shadow-[0_-18px_42px_rgba(0,0,0,0.18)]" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-neutral-300" />
        <div className="mb-3 flex items-center justify-between gap-2">
          <button type="button" className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100" onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))} aria-label="Vorheriger Monat">
            <ChevronLeft size={20} />
          </button>
          <h2 className="min-w-0 flex-1 text-center text-[17px] font-black">{formatMonthLabel(monthDate)}</h2>
          <div className="flex shrink-0 gap-2">
            <button type="button" className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100" onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))} aria-label="Nächster Monat">
              <ChevronRight size={20} />
            </button>
            <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100" aria-label="Schließen">
              <X size={19} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 text-center text-[12px] font-black text-neutral-400">
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((label) => (
            <span key={label} className="py-2">
              {label}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const value = isoDateLocal(day);
            const inMonth = day.getMonth() === monthDate.getMonth();
            const selected = value === date;
            const info = availability[value];
            const isSunday = day.getDay() === 0;
            const disabled = !inMonth || value < todayIso || isSunday || !info?.available || loading;

            return (
              <button
                key={value}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(value)}
                className={`ios-button grid h-11 place-items-center rounded-full text-[15px] font-black ${
                  selected && !disabled
                    ? "bg-neutral-950 text-white"
                    : disabled
                      ? "bg-neutral-50 text-neutral-300"
                      : "bg-white text-neutral-950 ring-1 ring-neutral-200"
                }`}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function InputField({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="grid min-h-[58px] grid-cols-[34px_1fr] items-center gap-3 rounded-2xl bg-neutral-50 px-3 ring-1 ring-neutral-200">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-neutral-900 ring-1 ring-neutral-200">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[12px] font-black uppercase text-neutral-500">{label}</span>
        <span className="mt-1 block min-w-0">{children}</span>
      </span>
    </label>
  );
}

async function fetchAvailability(serviceId: string, employeeId: string, month: string) {
  const params = new URLSearchParams({ serviceId, employeeId, month });
  const response = await fetch(`/api/public/availability?${params.toString()}`);
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Verfügbarkeit konnte nicht geladen werden.");
  return (result.days ?? []) as AvailabilityDay[];
}

function groupSlotsByStartTime(slots: PublicSlot[], group: boolean) {
  if (!group) return slots;

  const byStart = new Map<string, PublicSlot>();
  for (const slot of slots) {
    if (!byStart.has(slot.startTime)) byStart.set(slot.startTime, slot);
  }
  return Array.from(byStart.values());
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(`${value}T00:00:00`));
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatMonthLabel(value: Date) {
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(value);
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function isoDateLocal(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildIcsDataUrl(booking: ConfirmedBooking, studioName: string) {
  const uid = `${booking.id}@nail-booking.local`;
  const start = toCalendarUtc(booking.date, booking.startTime);
  const end = toCalendarUtc(booking.date, booking.endTime);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nail Booking//DE",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toCalendarUtc(booking.date, booking.startTime)}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcs(`${booking.serviceName} bei ${studioName}`)}`,
    `DESCRIPTION:${escapeIcs(`Termin bei ${booking.employeeName}`)}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

function buildGoogleCalendarUrl(booking: ConfirmedBooking, studioName: string) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${booking.serviceName} bei ${studioName}`,
    dates: `${toCalendarUtc(booking.date, booking.startTime)}/${toCalendarUtc(booking.date, booking.endTime)}`,
    details: `Termin bei ${booking.employeeName}`
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function toCalendarUtc(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}
