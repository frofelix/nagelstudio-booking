"use client";

import Link from "next/link";
import { addDays } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, HeartPulse, Lock, Mail, MessageCircle, Plus, Scissors, Send, User, UserRound, UsersRound, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AppPickerSheet } from "@/components/AppPickerSheet";
import { BottomNav } from "@/components/BottomNav";
import { DayCalendar } from "@/components/DayCalendar";
import { TimeWheelPicker } from "@/components/TimeWheelPicker";
import { WeekStrip } from "@/components/WeekStrip";
import { DEMO_EMPLOYEE_ID } from "@/lib/constants";
import { formatLongDate, formatMonth, getDefaultCalendarDate, getWeekStart, isoDate, sameDate } from "@/lib/date";
import { minutesToTime, timeToMinutes } from "@/lib/time";
import { BookingDto, ServiceDto } from "@/lib/types";

type CalendarEmployee = {
  id: string;
  name: string;
};

type CalendarRole = "owner" | "admin" | "staff";

type StaffChatMessage = {
  id: string;
  bookingId: string | null;
  fromEmployeeId: string | null;
  fromName: string;
  type: "message" | "transfer_request" | "transfer_accepted" | "sick_notice" | "cancel_required";
  message: string;
  status: "open" | "accepted" | "info";
  createdAt: string;
  canAccept?: boolean;
  canCancel?: boolean;
  acceptBlockedReason?: string;
  booking?: {
    customerName: string;
    date: string;
    startTime: string;
    endTime: string;
    serviceName: string;
    employeeName: string;
  };
};

type TransferAvailability = {
  bookingId: string;
  loading: boolean;
  availableCount: number;
};

