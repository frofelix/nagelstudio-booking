"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  KeyRound,
  LogOut,
  Mail,
  Plus,
  Scissors,
  Sun,
  ToggleLeft,
  ToggleRight,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppPickerSheet } from "@/components/AppPickerSheet";
import type { AdminBookingDto, AdminEmployeeDto, AdminServiceDto, AdminSummaryDto, AdminVacationDto } from "@/lib/admin-data";
import { isoDate } from "@/lib/date";

type AdminTab = "team" | "services" | "settings";

type InviteResult = {
  email: string;
  temporaryPassword: string;
  loginPath: string;
  employeeName: string;
};

const tabs: Array<{ key: AdminTab; label: string; icon: ReactNode }> = [
  { key: "team", label: "Team", icon: <UsersRound size={18} /> },
  { key: "services", label: "Services", icon: <Scissors size={18} /> },
  { key: "settings", label: "Zeiten", icon: <Clock3 size={18} /> }
];

export function AdminDashboardClient() {
  const router = useRouter();
  const [summary, setSummary] = useState<AdminSummaryDto | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("team");
  const [sheet, setSheet] = useState<"employee" | "service" | "vacation" | null>(null);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/summary")
      .then((response) => response.json())
      .then(setSummary)
      .catch(() => setMessage("Admin-Daten konnten nicht geladen werden."));
  }, []);

  const stats = useMemo(() => {
    if (!summary) return { activeEmployees: 0, services: 0, startTime: "--:--", endTime: "--:--" };
    return {
      activeEmployees: summary.employees.filter((employee) => employee.active).length,
      services: summary.services.filter((service) => service.active).length,
      startTime: summary.settings.defaultStartTime,
      endTime: summary.settings.defaultEndTime
    };
  }, [summary]);

  async function createEmployee(data: Pick<AdminEmployeeDto, "name" | "email" | "phone" | "role" | "canManageBookings" | "canManageWorkingHours" | "canManageServices">) {
    const response = await fetch("/api/admin/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      setMessage("Mitarbeiter konnte nicht angelegt werden.");
      return;
    }

    const result = await response.json();
    setSummary((current) => (current ? { ...current, employees: [result.employee, ...current.employees] } : current));
    setSheet(null);
    setMessage("Mitarbeiter angelegt. Einladung kann jetzt versendet werden.");
  }

  async function updateEmployee(id: string, data: Partial<AdminEmployeeDto>) {
    const response = await fetch("/api/admin/employees", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data })
    });

    if (!response.ok) {
      setMessage("Mitarbeiter konnte nicht aktualisiert werden.");
      return;
    }

    const result = await response.json();
    setSummary((current) =>
      current
        ? {
            ...current,
            employees: current.employees.map((employee) => (employee.id === id ? result.employee : employee))
          }
        : current
    );
    setMessage("Mitarbeiter aktualisiert.");
  }

  async function inviteEmployee(id: string) {
    const response = await fetch("/api/admin/employees/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: id })
    });

    if (!response.ok) {
      setMessage("Zugang konnte nicht erstellt werden.");
      return;
    }

    const result = await response.json();
    setSummary((current) =>
      current
        ? {
            ...current,
            employees: current.employees.map((employee) => (employee.id === id ? result.employee : employee))
          }
        : current
    );
    setInviteResult(result.invite);
    setMessage("Zugang erstellt. Passwort wird nur jetzt angezeigt.");
  }

  async function createService(data: Pick<AdminServiceDto, "name" | "durationMinutes" | "priceCents" | "description">) {
    const response = await fetch("/api/admin/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      setMessage("Service konnte nicht angelegt werden.");
      return;
    }

    const result = await response.json();
    setSummary((current) => (current ? { ...current, services: [result.service, ...current.services] } : current));
    setSheet(null);
    setMessage("Service angelegt.");
  }

  async function updateService(id: string, data: Partial<AdminServiceDto>) {
    const response = await fetch("/api/admin/services", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data })
    });

    if (!response.ok) {
      setMessage("Service konnte nicht aktualisiert werden.");
      return;
    }

    const result = await response.json();
    setSummary((current) =>
      current
        ? {
            ...current,
            services: current.services.map((service) => (service.id === id ? result.service : service))
          }
        : current
    );
    setMessage("Service aktualisiert.");
  }

  async function createVacation(data: Pick<AdminVacationDto, "employeeId" | "startDate" | "endDate" | "note">) {
    const response = await fetch("/api/admin/vacations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      setMessage("Urlaub konnte nicht gespeichert werden.");
      return;
    }

    const result = await response.json();
    setSummary((current) => (current ? { ...current, vacations: [result.vacation, ...current.vacations] } : current));
    setSheet(null);
    setMessage("Urlaub eingetragen. Die Tage werden fuer Termine gesperrt.");
  }

  async function removeVacation(id: string) {
    const response = await fetch(`/api/admin/vacations?id=${encodeURIComponent(id)}`, { method: "DELETE" });

    if (!response.ok) {
      setMessage("Urlaub konnte nicht entfernt werden.");
      return;
    }

    setSummary((current) => (current ? { ...current, vacations: current.vacations.filter((vacation) => vacation.id !== id) } : current));
    setMessage("Urlaub entfernt.");
  }

  async function updateBooking(id: string, data: Partial<AdminBookingDto>) {
    const response = await fetch("/api/admin/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data })
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setMessage(typeof result?.error === "string" ? result.error : "Termin konnte nicht aktualisiert werden.");
      return;
    }

    const result = await response.json();
    setSummary((current) =>
      current
        ? {
            ...current,
            bookings: current.bookings.map((booking) => (booking.id === id ? result.booking : booking))
          }
        : current
    );
    setMessage("Termin aktualisiert.");
  }

  async function cancelBooking(id: string) {
    const response = await fetch(`/api/admin/bookings?id=${encodeURIComponent(id)}`, { method: "DELETE" });

    if (!response.ok) {
      setMessage("Termin konnte nicht storniert werden.");
      return;
    }

    setSummary((current) => (current ? { ...current, bookings: current.bookings.filter((booking) => booking.id !== id) } : current));
    setMessage("Termin storniert.");
  }

  async function updateSettings(data: AdminSummaryDto["settings"]) {
    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setMessage(typeof result?.error === "string" ? result.error : "Öffnungszeiten konnten nicht gespeichert werden.");
      return;
    }

    const result = await response.json();
    setSummary((current) => (current ? { ...current, settings: result.settings } : current));
    setMessage("Öffnungszeiten gespeichert.");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="phone-shell min-h-dvh pb-8">
      <header className="sticky top-0 z-20 bg-white/90 px-4 pb-3 pt-3 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <Link href="/staff/calendar" className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100 text-neutral-900" aria-label="Zur Mitarbeiter-App">
            <ArrowLeft size={21} />
          </Link>
          <h1 className="text-[18px] font-bold">Admin</h1>
          <div className="flex items-center gap-2">
            <button type="button" onClick={logout} className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100 text-neutral-900" aria-label="Abmelden">
              <LogOut size={19} />
            </button>
            <Link href="/staff/working-hours" className="grid h-10 w-10 place-items-center rounded-full bg-neutral-900 text-white" aria-label="Mitarbeiter-App öffnen">
              <UserRound size={20} />
            </Link>
          </div>
        </div>
      </header>

      <section className="px-4 pt-4">
        <div className="rounded-[28px] bg-white px-5 py-5 shadow-sm ring-1 ring-neutral-200/80">
          <p className="text-[13px] font-bold uppercase text-neutral-500">Backoffice</p>
          <div className="mt-1 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-[30px] font-bold leading-9 text-neutral-950">{summary?.settings.studioName ?? "Nagelstudio"}</h2>
              <p className="mt-1 text-[13px] font-medium text-neutral-500">Team, Services und Freigaben verwalten.</p>
            </div>
            <button type="button" onClick={() => setSheet("employee")} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-neutral-950 text-white shadow-sm active:scale-95" aria-label="Mitarbeiter hinzufügen">
              <Plus size={29} />
            </button>
          </div>
          <div className="mt-5 grid grid-cols-4 gap-2 text-center">
            <Stat value={stats.activeEmployees} label="Team" />
            <Stat value={stats.services} label="Services" />
            <Stat value={stats.startTime} label="Öffnet" />
            <Stat value={stats.endTime} label="Schließt" />
          </div>
        </div>
      </section>

      <section className="px-4 pt-4">
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-neutral-200 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`ios-button flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-bold ${
                activeTab === tab.key ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-500"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {message ? (
        <p className="mx-4 mt-4 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-[13px] font-semibold text-neutral-700 shadow-sm ring-1 ring-neutral-200">
          <Check size={17} />
          {message}
        </p>
      ) : null}

      {!summary ? (
        <section className="mx-4 mt-4 rounded-3xl bg-white p-5 text-[15px] font-semibold text-neutral-500 shadow-sm ring-1 ring-neutral-200">Admin-Bereich wird geladen...</section>
      ) : activeTab === "team" ? (
        <TeamPanel employees={summary.employees} onAdd={() => setSheet("employee")} onUpdate={updateEmployee} onInvite={inviteEmployee} />
      ) : activeTab === "services" ? (
        <ServicePanel services={summary.services} onAdd={() => setSheet("service")} onUpdate={updateService} />
      ) : (
        <SettingsPanel settings={summary.settings} onSave={updateSettings} />
      )}

      {sheet === "employee" ? <EmployeeSheet onClose={() => setSheet(null)} onCreate={createEmployee} /> : null}
      {sheet === "service" ? <ServiceSheet onClose={() => setSheet(null)} onCreate={createService} /> : null}
      {sheet === "vacation" && summary ? <VacationSheet employees={summary.employees.filter((employee) => employee.active)} onClose={() => setSheet(null)} onCreate={createVacation} /> : null}
      {inviteResult ? <InviteSheet invite={inviteResult} onClose={() => setInviteResult(null)} /> : null}
    </main>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-2xl bg-neutral-50 px-2 py-3 ring-1 ring-neutral-200/80">
      <p className="text-[21px] font-bold leading-6 text-neutral-950">{value}</p>
      <p className="mt-1 text-[11px] font-semibold text-neutral-500">{label}</p>
    </div>
  );
}

function TeamPanel({
  employees,
  onAdd,
  onUpdate,
  onInvite
}: {
  employees: AdminEmployeeDto[];
  onAdd: () => void;
  onUpdate: (id: string, data: Partial<AdminEmployeeDto>) => void;
  onInvite: (id: string) => void;
}) {
  return (
    <section className="px-4 pt-4">
      <PanelHeader title="Mitarbeiter" action="Neu" onAction={onAdd} />
      <div className="mt-3 space-y-3">
        {employees.map((employee) => (
          <div key={employee.id} className={`rounded-[26px] bg-white p-4 shadow-sm ring-1 ${employee.active ? "ring-neutral-200" : "opacity-70 ring-neutral-200"}`}>
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-neutral-100 text-[18px] font-bold" style={{ color: employee.color ?? "#111111" }}>
                {employee.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[17px] font-bold leading-5">{employee.name}</p>
                    <p className="mt-1 truncate text-[13px] text-neutral-500">{employee.email}</p>
                  </div>
                  <SwitchButton active={employee.active} label={employee.active ? "aktiv" : "aus"} onClick={() => onUpdate(employee.id, { active: !employee.active })} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <RoleBadge role={employee.role} />
                  <span className="rounded-full bg-neutral-100 px-3 py-1 text-[12px] font-semibold text-neutral-600">{inviteLabel(employee.inviteStatus)}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <PermissionButton label="Termine" active={employee.canManageBookings} onClick={() => onUpdate(employee.id, { canManageBookings: !employee.canManageBookings })} />
              <PermissionButton label="Zeiten" active={employee.canManageWorkingHours} onClick={() => onUpdate(employee.id, { canManageWorkingHours: !employee.canManageWorkingHours })} />
              <PermissionButton label="Services" active={employee.canManageServices} onClick={() => onUpdate(employee.id, { canManageServices: !employee.canManageServices })} />
            </div>
            <button
              type="button"
              onClick={() => onInvite(employee.id)}
              className="ios-button mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-100 text-[14px] font-bold text-neutral-900 ring-1 ring-neutral-200/70"
            >
              <Mail size={17} />
              {employee.inviteStatus === "active" ? "Passwort zurücksetzen" : "Zugang erstellen"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function ServicePanel({ services, onAdd, onUpdate }: { services: AdminServiceDto[]; onAdd: () => void; onUpdate: (id: string, data: Partial<AdminServiceDto>) => void }) {
  return (
    <section className="px-4 pt-4">
      <PanelHeader title="Services" action="Neu" onAction={onAdd} />
      <div className="mt-3 space-y-3">
        {services.map((service) => (
          <div key={service.id} className="rounded-[26px] bg-white p-4 shadow-sm ring-1 ring-neutral-200">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-neutral-100">
                <Scissors size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-bold">{service.name}</p>
                <p className="text-[13px] text-neutral-500">
                  {service.durationMinutes} Min. {service.priceCents ? `· ${formatPrice(service.priceCents)}` : ""}
                </p>
              </div>
              <SwitchButton active={service.active} label={service.active ? "aktiv" : "aus"} onClick={() => onUpdate(service.id, { active: !service.active })} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function VacationPanel({
  vacations,
  employees,
  onAdd,
  onRemove
}: {
  vacations: AdminVacationDto[];
  employees: AdminEmployeeDto[];
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="px-4 pt-4">
      <PanelHeader title="Urlaub & Sperrtage" action="Eintragen" onAction={onAdd} />
      <div className="mt-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fff4cc] text-[#9b6a00]">
            <Sun size={23} />
          </div>
          <div>
            <p className="text-[17px] font-bold">Abwesenheiten</p>
            <p className="text-[13px] text-neutral-500">{employees.filter((employee) => employee.active).length} aktive Mitarbeiter planbar.</p>
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-3">
        {vacations.length ? (
          vacations.map((vacation) => (
            <div key={vacation.id} className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-neutral-100">
                <CalendarDays size={21} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-bold">{vacation.employeeName}</p>
                <p className="text-[13px] text-neutral-500">{formatRange(vacation.startDate, vacation.endDate)}</p>
              </div>
              <button type="button" onClick={() => onRemove(vacation.id)} className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100 text-neutral-600" aria-label="Urlaub entfernen">
                <X size={18} />
              </button>
            </div>
          ))
        ) : (
          <EmptyState text="Noch kein Urlaub eingetragen." />
        )}
      </div>
    </section>
  );
}

function BookingsPanel({
  bookings,
  onUpdate,
  onCancel
}: {
  bookings: AdminBookingDto[];
  onUpdate: (id: string, data: Partial<AdminBookingDto>) => void;
  onCancel: (id: string) => void;
}) {
  return (
    <section className="px-4 pt-4">
      <PanelHeader title="Termine verwalten" />
      <div className="mt-3 space-y-3">
        {bookings.length ? (
          bookings.map((booking) => (
            <div key={booking.id} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-neutral-100">
                  <Clock3 size={21} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-bold">{booking.customerName}</p>
                  <p className="text-[13px] text-neutral-500">
                    {formatDate(booking.date)} · {booking.startTime}-{booking.endTime}
                  </p>
                </div>
                <StatusBadge status={booking.status} />
              </div>
              <div className="mt-3 flex items-center justify-between rounded-2xl bg-neutral-50 px-3 py-2 text-[13px] font-semibold text-neutral-600">
                <span>{booking.serviceName}</span>
                <span>{booking.employeeName}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button type="button" onClick={() => onUpdate(booking.id, { status: "completed" })} className="ios-button h-10 rounded-2xl bg-neutral-900 text-[12px] font-bold text-white">
                  Erledigt
                </button>
                <button type="button" onClick={() => onUpdate(booking.id, { status: "no_show" })} className="ios-button h-10 rounded-2xl bg-neutral-100 text-[12px] font-bold text-neutral-700">
                  Nicht da
                </button>
                <button type="button" onClick={() => onCancel(booking.id)} className="ios-button h-10 rounded-2xl bg-red-50 text-[12px] font-bold text-red-700">
                  Storno
                </button>
              </div>
            </div>
          ))
        ) : (
          <EmptyState text="Noch keine Termine vorhanden." />
        )}
      </div>
    </section>
  );
}

function SettingsPanel({ settings, onSave }: { settings: AdminSummaryDto["settings"]; onSave: (settings: AdminSummaryDto["settings"]) => void }) {
  const [studioName, setStudioName] = useState(settings.studioName);
  const [defaultStartTime, setDefaultStartTime] = useState(settings.defaultStartTime);
  const [defaultEndTime, setDefaultEndTime] = useState(settings.defaultEndTime);
  const [defaultBreakStartTime, setDefaultBreakStartTime] = useState(settings.defaultBreakStartTime);
  const [defaultBreakEndTime, setDefaultBreakEndTime] = useState(settings.defaultBreakEndTime);

  useEffect(() => {
    setStudioName(settings.studioName);
    setDefaultStartTime(settings.defaultStartTime);
    setDefaultEndTime(settings.defaultEndTime);
    setDefaultBreakStartTime(settings.defaultBreakStartTime);
    setDefaultBreakEndTime(settings.defaultBreakEndTime);
  }, [settings]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ studioName, defaultStartTime, defaultEndTime, defaultBreakStartTime, defaultBreakEndTime });
  }

  return (
    <section className="px-4 pt-4">
      <PanelHeader title="Öffnungszeiten" />
      <form onSubmit={submit} className="mt-3 space-y-3 rounded-[26px] bg-white p-4 shadow-sm ring-1 ring-neutral-200">
        <TextInput icon={<BriefcaseBusiness size={18} />} label="Studio" value={studioName} onChange={setStudioName} required />
        <div className="grid grid-cols-2 gap-2">
          <TimeInput label="Öffnet" value={defaultStartTime} onChange={setDefaultStartTime} />
          <TimeInput label="Schließt" value={defaultEndTime} onChange={setDefaultEndTime} />
        </div>
        <p className="rounded-2xl bg-neutral-50 px-4 py-3 text-[13px] font-medium leading-5 text-neutral-500 ring-1 ring-neutral-200">
          Diese Zeiten werden als Standard für neue Arbeitswochen, freie Terminzeiten und die Startzeit bei manuellen Terminen verwendet.
        </p>
        <SubmitButton label="Öffnungszeiten speichern" />
      </form>
    </section>
  );
}

function TimeInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block rounded-2xl bg-white p-3 ring-1 ring-neutral-200">
      <span className="mb-2 block text-[12px] font-bold text-neutral-500">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border-0 bg-neutral-50 px-3 text-[16px] font-bold outline-none ring-1 ring-neutral-200"
      />
    </label>
  );
}

function StatusBadge({ status }: { status: AdminBookingDto["status"] }) {
  const label = status === "completed" ? "Erledigt" : status === "no_show" ? "Nicht da" : status === "cancelled" ? "Storniert" : "Bestätigt";
  const color =
    status === "completed"
      ? "bg-emerald-50 text-emerald-700"
      : status === "no_show"
        ? "bg-amber-50 text-amber-700"
        : status === "cancelled"
          ? "bg-red-50 text-red-700"
          : "bg-neutral-100 text-neutral-700";
  return <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${color}`}>{label}</span>;
}

