"use client";

import { CalendarX2, Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { isoDate } from "@/lib/date";
import { BookingDto } from "@/lib/types";
import { timeToMinutes } from "@/lib/time";

type DayCalendarProps = {
  bookings: BookingDto[];
  loading?: boolean;
  isPastDay?: boolean;
  selectedDate?: Date;
  showEmployeeNames?: boolean;
  onSelectBooking?: (booking: BookingDto) => void;
};

const startHour = 8;
const defaultEndHour = 19;
const hourHeight = 48;

function blockStyle(startTime: string, endTime: string, visibleStartHour: number) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const top = ((start - visibleStartHour * 60) / 60) * hourHeight;
  const height = Math.max(30, ((end - start) / 60) * hourHeight - 4);
  return { top, height };
}

export function DayCalendar({ bookings, loading = false, isPastDay = false, selectedDate, showEmployeeNames = false, onSelectBooking }: DayCalendarProps) {
  const [now, setNow] = useState<Date | null>(null);
  const isToday = now && selectedDate ? isoDate(selectedDate) === isoDate(now) : false;
  const nowMinutes = now ? now.getHours() * 60 + now.getMinutes() : null;
  const visibleEndHour = useMemo(() => {
    if (!isToday || nowMinutes === null) return defaultEndHour;
    return Math.max(defaultEndHour, Math.min(23, Math.ceil(nowMinutes / 60)));
  }, [isToday, nowMinutes]);
  const hours = Array.from({ length: visibleEndHour - startHour + 1 }, (_, index) => startHour + index);
  const calendarHeight = (visibleEndHour - startHour + 1) * hourHeight;
  const showNowLine = Boolean(isToday && nowMinutes !== null && nowMinutes >= startHour * 60 && nowMinutes <= (visibleEndHour + 1) * 60);
  const nowTop = nowMinutes === null ? 0 : ((nowMinutes - startHour * 60) / 60) * hourHeight;
  const nowLabel = now ? `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}` : "";

  useEffect(() => {
    setNow(new Date());
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className={`relative mx-4 mt-4 overflow-hidden rounded-[28px] pb-[112px] shadow-sm ring-1 ring-neutral-200/70 ${isPastDay ? "bg-neutral-100" : "bg-white"}`}>
      {isPastDay ? (
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-[13px] font-semibold text-neutral-500 ring-1 ring-neutral-200">
          <Lock size={16} />
          Vergangener Tag - nur ansehen, nicht bearbeiten.
        </div>
      ) : null}
      <div className="grid grid-cols-[62px_1fr] pt-3">
        <div>
          {hours.map((hour) => (
            <div key={hour} className={`h-12 pr-3 text-right text-[13px] font-medium leading-none ${isPastDay ? "text-neutral-400" : "text-neutral-500"}`}>
              {hour.toString().padStart(2, "0")}:00
            </div>
          ))}
        </div>
        <div className="calendar-grid-bg relative border-l border-neutral-200/80" style={{ minHeight: calendarHeight }}>
          {loading ? (
            <div className="mx-4 mt-10 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-center text-sm font-semibold text-neutral-500">
              Termine werden geladen...
            </div>
          ) : bookings.length === 0 ? (
            <div className="mx-4 mt-10 flex flex-col items-center rounded-3xl border border-dashed border-neutral-300 bg-white/85 p-5 text-center text-sm text-neutral-500">
              <span className="mb-2 grid h-11 w-11 place-items-center rounded-full bg-neutral-100 text-neutral-500">
                <CalendarX2 size={21} />
              </span>
              <span className="font-bold text-neutral-800">Keine Termine</span>
              <span className="mt-1 text-[12px] font-medium">Der Tag ist frei geplant.</span>
            </div>
          ) : null}

          {bookings.map((booking) => (
            <button
              key={booking.id}
              type="button"
              onClick={() => onSelectBooking?.(booking)}
              className={`absolute left-3 right-4 rounded-2xl border px-3 py-2 shadow-sm ${
                isPastDay ? "border-neutral-200 bg-neutral-100 text-neutral-500" : "soft-card border-neutral-200 hover:border-neutral-300"
              } text-left transition active:scale-[0.99]`}
              style={blockStyle(booking.startTime, booking.endTime, startHour)}
            >
              <div className="flex h-full items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold leading-5">{booking.customerName}</p>
                  <p className={`truncate text-[12px] font-medium leading-4 ${isPastDay ? "text-neutral-500" : "text-neutral-700"}`}>
                    {booking.service.name}
                    {showEmployeeNames ? ` · ${booking.employee.name}` : ""}
                  </p>
                </div>
                <p className="shrink-0 rounded-full bg-white/70 px-2 py-1 text-[12px] font-bold text-neutral-900 ring-1 ring-neutral-200/70">
                  {booking.startTime} - {booking.endTime}
                </p>
              </div>
            </button>
          ))}

          {showNowLine ? (
            <div className="pointer-events-none absolute left-0 right-0 z-10" style={{ top: nowTop }}>
              <div className="relative h-0">
                <span className="absolute -left-[58px] -top-[9px] w-[48px] text-right text-[12px] font-bold text-red-500">{nowLabel}</span>
                <span className="absolute -left-[5px] -top-[5px] h-[10px] w-[10px] rounded-full bg-red-500 shadow-sm" />
                <span className="block h-[2px] w-full bg-red-500" />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
