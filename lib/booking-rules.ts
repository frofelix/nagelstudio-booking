import "server-only";

import { businessDefaults } from "@/lib/constants";
import { isoDate, toDateOnly } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { isWithin, overlaps } from "@/lib/time";

type BookingSlot = {
  employeeId: string;
  serviceId: string;
  date: string;
  startTime: string;
  endTime: string;
  excludeBookingId?: string;
};

export async function validateBookingSlot(slot: BookingSlot) {
  const date = toDateOnly(slot.date);

  if (slot.date < isoDate(new Date())) {
    return "Vergangene Tage koennen nicht mehr bearbeitet werden.";
  }

  const [employee, service, vacation, workingHours, existingBookings, settings] = await Promise.all([
    prisma.employee.findUnique({ where: { id: slot.employeeId }, select: { active: true, name: true } }),
    prisma.service.findUnique({ where: { id: slot.serviceId }, select: { active: true, name: true } }),
    prisma.vacation.findFirst({
      where: {
        employeeId: slot.employeeId,
        startDate: { lte: date },
        endDate: { gte: date }
      },
      select: { note: true, startDate: true, endDate: true }
    }),
    prisma.workingHours.findUnique({
      where: { employeeId_date: { employeeId: slot.employeeId, date } }
    }),
    prisma.booking.findMany({
      where: {
        employeeId: slot.employeeId,
        date,
        status: { not: "cancelled" },
        id: slot.excludeBookingId ? { not: slot.excludeBookingId } : undefined
      },
      select: { id: true, startTime: true, endTime: true, customerName: true }
    }),
    prisma.businessSettings.findUnique({ where: { id: "default" } })
  ]);

  if (!employee?.active) return "Dieser Mitarbeiter ist nicht aktiv.";
  if (!service?.active) return "Dieser Service ist nicht aktiv.";
  if (vacation) return `Der Mitarbeiter ist an diesem Tag nicht verfuegbar${vacation.note ? ` (${vacation.note})` : ""}.`;

  const effectiveHours = workingHours
    ? {
        isWorking: workingHours.isWorking,
        startTime: workingHours.startTime,
        endTime: workingHours.endTime,
        breakStartTime: workingHours.breakStartTime,
        breakEndTime: workingHours.breakEndTime
      }
    : defaultHoursForDate(date, settings);

  if (!effectiveHours.isWorking || !effectiveHours.startTime || !effectiveHours.endTime) {
    return "Der Mitarbeiter arbeitet an diesem Tag nicht.";
  }

  if (!isWithin(slot.startTime, slot.endTime, effectiveHours.startTime, effectiveHours.endTime)) {
    return `Termin liegt ausserhalb der Arbeitszeit (${effectiveHours.startTime}-${effectiveHours.endTime}).`;
  }

  if (
    effectiveHours.breakStartTime &&
    effectiveHours.breakEndTime &&
    overlaps(slot.startTime, slot.endTime, effectiveHours.breakStartTime, effectiveHours.breakEndTime)
  ) {
    return `Termin ueberschneidet sich mit der Pause (${effectiveHours.breakStartTime}-${effectiveHours.breakEndTime}).`;
  }

  const conflict = existingBookings.find((booking) => overlaps(slot.startTime, slot.endTime, booking.startTime, booking.endTime));
  if (conflict) {
    return `Termin ueberschneidet sich mit ${conflict.customerName} (${conflict.startTime}-${conflict.endTime}).`;
  }

  return null;
}

function defaultHoursForDate(
  date: Date,
  settings: {
    defaultStartTime: string;
    defaultEndTime: string;
    defaultBreakStartTime: string;
    defaultBreakEndTime: string;
  } | null
) {
  const day = date.getUTCDay();
  const isWorking = day >= 1 && day <= 5;

  return {
    isWorking,
    startTime: isWorking ? settings?.defaultStartTime ?? businessDefaults.startTime : null,
    endTime: isWorking ? settings?.defaultEndTime ?? businessDefaults.endTime : null,
    breakStartTime: isWorking ? settings?.defaultBreakStartTime ?? businessDefaults.breakStartTime : null,
    breakEndTime: isWorking ? settings?.defaultBreakEndTime ?? businessDefaults.breakEndTime : null
  };
}