function EmployeeSheet({
  onClose,
  onCreate
}: {
  onClose: () => void;
  onCreate: (data: Pick<AdminEmployeeDto, "name" | "email" | "phone" | "role" | "canManageBookings" | "canManageWorkingHours" | "canManageServices">) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<AdminEmployeeDto["role"]>("staff");
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [canManageBookings, setCanManageBookings] = useState(false);
  const [canManageWorkingHours, setCanManageWorkingHours] = useState(true);
  const [canManageServices, setCanManageServices] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate({ name, email, phone, role, canManageBookings, canManageWorkingHours, canManageServices });
  }

  return (
    <Sheet title="Mitarbeiter anlegen" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <TextInput icon={<UserRound size={18} />} label="Name" value={name} onChange={setName} required />
        <TextInput icon={<Mail size={18} />} label="E-Mail" value={email} onChange={setEmail} type="email" required />
        <TextInput icon={<BriefcaseBusiness size={18} />} label="Telefon" value={phone} onChange={setPhone} />
        <PickerButton label="Rolle" value={roleLabel(role)} onClick={() => setRolePickerOpen(true)} />
        <div className="grid grid-cols-3 gap-2">
          <PermissionButton label="Termine" active={canManageBookings} onClick={() => setCanManageBookings((value) => !value)} />
          <PermissionButton label="Zeiten" active={canManageWorkingHours} onClick={() => setCanManageWorkingHours((value) => !value)} />
          <PermissionButton label="Services" active={canManageServices} onClick={() => setCanManageServices((value) => !value)} />
        </div>
        <SubmitButton label="Mitarbeiter speichern" />
      </form>
      {rolePickerOpen ? (
        <AppPickerSheet
          title="Rolle auswählen"
          value={role}
          options={[
            { value: "staff", label: "Mitarbeiter" },
            { value: "admin", label: "Admin" },
            { value: "owner", label: "Inhaber" }
          ]}
          onClose={() => setRolePickerOpen(false)}
          onSelect={(value) => {
            setRole(value as AdminEmployeeDto["role"]);
            setRolePickerOpen(false);
          }}
        />
      ) : null}
    </Sheet>
  );
}

