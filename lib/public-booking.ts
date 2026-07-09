import "server-only";

import { businessDefaults } from "@/lib/constants";
import { isoDate, toDateOnly } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { isWithin, minutesToTime, overlaps, timeToMinutes } from "@/lib/time";

export type PublicBookingSlot = {
  employeeId: string;
  employeeName: string;
  startTime: string;
  endTime: string;
};

type EmployeeLite = {
  id: string;
  name: string;
};

type WorkingHoursLite = {
  employeeId: string;
  date: Date;
  isWorking: boolean;
  startTime: string | null;
  endTime: string | null;
  breakStartTime: string | null;
  breakEndTime: string | null;
};

type BookingLite = {
  employeeId: string;
  date: Date;
  startTime: string;
  endTime: string;
};

type VacationLite = {
  employeeId: string;
  startDate: Date;
  endDate: Date;
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const SLOT_CACHE_TTL_MS = 30_000;
const AVAILABILITY_CACHE_TTL_MS = 30_000;
const slotCache = new Map<string, CacheEntry<PublicBookingSlot[]>>();
const availabilityCache = new Map<string, CacheEntry<Array<{ date: string; available: boolean; isSunday: boolean; isPast: boolean }>>>();

export async function listPublicBookingSlots(input: { serviceId: string; date: string; employeeId?: string | null }) {
  if (!process.env.DATABASE_URL) return [];

  if (input.date < isoDate(new Date())) return [];

  const date = toDateOnly(input.date);
  if (date.getUTCDay() === 0) return [];

  const cacheKey = `${input.serviceId}:${input.date}:${input.employeeId ?? "any"}`;
  const cached = getCache(slotCache, cacheKey);
  if (cached) return cached;

  const selectedEmployeeId = input.employeeId && input.employeeId !== "any" ? input.employeeId : undefined;
  const [service, employees, settings, vacations, workingHours, bookings] = await Promise.all([
    prisma.service.findFirst({
      where: { id: input.serviceId, active: true },
      select: { id: true, durationMinutes: true }
    }),
    prisma.employee.findMany({
      where: { active: true, id: selectedEmployeeId },
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
    prisma.vacation.findMany({
      where: {
        employeeId: selectedEmployeeId,
        startDate: { lte: date },
        endDate: { gte: date }
      },
      select: { employeeId: true, startDate: true, endDate: true }
    }),
    prisma.workingHours.findMany({
      where: { employeeId: selectedEmployeeId, date },
      select: { employeeId: true, date: true, isWorking: true, startTime: true, endTime: true, breakStartTime: true, breakEndTime: true }
    }),
    prisma.booking.findMany({
      where: { employeeId: selectedEmployeeId, date, status: { not: "cancelled" } },
      select: { employeeId: true, date: true, startTime: true, endTime: true }
    })
  ]);
  if (!service || !employees.length) return [];

  const slots = buildSlotsForDate({
    date: input.date,
    employees,
    durationMinutes: service.durationMinutes,
    settings,
    vacations,
    workingHours,
    bookings
  });
  setCache(slotCache, cacheKey, slots, SLOT_CACHE_TTL_MS);
  return slots;
}

export async function listPublicAvailabilityDays(input: { serviceId: string; month: string; employeeId?: string | null }) {
  if (!process.env.DATABASE_URL) return [];

  const cacheKey = `${input.serviceId}:${input.month}:${input.employeeId ?? "any"}`;
  const cached = getCache(availabilityCache, cacheKey);
  if (cached) return cached;

  const [year, month] = input.month.split("-").map(Number);
  const start = toDateOnly(`${year}-${`${month}`.padStart(2, "0")}-01`);
  const end = toDateOnly(`${year}-${`${month}`.padStart(2, "0")}-${new Date(year, month, 0).getDate().toString().padStart(2, "0")}`);
  const today = isoDate(new Date());

  const selectedEmployeeId = input.employeeId && input.employeeId !== "any" ? input.employeeId : undefined;
  const [service, employees, settings, vacations, workingHours, bookings] = await Promise.all([
    prisma.service.findFirst({
      where: { id: input.serviceId, active: true },
      select: { id: true, durationMinutes: true }
    }),
    prisma.employee.findMany({
      where: { active: true, id: selectedEmployeeId },
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
    prisma.vacation.findMany({
      where: {
        employeeId: selectedEmployeeId,
        startDate: { lte: end },
        endDate: { gte: start }
      },
      select: { employeeId: true, startDate: true, endDate: true }
    }),
    prisma.workingHours.findMany({
      where: { employeeId: selectedEmployeeId, date: { gte: start, lte: end } },
      select: { employeeId: true, date: true, isWorking: true, startTime: true, endTime: true, breakStartTime: true, breakEndTime: true }
    }),
    prisma.booking.findMany({
      where: { employeeId: selectedEmployeeId, date: { gte: start, lte: end }, status: { not: "cancelled" } },
      select: { employeeId: true, date: true, startTime: true, endTime: true }
    })
  ]);

  if (!service || !employees.length) {
    const days = monthDates(year, month).map((date) => emptyAvailabilityDay(date, today));
    setCache(availabilityCache, cacheKey, days, AVAILABILITY_CACHE_TTL_MS);
    return days;
  }

  const days = monthDates(year, month).map((date) => {
    const value = isoDate(date);
    const isSunday = date.getUTCDay() === 0;
    const isPast = value < today;
    const slots =
      isSunday || isPast
        ? []
        : buildSlotsForDate({
            date: value,
            employees,
            durationMinutes: service.durationMinutes,
            settings,
            vacations,
            workingHours,
            bookings
          });

    return {
      date: value,
      available: slots.length > 0,
      isSunday,
      isPast
    };
  });
  setCache(availabilityCache, cacheKey, days, AVAILABILITY_CACHE_TTL_MS);
  return days;
}

export function clearPublicBookingCache() {
  slotCache.clear();
  availabilityCache.clear();
}

function getCache<T>(cache: Map<string, CacheEntry<T>>, key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number) {
  cache.set(key, { expiresAt: Date.now() + ttlMs, value });
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

function buildSlotsForDate({
  date,
  employees,
  durationMinutes,
  settings,
  vacations,
  workingHours,
  bookings
}: {
  date: string;
  employees: EmployeeLite[];
  durationMinutes: number;
  settings: {
    defaultStartTime: string;
    defaultEndTime: string;
    defaultBreakStartTime: string;
    defaultBreakEndTime: string;
  } | null;
  vacations: VacationLite[];
  workingHours: WorkingHoursLite[];
  bookings: BookingLite[];
}) {
  const dateOnly = toDateOnly(date);
  const todayIso = isoDate(new Date());
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const hoursByEmployee = new Map(workingHours.filter((row) => isoDate(row.date) === date).map((row) => [row.employeeId, row]));
  const bookingsByEmployee = new Map<string, BookingLite[]>();
  for (const booking of bookings) {
    if (isoDate(booking.date) !== date) continue;
    const list = bookingsByEmployee.get(booking.employeeId) ?? [];
    list.push(booking);
    bookingsByEmployee.set(booking.employeeId, list);
  }

  const slots: PublicBookingSlot[] = [];
  for (const employee of employees) {
    const vacation = vacations.some((row) => row.employeeId === employee.id && row.startDate <= dateOnly && row.endDate >= dateOnly);
    if (vacation) continue;

    const workingHour = hoursByEmployee.get(employee.id);
    const hours = workingHour
      ? {
          isWorking: workingHour.isWorking,
          startTime: workingHour.startTime,
          endTime: workingHour.endTime,
          breakStartTime: workingHour.breakStartTime,
          breakEndTime: workingHour.breakEndTime
        }
      : defaultHoursForDate(dateOnly, settings);

    if (!hours.isWorking || !hours.startTime || !hours.endTime) continue;

    const startBoundary = timeToMinutes(hours.startTime);
    const endBoundary = timeToMinutes(hours.endTime);
    const employeeBookings = bookingsByEmployee.get(employee.id) ?? [];

    for (let start = startBoundary; start + durationMinutes <= endBoundary; start += 15) {
      const end = start + durationMinutes;
      const startTime = minutesToTime(start);
      const endTime = minutesToTime(end);

      if (date === todayIso && start <= nowMinutes) continue;
      if (!isWithin(startTime, endTime, hours.startTime, hours.endTime)) continue;
      if (hours.breakStartTime && hours.breakEndTime && overlaps(startTime, endTime, hours.breakStartTime, hours.breakEndTime)) continue;
      if (employeeBookings.some((booking) => overlaps(startTime, endTime, booking.startTime, booking.endTime))) continue;

      slots.push({ employeeId: employee.id, employeeName: employee.name, startTime, endTime });
    }
  }

  return slots.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.employeeName.localeCompare(b.employeeName));
}

function monthDates(year: number, month: number) {
  const dates: Date[] = [];
  const endDay = new Date(year, month, 0).getDate();
  for (let day = 1; day <= endDay; day += 1) {
    dates.push(toDateOnly(`${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`));
  }
  return dates;
}

function emptyAvailabilityDay(date: Date, today: string) {
  const value = isoDate(date);
  return {
    date: value,
    available: false,
    isSunday: date.getUTCDay() === 0,
    isPast: value < today
  };
}
