import { addDays, format, getISOWeek, isSameDay, parseISO, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";

export function toDateOnly(value: Date | string) {
  const date = typeof value === "string" ? parseISO(value) : value;
  return new Date(`${format(date, "yyyy-MM-dd")}T00:00:00.000Z`);
}

export function isoDate(value: Date | string) {
  const date = typeof value === "string" ? parseISO(value) : value;
  return format(date, "yyyy-MM-dd");
}

export function getWeekStart(value: Date | string) {
  const date = typeof value === "string" ? parseISO(value) : value;
  return toDateOnly(startOfWeek(date, { weekStartsOn: 1 }));
}

export function getWeekDays(weekStart: Date) {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export function getWorkWeekDays(weekStart: Date) {
  return Array.from({ length: 6 }, (_, index) => addDays(weekStart, index));
}

export function getDefaultCalendarDate(value = new Date()) {
  return value.getDay() === 0 ? addDays(value, 1) : value;
}

export function formatMonth(value: Date) {
  return format(value, "MMMM yyyy", { locale: de });
}

export function formatWeekRange(start: Date, includeSunday = true) {
  const end = addDays(start, includeSunday ? 6 : 5);
  const sameMonth = format(start, "MMMM yyyy", { locale: de }) === format(end, "MMMM yyyy", { locale: de });
  if (sameMonth) {
    return `${format(start, "d.", { locale: de })}-${format(end, "d. MMMM yyyy", { locale: de })}`;
  }

  return `${format(start, "d. MMM", { locale: de })}-${format(end, "d. MMM yyyy", { locale: de })}`;
}

export function formatLongDate(value: Date) {
  return format(value, "EEEE, d. MMMM yyyy", { locale: de });
}

export function weekNumber(value: Date) {
  return getISOWeek(value);
}

export function sameDate(a: Date, b: Date) {
  return isSameDay(a, b);
}