function ServiceSheet({ onClose, onCreate }: { onClose: () => void; onCreate: (data: Pick<AdminServiceDto, "name" | "durationMinutes" | "priceCents" | "description">) => void }) {
  const [name, setName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [price, setPrice] = useState("65");
  const [description, setDescription] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate({ name, durationMinutes, priceCents: Math.round(Number(price || 0) * 100), description });
  }

  return (
    <Sheet title="Service anlegen" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <TextInput icon={<Scissors size={18} />} label="Name" value={name} onChange={setName} required />
        <label className="block rounded-2xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
          <span className="mb-2 block text-[12px] font-bold text-neutral-500">Dauer</span>
          <input
            type="range"
            min={15}
            max={180}
            step={15}
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(Number(event.target.value))}
            className="w-full accent-neutral-900"
          />
          <span className="mt-1 block text-[18px] font-bold">{durationMinutes} Min.</span>
        </label>
        <TextInput icon={<KeyRound size={18} />} label="Preis in Euro" value={price} onChange={setPrice} type="number" />
        <TextInput icon={<ChevronRight size={18} />} label="Beschreibung" value={description} onChange={setDescription} />
        <SubmitButton label="Service speichern" />
      </form>
    </Sheet>
  );
}

function VacationSheet({ employees, onClose, onCreate }: { employees: AdminEmployeeDto[]; onClose: () => void; onCreate: (data: Pick<AdminVacationDto, "employeeId" | "startDate" | "endDate" | "note">) => void }) {
  const today = isoDate(new Date());
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [note, setNote] = useState("Urlaub");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate({ employeeId, startDate, endDate, note });
  }

  return (
    <Sheet title="Urlaub eintragen" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <PickerButton label="Mitarbeiter" value={employees.find((employee) => employee.id === employeeId)?.name ?? "Auswählen"} onClick={() => setEmployeePickerOpen(true)} />
        <div className="grid grid-cols-2 gap-2">
          <DateInput label="Von" value={startDate} min={today} onChange={(value) => {
            setStartDate(value);
            if (endDate < value) setEndDate(value);
          }} />
          <DateInput label="Bis" value={endDate} min={startDate} onChange={setEndDate} />
        </div>
        <TextInput icon={<Sun size={18} />} label="Notiz" value={note} onChange={setNote} />
        <SubmitButton label="Urlaub speichern" disabled={!employeeId || endDate < startDate} />
      </form>
      {employeePickerOpen ? (
        <AppPickerSheet
          title="Mitarbeiter auswählen"
          value={employeeId}
          options={employees.map((employee) => ({ value: employee.id, label: employee.name }))}
          onClose={() => setEmployeePickerOpen(false)}
          onSelect={(value) => {
            setEmployeeId(value);
            setEmployeePickerOpen(false);
          }}
        />
      ) : null}
    </Sheet>
  );
}