export function CalendarClient({ employeeId = DEMO_EMPLOYEE_ID, role = "staff", initialDate }: { employeeId?: string | null; role?: CalendarRole; initialDate?: string }) {
  const ownEmployeeId = employeeId ?? DEMO_EMPLOYEE_ID;
  const isAdminView = role === "owner" || role === "admin";
  const [employees, setEmployees] = useState<CalendarEmployee[]>([]);
  const [services, setServices] = useState<ServiceDto[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(isAdminView ? "all" : ownEmployeeId);
  const [selectedDate, setSelectedDate] = useState(() => new Date(`${initialDate ?? isoDate(getDefaultCalendarDate())}T00:00:00`));
  const [bookings, setBookings] = useState<BookingDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingDto | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [sickOpen, setSickOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<StaffChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [transferAvailability, setTransferAvailability] = useState<TransferAvailability | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const weekStart = useMemo(() => getWeekStart(selectedDate), [selectedDate]);
  const todayIso = useMemo(() => isoDate(new Date()), []);
  const selectedIso = isoDate(selectedDate);
  const isPastSelected = selectedIso < todayIso;
  const selectedEmployeeName = selectedEmployeeId === "all" ? "Alle Mitarbeiter" : employees.find((employee) => employee.id === selectedEmployeeId)?.name ?? "Mitarbeiter";
  const sickEmployeeId = selectedEmployeeId === "all" ? ownEmployeeId : selectedEmployeeId;
  const sickEmployeeName = employees.find((employee) => employee.id === sickEmployeeId)?.name ?? selectedEmployeeName;
  const hasChatNotification = !chatOpen && chatMessages.length > 0;
  const employeePickerOptions = [
    ...(isAdminView ? [{ value: "all", label: "Alle Mitarbeiter" }] : []),
    ...employees.map((employee) => ({ value: employee.id, label: employee.name }))
  ];

  useEffect(() => {
    fetch("/api/employees")
      .then((response) => {
        if (!response.ok) throw new Error("employees failed");
        return response.json();
      })
      .then((data) => {
        const loaded = (data.employees ?? []) as CalendarEmployee[];
        setEmployees(loaded);
        if (!isAdminView && !loaded.some((employee) => employee.id === selectedEmployeeId)) {
          setSelectedEmployeeId(ownEmployeeId);
        }
      })
      .catch(() => setEmployees([{ id: ownEmployeeId, name: "Mitarbeiter" }]));
  }, [isAdminView, ownEmployeeId, selectedEmployeeId]);

  useEffect(() => {
    fetch("/api/services")
      .then((response) => {
        if (!response.ok) throw new Error("services failed");
        return response.json();
      })
      .then((data) => setServices((data.services ?? []) as ServiceDto[]))
      .catch(() => setServices([]));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);

    fetch(`/api/staff/bookings?employeeId=${selectedEmployeeId}&from=${isoDate(selectedDate)}&to=${isoDate(selectedDate)}`)
      .then((response) => {
        if (!response.ok) throw new Error("bookings failed");
        return response.json();
      })
      .then((data) => {
        if (active) {
          const loaded = data.bookings ?? [];
          setBookings(loaded.length ? loaded : selectedEmployeeId === DEMO_EMPLOYEE_ID ? demoBookingsFor(selectedDate) : []);
        }
      })
      .catch(() => {
        if (active) setBookings(selectedEmployeeId === DEMO_EMPLOYEE_ID ? demoBookingsFor(selectedDate) : []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedEmployeeId, selectedDate]);

  useEffect(() => {
    if (chatOpen) loadChat();
  }, [chatOpen]);

  useEffect(() => {
    loadChat({ quiet: true });
    const interval = window.setInterval(() => loadChat({ quiet: true }), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedBooking) {
      setTransferAvailability(null);
      return;
    }

    let active = true;
    setTransferAvailability({ bookingId: selectedBooking.id, loading: true, availableCount: 0 });
    fetch(`/api/staff/transfer-requests?bookingId=${encodeURIComponent(selectedBooking.id)}`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        if (active) setTransferAvailability({ bookingId: selectedBooking.id, loading: false, availableCount: data.availableCount ?? 0 });
      })
      .catch(() => {
        if (active) setTransferAvailability({ bookingId: selectedBooking.id, loading: false, availableCount: 0 });
      });

    return () => {
      active = false;
    };
  }, [selectedBooking]);

  async function reloadBookings() {
    setLoading(true);
    try {
      const response = await fetch(`/api/staff/bookings?employeeId=${selectedEmployeeId}&from=${selectedIso}&to=${selectedIso}`);
      if (!response.ok) throw new Error("bookings failed");
      const data = await response.json();
      const loaded = data.bookings ?? [];
      setBookings(loaded.length ? loaded : selectedEmployeeId === DEMO_EMPLOYEE_ID ? demoBookingsFor(selectedDate) : []);
    } catch {
      setBookings(selectedEmployeeId === DEMO_EMPLOYEE_ID ? demoBookingsFor(selectedDate) : []);
    } finally {
      setLoading(false);
    }
  }

  async function loadChat(options: { quiet?: boolean } = {}) {
    if (!options.quiet) setChatLoading(true);
    const response = await fetch("/api/staff/chat");
    const result = await response.json().catch(() => null);
    if (!options.quiet) setChatLoading(false);
    if (response.ok) setChatMessages((result?.messages ?? []) as StaffChatMessage[]);
  }

  async function sendChatMessage() {
    const message = chatDraft.trim();
    if (!message) return;
    setChatDraft("");
    const response = await fetch("/api/staff/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });
    if (response.ok) loadChat();
  }

  async function acceptTransferRequest(id: string) {
    setStatusSaving(true);
    const response = await fetch("/api/staff/transfer-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    const result = await response.json().catch(() => null);
    setStatusSaving(false);
    if (!response.ok) {
      setStatusMessage(typeof result?.error === "string" ? result.error : "Termin konnte nicht übernommen werden.");
      return;
    }
    setStatusMessage("Termin wurde übernommen.");
    await loadChat();
    await reloadBookings();
  }

  async function cancelChatBooking(id: string) {
    setStatusSaving(true);
    const response = await fetch("/api/staff/chat-cancellations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    const result = await response.json().catch(() => null);
    setStatusSaving(false);
    if (!response.ok) {
      setStatusMessage(typeof result?.error === "string" ? result.error : "Termin konnte nicht abgesagt werden.");
      return;
    }
    setStatusMessage("Termin wurde abgesagt.");
    await loadChat();
    await reloadBookings();
  }

  async function reportSick(note: string) {
    setStatusSaving(true);
    const response = await fetch("/api/staff/sick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: sickEmployeeId, date: selectedIso, note })
    });
    const result = await response.json().catch(() => null);
    setStatusSaving(false);
    if (!response.ok) {
      setStatusMessage(typeof result?.error === "string" ? result.error : "Krankmeldung konnte nicht gespeichert werden.");
      return;
    }
    setSickOpen(false);
    setStatusMessage(`${result.requestedCount ?? 0} Übernahmen, ${result.cancellationRequiredCount ?? 0} Absagen im Chat.`);
    await loadChat();
    await reloadBookings();
  }

  return (
    <main className="phone-shell pb-28">
      <AppHeader title="Kalender" chrome={false} statusBar={false} accountShortcut />

      <section className="px-5 pt-2">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            aria-label="Datum auswählen"
            className="ios-button flex min-w-0 items-center gap-1 rounded-2xl px-1 text-left text-[28px] font-black tracking-tight"
            onClick={() => setPickerOpen(true)}
          >
            {formatMonth(selectedDate)} <span className="text-[18px] text-neutral-500">⌄</span>
          </button>
          <button type="button" onClick={() => setSelectedDate(getDefaultCalendarDate())} className="ios-button h-12 rounded-full bg-white px-5 text-[15px] font-bold text-neutral-900 shadow-sm ring-1 ring-neutral-200">
            Heute
          </button>
        </div>
      </section>

      <WeekStrip
        weekStart={weekStart}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onPreviousWeek={() => setSelectedDate((current) => addDays(current, -7))}
        onNextWeek={() => setSelectedDate((current) => addDays(current, 7))}
      />

      <section className="px-5 pt-2">
        <button
          type="button"
          onClick={() => setEmployeePickerOpen(true)}
          className="ios-button flex h-11 w-full items-center gap-2 rounded-full bg-white px-3 text-left shadow-sm ring-1 ring-neutral-200/80"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-700">
            <UsersRound size={17} />
          </span>
          <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-neutral-950">{selectedEmployeeName}</span>
          <ChevronRight size={17} className="shrink-0 rotate-90 text-neutral-400" />
        </button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isPastSelected || statusSaving}
            onClick={() => setSickOpen(true)}
            className="ios-button flex h-11 items-center justify-center gap-2 rounded-full bg-white text-[14px] font-bold text-neutral-900 shadow-sm ring-1 ring-neutral-200/80 disabled:opacity-45"
          >
            <HeartPulse size={17} />
            Krank
          </button>
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="ios-button relative flex h-11 items-center justify-center gap-2 rounded-full bg-white text-[14px] font-bold text-neutral-900 shadow-sm ring-1 ring-neutral-200/80"
          >
            <MessageCircle size={17} />
            Chat
            {hasChatNotification ? (
              <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-red-500 px-1 text-[12px] font-black leading-none text-white shadow-[0_4px_10px_rgba(239,68,68,0.35)] ring-2 ring-white">
                1
              </span>
            ) : null}
          </button>
        </div>
      </section>

      {statusMessage ? (
        <p className="mx-5 mt-4 rounded-2xl bg-white px-4 py-3 text-[13px] font-semibold text-neutral-700 shadow-sm ring-1 ring-neutral-200">
          {statusMessage}
        </p>
      ) : null}

      <DayCalendar bookings={bookings} loading={loading} isPastDay={isPastSelected} selectedDate={selectedDate} showEmployeeNames={selectedEmployeeId === "all"} onSelectBooking={setSelectedBooking} />

      <div className="fixed bottom-[104px] left-1/2 z-20 w-[min(100vw,430px)] -translate-x-1/2 px-6">
        <div className="flex items-end justify-end">
          {isPastSelected ? (
            <button
              type="button"
              disabled
              aria-label="Vergangener Tag kann nicht bearbeitet werden"
              className="grid h-[64px] w-[64px] shrink-0 place-items-center rounded-full bg-neutral-300 text-white shadow-[0_12px_28px_rgba(0,0,0,0.12)]"
            >
              <Lock size={29} strokeWidth={1.8} />
            </button>
          ) : (
            <Link
              href={`/staff/bookings/new?date=${selectedIso}`}
              aria-label="Termin manuell erstellen"
              className="ios-button grid h-[64px] w-[64px] shrink-0 place-items-center rounded-full bg-neutral-900 text-white shadow-[0_16px_34px_rgba(0,0,0,0.22)] active:scale-95"
            >
              <Plus size={40} strokeWidth={1.6} />
            </Link>
          )}
        </div>
      </div>

      <BottomNav active="calendar" />
      {pickerOpen ? (
        <DatePickerOverlay
          selectedDate={selectedDate}
          onClose={() => setPickerOpen(false)}
          onSelect={(date) => {
            setSelectedDate(date);
            setPickerOpen(false);
          }}
        />
      ) : null}
      {employeePickerOpen ? (
        <AppPickerSheet
          title="Kalender auswählen"
          options={employeePickerOptions}
          value={selectedEmployeeId}
          onClose={() => setEmployeePickerOpen(false)}
          onSelect={(value) => {
            setSelectedEmployeeId(value);
            setEmployeePickerOpen(false);
          }}
        />
      ) : null}
      {sickOpen ? <SickSheet employeeName={sickEmployeeName} date={selectedDate} saving={statusSaving} onClose={() => setSickOpen(false)} onApply={reportSick} /> : null}
      {chatOpen ? (
        <ChatSheet
          messages={chatMessages}
          draft={chatDraft}
          loading={chatLoading}
          saving={statusSaving}
          onDraftChange={setChatDraft}
          onClose={() => setChatOpen(false)}
          onSend={sendChatMessage}
          onAccept={acceptTransferRequest}
          onCancelRequired={cancelChatBooking}
        />
      ) : null}
      {selectedBooking ? (
        <BookingActionSheet
          booking={selectedBooking}
          employees={employees}
          services={services}
          saving={statusSaving}
          canRequestTransfer={transferAvailability?.bookingId === selectedBooking.id && !transferAvailability.loading && transferAvailability.availableCount > 0}
          transferAvailabilityLoading={transferAvailability?.bookingId === selectedBooking.id && transferAvailability.loading}
          onClose={() => setSelectedBooking(null)}
          onSave={async (payload) => {
            setStatusSaving(true);
            setStatusMessage("");
            const response = await fetch("/api/staff/bookings", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: selectedBooking.id, ...payload })
            });
            const result = await response.json().catch(() => null);
            setStatusSaving(false);

            if (!response.ok) {
              setStatusMessage(typeof result?.error === "string" ? result.error : "Termin konnte nicht gespeichert werden.");
              return;
            }

            const updated = result.booking as BookingDto;
            const stillVisibleByEmployee = selectedEmployeeId === "all" || updated.employeeId === selectedEmployeeId;
            const stillVisibleByDate = updated.date === selectedIso;

            setBookings((current) => {
              if (!stillVisibleByEmployee || !stillVisibleByDate) {
                return current.filter((booking) => booking.id !== updated.id);
              }
              return current.map((booking) => (booking.id === updated.id ? updated : booking));
            });

            setStatusMessage("Termin wurde gespeichert.");
            setSelectedBooking(null);
          }}
          onStatusChange={async ({ status, cancellationWindow }) => {
            setStatusSaving(true);
            setStatusMessage("");
            const response = await fetch("/api/staff/bookings", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: selectedBooking.id, status, cancellationWindow })
            });
            const result = await response.json().catch(() => null);
            setStatusSaving(false);

            if (!response.ok) {
              setStatusMessage(typeof result?.error === "string" ? result.error : "Termin konnte nicht aktualisiert werden.");
              return;
            }

            if (status === "cancelled") {
              setBookings((current) => current.filter((booking) => booking.id !== selectedBooking.id));
            } else {
              setBookings((current) => current.map((booking) => (booking.id === selectedBooking.id ? { ...booking, status: result.booking.status, notes: result.booking.notes } : booking)));
            }

            setStatusMessage(cancellationWindow === "studio_cancelled" ? "Termin wurde abgesagt." : result.fee?.applies ? "20 EUR markiert." : "Ohne Pauschale markiert.");
            setSelectedBooking(null);
          }}
          onTransferRequest={async () => {
            setStatusSaving(true);
            const response = await fetch("/api/staff/transfer-requests", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ bookingId: selectedBooking.id })
            });
            const result = await response.json().catch(() => null);
            setStatusSaving(false);
            if (!response.ok) {
              setStatusMessage(typeof result?.error === "string" ? result.error : "Anfrage konnte nicht erstellt werden.");
              return;
            }
            setStatusMessage("Übernahme wurde im Chat angefragt.");
            setSelectedBooking(null);
            await loadChat();
          }}
        />
      ) : null}
    </main>
  );
}

