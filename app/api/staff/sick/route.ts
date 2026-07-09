import { NextRequest, NextResponse } from "next/server";
import { getWeekStart, isoDate, toDateOnly } from "@/lib/date";
import { getCurrentUser } from "@/lib/auth";
import { validateBookingSlot } from "@/lib/booking-rules";
import { canUseEmployee } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createStaffChatMessage } from "@/lib/staff-chat";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const payload = await request.json();
  const employeeId = typeof payload.employeeId === "string" ? payload.employeeId : user.employeeId;
  const date = typeof payload.date === "string" ? payload.date : isoDate(new Date());
  const note = typeof payload.note === "string" && payload.note.trim() ? payload.note.trim() : "Krank";

  if (!employeeId) return NextResponse.json({ error: "Mitarbeiter ist erforderlich." }, { status: 400 });
  if (date < isoDate(new Date())) return NextResponse.json({ error: "Vergangene Tage koennen nicht krank gemeldet werden." }, { status: 400 });
  if (!(await canUseEmployee(user, employeeId, "workingHours"))) {
    return NextResponse.json({ error: "Keine Berechtigung fuer diese Krankmeldung." }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL ist fuer Krankmeldungen erforderlich." }, { status: 503 });
  }

  const targetEmployee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, name: true } });
  if (!targetEmployee) return NextResponse.json({ error: "Mitarbeiter nicht gefunden." }, { status: 404 });

  await prisma.vacation.create({
    data: {
      employeeId,
      startDate: toDateOnly(date),
      endDate: toDateOnly(date),
      note
    }
  });

  await prisma.workingHours.upsert({
    where: { employeeId_date: { employeeId, date: toDateOnly(date) } },
    update: { isWorking: false, startTime: null, endTime: null, breakStartTime: null, breakEndTime: null },
    create: {
      employeeId,
      weekStartDate: getWeekStart(date),
      date: toDateOnly(date),
      weekday: Math.max(1, Math.min(6, getWeekday(date))),
      isWorking: false,
      startTime: null,
      endTime: null,
      breakStartTime: null,
      breakEndTime: null
    }
  });

  const bookings = await prisma.booking.findMany({
    where: { employeeId, date: toDateOnly(date), status: "confirmed" },
    include: { service: true, employee: true },
    orderBy: { startTime: "asc" }
  });
  const candidates = await prisma.employee.findMany({
    where: { active: true, id: { not: employeeId } },
    orderBy: { name: "asc" },
    select: { id: true, name: true }
  });

  const requested: string[] = [];
  const cancellationRequired: string[] = [];

  await createStaffChatMessage({
    fromEmployeeId: user.employeeId,
    fromName: user.name,
    type: "sick_notice",
    status: "info",
    message: `${targetEmployee.name} ist am ${formatDate(toDateOnly(date))} krank gemeldet. ${bookings.length} Termin${bookings.length === 1 ? "" : "e"} werden im Chat verteilt.`
  });

  for (const booking of bookings) {
    let availableCount = 0;
    for (const candidate of candidates) {
      const slotError = await validateBookingSlot({
        employeeId: candidate.id,
        serviceId: booking.serviceId,
        date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        excludeBookingId: booking.id
      });
      if (!slotError) {
        availableCount += 1;
      }
    }

    if (availableCount > 0) {
      requested.push(booking.id);
      await createStaffChatMessage({
        bookingId: booking.id,
        fromEmployeeId: user.employeeId,
        fromName: user.name,
        type: "transfer_request",
        status: "open",
        message: `${targetEmployee.name} ist krank: Wer kann ${booking.service.name} am ${formatDate(toDateOnly(date))} ${booking.startTime}-${booking.endTime} fuer ${booking.customerName} uebernehmen?`
      });
    } else {
      cancellationRequired.push(booking.id);
      await createStaffChatMessage({
        bookingId: booking.id,
        fromEmployeeId: user.employeeId,
        fromName: user.name,
        type: "cancel_required",
        status: "open",
        message: `${targetEmployee.name} ist krank und niemand hat fuer diesen Termin einen freien Slot.`
      });
    }
  }

  return NextResponse.json({
    ok: true,
    employeeName: targetEmployee.name,
    date,
    reassignedCount: 0,
    requestedCount: requested.length,
    cancellationRequiredCount: cancellationRequired.length,
    affectedCount: bookings.length
  });
}

function getWeekday(value: string) {
  const day = toDateOnly(value).getUTCDay();
  return day === 0 ? 7 : day;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}
