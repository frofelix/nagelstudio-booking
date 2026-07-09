import { addDays } from "date-fns";
import { DEMO_EMPLOYEE_ID, businessDefaults } from "@/lib/constants";
import { isoDate } from "@/lib/date";

export type AdminEmployeeDto = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  color?: string | null;
  role: "owner" | "admin" | "staff";
  inviteStatus: "draft" | "invited" | "active" | "disabled";
  active: boolean;
  canManageBookings: boolean;
  canManageWorkingHours: boolean;
  canManageServices: boolean;
};

export type AdminServiceDto = {
  id: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  priceCents?: number | null;
  active: boolean;
};

export type AdminVacationDto = {
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  note?: string | null;
};

export type AdminBookingDto = {
  id: string;
  employeeId: string;
  serviceId: string;
  customerName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "confirmed" | "cancelled" | "completed" | "no_show";
  notes?: string | null;
  employeeName: string;
  serviceName: string;
};

export type AdminSummaryDto = {
  settings: {
    studioName: string;
    defaultStartTime: string;
    defaultEndTime: string;
    defaultBreakStartTime: string;
    defaultBreakEndTime: string;
  };
  employees: AdminEmployeeDto[];
  services: AdminServiceDto[];
  vacations: AdminVacationDto[];
  bookings: AdminBookingDto[];
};

const today = isoDate(new Date());
const nextWeek = isoDate(addDays(new Date(), 7));

export const demoAdminSummary: AdminSummaryDto = {
  settings: {
    studioName: "Nagelstudio",
    defaultStartTime: businessDefaults.startTime,
    defaultEndTime: businessDefaults.endTime,
    defaultBreakStartTime: businessDefaults.breakStartTime,
    defaultBreakEndTime: businessDefaults.breakEndTime
  },
  employees: [
    {
      id: DEMO_EMPLOYEE_ID,
      name: "Lisa Müller",
      email: "lisa@nailstudio.test",
      phone: "0176 123456",
      color: "#111111",
      role: "owner",
      inviteStatus: "active",
      active: true,
      canManageBookings: true,
      canManageWorkingHours: true,
      canManageServices: true
    },
    {
      id: "demo-sarah",
      name: "Sarah Schneider",
      email: "sarah@nailstudio.test",
      color: "#6b7280",
      role: "staff",
      inviteStatus: "invited",
      active: true,
      canManageBookings: false,
      canManageWorkingHours: true,
      canManageServices: false
    },
    {
      id: "demo-anna",
      name: "Anna Weber",
      email: "anna@nailstudio.test",
      color: "#9ca3af",
      role: "staff",
      inviteStatus: "draft",
      active: true,
      canManageBookings: false,
      canManageWorkingHours: true,
      canManageServices: false
    }
  ],
  services: [
    { id: "service-manicure", name: "Maniküre", durationMinutes: 45, priceCents: 4500, active: true },
    { id: "service-gel", name: "Gel Maniküre", durationMinutes: 60, priceCents: 6500, active: true },
    { id: "service-refill-design", name: "Auffüllen + Design", durationMinutes: 90, priceCents: 7900, active: true },
    { id: "service-pedicure", name: "Pediküre", durationMinutes: 60, priceCents: 5500, active: true }
  ],
  vacations: [
    {
      id: "demo-vacation",
      employeeId: DEMO_EMPLOYEE_ID,
      employeeName: "Lisa Müller",
      startDate: nextWeek,
      endDate: isoDate(addDays(new Date(`${nextWeek}T00:00:00`), 2)),
      note: "Urlaub"
    }
  ],
  bookings: [
    {
      id: "demo-booking",
      employeeId: DEMO_EMPLOYEE_ID,
      serviceId: "service-gel",
      customerName: "Lisa Müller",
      date: today,
      startTime: "09:00",
      endTime: "10:00",
      status: "confirmed",
      employeeName: "Lisa Müller",
      serviceName: "Gel Maniküre"
    }
  ]
};