function BookingActionSheet({
  booking,
  employees,
  services,
  saving,
  canRequestTransfer,
  transferAvailabilityLoading,
  onClose,
  onSave,
  onStatusChange,
  onTransferRequest
}: {
  booking: BookingDto;
  employees: CalendarEmployee[];
  services: ServiceDto[];
  saving: boolean;
  canRequestTransfer: boolean;
  transferAvailabilityLoading: boolean;
  onClose: () => void;
  onSave: (payload: {
    employeeId: string;
    serviceId: string;
    customerName: string;
    customerEmail: string | null;
    customerPhone: string | null;
    date: string;
    startTime: string;
    endTime: string;
    notes: string | null;
  }) => Promise<void>;
  onStatusChange: (action: { status: "cancelled" | "no_show"; cancellationWindow?: "under_24h" | "over_24h" | "studio_cancelled" }) => void;
  onTransferRequest: () => void;
}) {
  const [form, setForm] = useState({
    customerName: booking.customerName,
    customerEmail: booking.customerEmail ?? "",
    customerPhone: booking.customerPhone ?? "",
    serviceId: booking.service.id,
    employeeId: booking.employeeId,
    date: typeof booking.date === "string" ? booking.date.slice(0, 10) : isoDate(new Date(booking.date)),
    startTime: booking.startTime,
    endTime: booking.endTime,
    notes: booking.notes ?? ""
  });
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePicker, setTimePicker] = useState<"start" | "end" | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const serviceOptions = services.length ? services : [booking.service];
  const employeeOptions = employees.length ? employees : [booking.employee];
  const selectedService = serviceOptions.find((service) => service.id === form.serviceId) ?? booking.service;
  const selectedEmployee = employeeOptions.find((employee) => employee.id === form.employeeId) ?? booking.employee;
  const selectedDate = new Date(`${form.date}T00:00:00`);
  const canSave = form.customerName.trim().length >= 2 && timeToMinutes(form.startTime) < timeToMinutes(form.endTime);

  function updateService(serviceId: string) {
    const service = serviceOptions.find((option) => option.id === serviceId);
    setForm((current) => ({
      ...current,
      serviceId,
      endTime: service ? minutesToTime(timeToMinutes(current.startTime) + service.durationMinutes) : current.endTime
    }));
    setServicePickerOpen(false);
  }

  function updateStartTime(startTime: string) {
    const fallbackEnd = minutesToTime(timeToMinutes(startTime) + selectedService.durationMinutes);
    setForm((current) => ({
      ...current,
      startTime,
      endTime: timeToMinutes(current.endTime) <= timeToMinutes(startTime) ? fallbackEnd : current.endTime
    }));
    setTimePicker(null);
  }

  async function handleSave() {
    if (!canSave || saving) return;
    await onSave({
      employeeId: form.employeeId,
      serviceId: form.serviceId,
      customerName: form.customerName.trim(),
      customerEmail: form.customerEmail.trim() || null,
      customerPhone: form.customerPhone.trim() || null,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      notes: form.notes.trim() || null
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 mx-auto flex w-[min(100vw,430px)] items-end bottom-sheet-backdrop"
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-[30px] bg-white px-5 pb-5 pt-3 shadow-[0_-18px_42px_rgba(0,0,0,0.18)]" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-neutral-300" />
        <div className="mb-4 flex items-center justify-between">
          <span className="h-10 w-10" />
          <h2 className="text-[17px] font-bold">Termin bearbeiten</h2>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100" aria-label="Schließen">
            <X size={20} />
          </button>
        </div>

        <button
          type="button"
          disabled={saving || transferAvailabilityLoading || !canRequestTransfer}
          onClick={onTransferRequest}
          className={`ios-button mb-2 flex h-14 w-full items-center gap-3 rounded-3xl px-4 text-left shadow-sm ${
            canRequestTransfer ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-400"
          } disabled:shadow-none`}
        >
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${canRequestTransfer ? "bg-white/12" : "bg-white/80"}`}>
            <MessageCircle size={20} />
          </span>
          <span className="min-w-0 flex-1 truncate text-[16px] font-bold leading-5">
            {transferAvailabilityLoading ? "Verfügbarkeit prüfen..." : "Übernahme anfragen"}
          </span>
          <ChevronRight size={18} className={`shrink-0 ${canRequestTransfer ? "text-white/60" : "text-neutral-300"}`} />
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={() => setCancelConfirmOpen(true)}
          className="ios-button mb-3 flex h-12 w-full items-center justify-center rounded-3xl bg-neutral-100 px-4 text-[15px] font-bold text-neutral-900 disabled:opacity-60"
        >
          Termin absagen
        </button>

        <div className="space-y-3">
          <div className="rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
            <label className="block text-[12px] font-bold uppercase text-neutral-500">Kundin / Kunde</label>
            <div className="mt-2 flex items-center gap-3">
              <UserRound size={20} className="shrink-0 text-neutral-500" />
              <input
                value={form.customerName}
                onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))}
                className="h-11 min-w-0 flex-1 rounded-2xl bg-white px-3 text-[17px] font-bold text-neutral-950 outline-none ring-1 ring-neutral-200 focus:ring-neutral-400"
                placeholder="Name eintragen"
              />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 ring-1 ring-neutral-200">
                <Mail size={16} className="text-neutral-500" />
                <input
                  value={form.customerEmail}
                  onChange={(event) => setForm((current) => ({ ...current, customerEmail: event.target.value }))}
                  className="h-8 min-w-0 flex-1 bg-transparent text-[14px] font-semibold outline-none placeholder:text-neutral-400"
                  placeholder="E-Mail optional"
                  inputMode="email"
                />
              </div>
              <input
                value={form.customerPhone}
                onChange={(event) => setForm((current) => ({ ...current, customerPhone: event.target.value }))}
                className="h-11 rounded-2xl bg-white px-3 text-[14px] font-semibold outline-none ring-1 ring-neutral-200 placeholder:text-neutral-400 focus:ring-neutral-400"
                placeholder="Telefon optional"
                inputMode="tel"
              />
            </div>
          </div>

          <div className="rounded-3xl bg-white ring-1 ring-neutral-200">
            <FormRow icon={<Scissors size={20} />} label="Service" value={`${selectedService.name} · ${selectedService.durationMinutes} Min.`} onClick={() => setServicePickerOpen(true)} />
            <FormRow icon={<CalendarDays size={20} />} label="Datum" value={formatLongDate(selectedDate)} onClick={() => setDatePickerOpen(true)} />
            <FormRow icon={<Clock3 size={20} />} label="Startzeit" value={form.startTime} onClick={() => setTimePicker("start")} />
            <FormRow icon={<Clock3 size={20} />} label="Endzeit" value={form.endTime} onClick={() => setTimePicker("end")} />
            <FormRow icon={<User size={20} />} label="Mitarbeiter" value={selectedEmployee.name} onClick={() => setEmployeePickerOpen(true)} last />
          </div>

          <label className="block rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
            <span className="block text-[14px] font-bold text-neutral-900">Notiz</span>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              rows={3}
              className="mt-2 w-full resize-none rounded-2xl bg-white px-3 py-3 text-[15px] font-medium outline-none ring-1 ring-neutral-200 placeholder:text-neutral-400 focus:ring-neutral-400"
              placeholder="Notiz hinzufügen"
            />
          </label>

          <button
            type="button"
            disabled={!canSave || saving}
            onClick={handleSave}
            className="ios-button h-[52px] w-full rounded-2xl bg-neutral-900 text-[16px] font-bold text-white shadow-sm disabled:bg-neutral-300"
          >
            {saving ? "Speichern..." : "Termin speichern"}
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => onStatusChange({ status: "cancelled", cancellationWindow: "under_24h" })}
            className="ios-button flex h-14 w-full items-center justify-between rounded-2xl bg-neutral-900 px-4 text-left text-white disabled:opacity-60"
          >
            <span className="text-[16px] font-bold">Absage unter 24h</span>
            <span className="text-[15px] font-black">20 EUR</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => onStatusChange({ status: "cancelled", cancellationWindow: "over_24h" })}
            className="ios-button flex h-14 w-full items-center rounded-2xl bg-neutral-100 px-4 text-left text-neutral-900 disabled:opacity-60"
          >
            <span className="text-[16px] font-bold">Absage über 24h</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => onStatusChange({ status: "no_show" })}
            className="ios-button flex h-14 w-full items-center justify-between rounded-2xl bg-red-50 px-4 text-left text-red-900 ring-1 ring-red-100 disabled:opacity-60"
          >
            <span className="text-[16px] font-bold">Nicht erschienen</span>
            <span className="text-[15px] font-black">20 EUR</span>
          </button>
        </div>

        <button type="button" onClick={onClose} className="ios-button mt-3 h-11 w-full rounded-2xl text-[15px] font-bold text-neutral-500">
          Schließen
        </button>
      </div>

      {servicePickerOpen ? (
        <AppPickerSheet
          title="Service auswählen"
          options={serviceOptions.map((service) => ({ value: service.id, label: service.name }))}
          value={form.serviceId}
          onClose={() => setServicePickerOpen(false)}
          onSelect={updateService}
        />
      ) : null}
      {employeePickerOpen ? (
        <AppPickerSheet
          title="Mitarbeiter auswählen"
          options={employeeOptions.map((employee) => ({ value: employee.id, label: employee.name }))}
          value={form.employeeId}
          onClose={() => setEmployeePickerOpen(false)}
          onSelect={(employeeId) => {
            setForm((current) => ({ ...current, employeeId }));
            setEmployeePickerOpen(false);
          }}
        />
      ) : null}
      {datePickerOpen ? (
        <DatePickerOverlay
          selectedDate={selectedDate}
          onClose={() => setDatePickerOpen(false)}
          onSelect={(date) => {
            setForm((current) => ({ ...current, date: isoDate(date) }));
            setDatePickerOpen(false);
          }}
        />
      ) : null}
      {cancelConfirmOpen ? (
        <CancelConfirmSheet
          saving={saving}
          onClose={() => setCancelConfirmOpen(false)}
          onConfirm={() => onStatusChange({ status: "cancelled", cancellationWindow: "studio_cancelled" })}
        />
      ) : null}
      {timePicker ? (
        <TimeWheelPicker
          title={timePicker === "start" ? "Startzeit auswählen" : "Endzeit auswählen"}
          value={timePicker === "start" ? form.startTime : form.endTime}
          onClose={() => setTimePicker(null)}
          onApply={(value) => {
            if (timePicker === "start") {
              updateStartTime(value);
            } else {
              setForm((current) => ({ ...current, endTime: value }));
              setTimePicker(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function SickSheet({
  employeeName,
  date,
  saving,
  onClose,
  onApply
}: {
  employeeName: string;
  date: Date;
  saving: boolean;
  onClose: () => void;
  onApply: (note: string) => void;
}) {
  const [note, setNote] = useState("Krank");

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
        <div className="mb-4 flex items-center justify-between">
          <span className="h-10 w-10" />
          <h2 className="text-[17px] font-bold">Krank melden</h2>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100" aria-label="Schließen">
            <X size={20} />
          </button>
        </div>

        <div className="rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-neutral-900 ring-1 ring-neutral-200">
              <HeartPulse size={23} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[17px] font-bold text-neutral-950">{employeeName}</p>
              <p className="text-[14px] font-semibold text-neutral-500">{formatLongDate(date)}</p>
            </div>
          </div>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="mt-4 h-12 w-full rounded-2xl bg-white px-3 text-[16px] font-bold outline-none ring-1 ring-neutral-200 focus:ring-neutral-400"
            placeholder="Grund"
          />
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => onApply(note.trim() || "Krank")}
          className="ios-button mt-4 h-13 h-12 w-full rounded-2xl bg-neutral-900 text-[16px] font-bold text-white disabled:opacity-60"
        >
          {saving ? "Speichern..." : "Krank melden"}
        </button>
      </div>
    </div>
  );
}

function CancelConfirmSheet({
  saving,
  onClose,
  onConfirm
}: {
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] mx-auto flex w-[min(100vw,430px)] items-end bottom-sheet-backdrop"
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <div className="w-full rounded-t-[30px] bg-white px-5 pb-5 pt-3 shadow-[0_-18px_42px_rgba(0,0,0,0.18)]" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-neutral-300" />
        <div className="mb-4 flex items-center justify-between">
          <span className="h-10 w-10" />
          <h2 className="text-[17px] font-bold">Termin absagen?</h2>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100" aria-label="Schließen">
            <X size={20} />
          </button>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={onConfirm}
          className="ios-button flex h-14 w-full items-center justify-center rounded-2xl bg-neutral-900 px-4 text-center text-[16px] font-bold text-white disabled:opacity-60"
        >
          {saving ? "Absagen..." : "Ja, Termin absagen"}
        </button>

        <button type="button" onClick={onClose} className="ios-button mt-3 h-11 w-full rounded-2xl text-[15px] font-bold text-neutral-500">
          Zurück
        </button>
      </div>
    </div>
  );
}

function ChatSheet({
  messages,
  draft,
  loading,
  saving,
  onDraftChange,
  onClose,
  onSend,
  onAccept,
  onCancelRequired
}: {
  messages: StaffChatMessage[];
  draft: string;
  loading: boolean;
  saving: boolean;
  onDraftChange: (value: string) => void;
  onClose: () => void;
  onSend: () => void;
  onAccept: (id: string) => void;
  onCancelRequired: (id: string) => void;
}) {
  const [cancelTarget, setCancelTarget] = useState<StaffChatMessage | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 mx-auto flex w-[min(100vw,430px)] items-end bottom-sheet-backdrop"
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <div className="flex max-h-[86vh] w-full flex-col rounded-t-[30px] bg-white px-5 pb-5 pt-3 shadow-[0_-18px_42px_rgba(0,0,0,0.18)]" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-neutral-300" />
        <div className="mb-3 flex items-center justify-between">
          <span className="h-10 w-10" />
          <h2 className="text-[17px] font-bold">Teamchat</h2>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100" aria-label="Schließen">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-[260px] flex-1 space-y-2 overflow-y-auto rounded-3xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
          {loading ? <p className="py-8 text-center text-[14px] font-semibold text-neutral-500">Laden...</p> : null}
          {!loading && !messages.length ? <p className="py-8 text-center text-[14px] font-semibold text-neutral-500">Noch keine Nachrichten.</p> : null}
          {messages.map((message) => (
            <div key={message.id} className={`rounded-2xl bg-white p-3 shadow-sm ring-1 ${message.status === "open" && (message.type === "transfer_request" || message.type === "cancel_required") ? "ring-neutral-300" : "ring-neutral-100"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-neutral-950">{message.fromName}</p>
                  <p className="text-[11px] font-semibold text-neutral-400">{formatChatTime(message.createdAt)}</p>
                </div>
                {message.type === "transfer_request" || message.type === "cancel_required" ? (
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${message.type === "cancel_required" && message.status === "open" ? "bg-red-50 text-red-800" : "bg-neutral-100 text-neutral-600"}`}>
                    {message.status === "open" ? (message.type === "cancel_required" ? "Absage nötig" : "Offen") : "Erledigt"}
                  </span>
                ) : null}
              </div>
              {message.type === "transfer_request" && message.booking ? (
                <TransferRequestCard message={message} />
              ) : message.type === "cancel_required" && message.booking ? (
                <CancelRequiredCard message={message} />
              ) : (
                <p className="mt-2 text-[14px] font-semibold leading-5 text-neutral-800">{message.message}</p>
              )}
              {message.type === "transfer_request" && message.status === "open" ? (
                <button
                  type="button"
                  disabled={saving || !message.canAccept}
                  onClick={() => onAccept(message.id)}
                  className="ios-button mt-3 h-10 w-full rounded-2xl bg-neutral-900 text-[14px] font-bold text-white disabled:bg-neutral-200 disabled:text-neutral-500"
                >
                  {message.canAccept ? "Termin übernehmen" : "Nicht verfügbar"}
                </button>
              ) : null}
              {message.type === "cancel_required" && message.status === "open" ? (
                <button
                  type="button"
                  disabled={saving || !message.canCancel}
                  onClick={() => setCancelTarget(message)}
                  className="ios-button mt-3 h-10 w-full rounded-2xl bg-red-50 text-[14px] font-bold text-red-900 ring-1 ring-red-100 disabled:bg-neutral-200 disabled:text-neutral-500 disabled:ring-transparent"
                >
                  {message.canCancel ? "Termin absagen" : "Bereits erledigt"}
                </button>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-neutral-100 p-2">
          <input
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSend();
            }}
            className="h-10 min-w-0 flex-1 rounded-xl bg-white px-3 text-[15px] font-semibold outline-none ring-1 ring-neutral-200"
            placeholder="Nachricht"
          />
          <button type="button" onClick={onSend} className="ios-button grid h-10 w-10 shrink-0 place-items-center rounded-full bg-neutral-900 text-white" aria-label="Nachricht senden">
            <Send size={18} />
          </button>
        </div>
      </div>
      {cancelTarget ? (
        <CancelConfirmSheet
          saving={saving}
          onClose={() => setCancelTarget(null)}
          onConfirm={() => {
            const id = cancelTarget.id;
            setCancelTarget(null);
            onCancelRequired(id);
          }}
        />
      ) : null}
    </div>
  );
}

function TransferRequestCard({ message }: { message: StaffChatMessage }) {
  const booking = message.booking;
  if (!booking) return <p className="mt-2 text-[14px] font-semibold leading-5 text-neutral-800">{message.message}</p>;

  return (
    <div className="mt-3 rounded-2xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[16px] font-black leading-5 text-neutral-950">{booking.serviceName}</p>
          <p className="mt-1 truncate text-[14px] font-bold leading-5 text-neutral-700">{booking.customerName}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[12px] font-black text-neutral-700 ring-1 ring-neutral-200">
          {booking.startTime}-{booking.endTime}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-[32px_1fr] items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-neutral-200">
        <CalendarDays size={17} className="text-neutral-500" />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-bold text-neutral-950">{formatChatDate(booking.date)}</p>
          <p className="truncate text-[12px] font-semibold text-neutral-500">aktuell bei {booking.employeeName}</p>
        </div>
      </div>
    </div>
  );
}

function CancelRequiredCard({ message }: { message: StaffChatMessage }) {
  const booking = message.booking;
  if (!booking) return <p className="mt-2 text-[14px] font-semibold leading-5 text-neutral-800">{message.message}</p>;

  return (
    <div className="mt-3 rounded-2xl bg-red-50 p-3 ring-1 ring-red-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[16px] font-black leading-5 text-red-950">{booking.serviceName}</p>
          <p className="mt-1 truncate text-[14px] font-bold leading-5 text-red-900">{booking.customerName}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[12px] font-black text-red-900 ring-1 ring-red-100">
          {booking.startTime}-{booking.endTime}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-[32px_1fr] items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-red-100">
        <CalendarDays size={17} className="text-red-700" />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-bold text-neutral-950">{formatChatDate(booking.date)}</p>
          <p className="truncate text-[12px] font-semibold text-red-700">kein freier Mitarbeiter verfügbar</p>
        </div>
      </div>
    </div>
  );
}

function FormRow({
  icon,
  label,
  value,
  onClick,
  last = false
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onClick: () => void;
  last?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ios-button flex min-h-[62px] w-full items-center gap-3 px-4 text-left ${last ? "" : "border-b border-neutral-100"}`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-800">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-neutral-500">{label}</span>
        <span className="block truncate text-[16px] font-bold text-neutral-950">{value}</span>
      </span>
      <ChevronRight size={19} className="shrink-0 text-neutral-400" />
    </button>
  );
}

function formatChatTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatChatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function DatePickerOverlay({
  selectedDate,
  onClose,
  onSelect
}: {
  selectedDate: Date;
  onClose: () => void;
  onSelect: (date: Date) => void;
}) {
  const [monthDate, setMonthDate] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const todayIso = isoDate(new Date());
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });

  return (
    <div className="fixed inset-0 z-50 mx-auto w-[min(100vw,430px)] bg-[#f7f7f8]">
      <div className="flex h-[64px] items-center justify-between px-5">
        <button type="button" className="grid h-10 w-10 place-items-center rounded-full active:bg-neutral-100" onClick={onClose} aria-label="Schließen">
          <X size={22} />
        </button>
        <h2 className="text-[18px] font-semibold">{formatMonth(monthDate)}</h2>
        <span className="h-10 w-10" />
      </div>
      <div className="ios-card mx-5 rounded-3xl p-4">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full active:bg-neutral-100"
            onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}
            aria-label="Vorheriger Monat"
          >
            <ChevronLeft size={23} />
          </button>
          <p className="text-[15px] font-medium">Tag auswählen</p>
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full active:bg-neutral-100"
            onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}
            aria-label="Nächster Monat"
          >
            <ChevronRight size={23} />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-[12px] text-neutral-500">
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((label) => (
            <span key={label} className="py-2">
              {label}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {days.map((day) => {
            const selected = sameDate(day, selectedDate);
            const inMonth = day.getMonth() === monthDate.getMonth();
            const isPast = isoDate(day) < todayIso;
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => onSelect(day)}
                className={`grid h-11 place-items-center rounded-full text-[16px] ${
                  selected
                    ? isPast
                      ? "bg-neutral-400 text-white"
                      : "bg-neutral-900 text-white"
                    : inMonth
                      ? isPast
                        ? "bg-neutral-100 text-neutral-400 active:bg-neutral-200"
                        : "text-neutral-950 active:bg-neutral-100"
                      : "text-neutral-300"
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

function demoBookingsFor(selectedDate: Date): BookingDto[] {
  if (!sameDate(selectedDate, new Date())) return [];

  const date = isoDate(selectedDate);
  const employee = { id: DEMO_EMPLOYEE_ID, name: "Lisa Müller" };
  return [
    {
      id: "demo-gel",
      employeeId: DEMO_EMPLOYEE_ID,
      customerName: "Lisa Müller",
      date,
      startTime: "09:00",
      endTime: "10:00",
      service: { id: "service-gel", name: "Gel Maniküre", durationMinutes: 60 },
      employee
    },
    {
      id: "demo-refill",
      employeeId: DEMO_EMPLOYEE_ID,
      customerName: "Sarah Schneider",
      date,
      startTime: "10:30",
      endTime: "12:00",
      service: { id: "service-refill-design", name: "Auffüllen + Design", durationMinutes: 90 },
      employee
    },
    {
      id: "demo-pedicure",
      employeeId: DEMO_EMPLOYEE_ID,
      customerName: "Anna Weber",
      date,
      startTime: "14:00",
      endTime: "15:00",
      service: { id: "service-pedicure", name: "Pediküre", durationMinutes: 60 },
      employee
    },
    {
      id: "demo-new-set",
      employeeId: DEMO_EMPLOYEE_ID,
      customerName: "Julia Wagner",
      date,
      startTime: "15:30",
      endTime: "17:00",
      service: { id: "service-new-set", name: "Neumodellage", durationMinutes: 90 },
      employee
    }
  ];
}