function InviteSheet({ invite, onClose }: { invite: InviteResult; onClose: () => void }) {
  const loginUrl = typeof window === "undefined" ? invite.loginPath : `${window.location.origin}${invite.loginPath}`;
  const message = `Hallo ${invite.employeeName},\n\ndein Zugang zur Nagelstudio-App ist bereit:\n${loginUrl}\n\nE-Mail: ${invite.email}\nStartpasswort: ${invite.temporaryPassword}\n\nBitte nach dem ersten Login ein eigenes Passwort setzen, sobald diese Funktion freigeschaltet ist.`;

  async function copyInvite() {
    await navigator.clipboard.writeText(message);
  }

  return (
    <Sheet title="Zugang erstellt" onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-3xl bg-neutral-950 p-4 text-white">
          <p className="text-[13px] font-semibold text-white/60">Mitarbeiter</p>
          <p className="mt-1 text-[20px] font-bold">{invite.employeeName}</p>
        </div>
        <CredentialRow label="Login" value={loginUrl} />
        <CredentialRow label="E-Mail" value={invite.email} />
        <CredentialRow label="Startpasswort" value={invite.temporaryPassword} strong />
        <button type="button" onClick={copyInvite} className="ios-button h-12 w-full rounded-2xl bg-neutral-900 text-[16px] font-bold text-white">
          Zugangsdaten kopieren
        </button>
        <p className="rounded-2xl bg-neutral-50 px-4 py-3 text-[13px] font-medium leading-5 text-neutral-500 ring-1 ring-neutral-200">
          Das Startpasswort wird nur jetzt angezeigt. Beim erneuten Zuruecksetzen wird ein neues Passwort erstellt.
        </p>
      </div>
    </Sheet>
  );
}

function CredentialRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-2xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
      <p className="text-[12px] font-bold text-neutral-500">{label}</p>
      <p className={`mt-1 break-all text-[15px] ${strong ? "font-black text-neutral-950" : "font-semibold text-neutral-800"}`}>{value}</p>
    </div>
  );
}

function PanelHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-[22px] font-bold tracking-tight">{title}</h2>
      {action && onAction ? (
        <button type="button" onClick={onAction} className="ios-button flex h-10 items-center gap-1 rounded-full bg-neutral-900 px-4 text-[14px] font-bold text-white">
          <Plus size={17} />
          {action}
        </button>
      ) : null}
    </div>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
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
          <h2 className="text-[17px] font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100" aria-label="Schließen">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function TextInput({
  icon,
  label,
  value,
  onChange,
  required = false,
  type = "text"
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="flex items-center gap-3 rounded-2xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white ring-1 ring-neutral-200">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-bold text-neutral-500">{label}</span>
        <input
          type={type}
          required={required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-0.5 w-full border-0 bg-transparent text-[16px] font-semibold outline-none placeholder:text-neutral-400"
        />
      </span>
    </label>
  );
}

function PickerButton({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="ios-button flex min-h-[62px] w-full items-center justify-between rounded-2xl bg-neutral-50 p-3 text-left ring-1 ring-neutral-200">
      <span>
        <span className="block text-[12px] font-bold text-neutral-500">{label}</span>
        <span className="mt-0.5 block text-[16px] font-semibold text-neutral-950">{value}</span>
      </span>
      <ChevronRight size={19} className="text-neutral-400" />
    </button>
  );
}

function DateInput({ label, value, min, onChange }: { label: string; value: string; min: string; onChange: (value: string) => void }) {
  return (
    <label className="block rounded-2xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
      <span className="mb-2 block text-[12px] font-bold text-neutral-500">{label}</span>
      <input type="date" min={min} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-xl border-0 bg-white px-2 text-[14px] font-bold outline-none ring-1 ring-neutral-200" />
    </label>
  );
}

function SubmitButton({ label, disabled = false }: { label: string; disabled?: boolean }) {
  return (
    <button type="submit" disabled={disabled} className="ios-button mt-2 h-12 w-full rounded-2xl bg-neutral-900 text-[16px] font-bold text-white disabled:opacity-50">
      {label}
    </button>
  );
}

function SwitchButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex h-9 items-center gap-1.5 rounded-full px-2 text-[12px] font-bold ${active ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500"}`}>
      {active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
      {label}
    </button>
  );
}

function PermissionButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`ios-button h-10 rounded-2xl text-[12px] font-bold ${active ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500"}`}>
      {label}
    </button>
  );
}

function RoleBadge({ role }: { role: AdminEmployeeDto["role"] }) {
  const label = roleLabel(role);
  return <span className="rounded-full bg-neutral-900 px-3 py-1 text-[12px] font-semibold text-white">{label}</span>;
}

function roleLabel(role: AdminEmployeeDto["role"]) {
  if (role === "owner") return "Inhaber";
  if (role === "admin") return "Admin";
  return "Mitarbeiter";
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-3xl bg-white p-5 text-[15px] font-semibold text-neutral-500 shadow-sm ring-1 ring-neutral-200">{text}</div>;
}

function inviteLabel(status: AdminEmployeeDto["inviteStatus"]) {
  if (status === "active") return "Zugang aktiv";
  if (status === "invited") return "Eingeladen";
  if (status === "disabled") return "Gesperrt";
  return "Entwurf";
}

function formatPrice(priceCents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(priceCents / 100);
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}

function formatRange(startDate: string, endDate: string) {
  if (startDate === endDate) return formatDate(startDate);
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}
