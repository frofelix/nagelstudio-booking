import { NextRequest, NextResponse } from "next/server";
import { validateBookingSlot } from "@/lib/booking-rules";
import { isoDate, toDateOnly } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { clearPublicBookingCache, listPublicBookingSlots } from "@/lib/public-booking";
import { minutesToTime, timeToMinutes } from "@/lib/time";
import { publicBookingCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const parsed = publicBookingCreateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Onlinebuchung ist noch nicht verbunden." }, { status: 503 });
  }

  const data = parsed.data;
  const service = await prisma.service.findFirst({
    where: { id: data.serviceId, active: true },
    select: { durationMinutes: true }
  });
  if (!service) return NextResponse.json({ error: "Service ist nicht verfügbar." }, { status: 404 });

  const endTime = minutesToTime(timeToMinutes(data.startTime) + service.durationMinutes);
  const availableSlots = await listPublicBookingSlots({ serviceId: data.serviceId, date: data.date, employeeId: data.employeeId });
  const stillAvailable = availableSlots.some((slot) => slot.employeeId === data.employeeId && slot.startTime === data.startTime && slot.endTime === endTime);

  if (!stillAvailable) {
    return NextResponse.json({ error: "Dieser Termin ist leider nicht mehr frei. Bitte wähle einen anderen Slot." }, { status: 409 });
  }

  const slotError = await validateBookingSlot({
    employeeId: data.employeeId,
    serviceId: data.serviceId,
    date: data.date,
    startTime: data.startTime,
    endTime
  });
  if (slotError) return NextResponse.json({ error: slotError }, { status: slotError.includes("ueberschneidet") ? 409 : 400 });

  const booking = await prisma.booking.create({
    data: {
      employeeId: data.employeeId,
      serviceId: data.serviceId,
      customerName: data.customerName,
      customerPhone: data.customerPhone || null,
      customerEmail: data.customerEmail || null,
      date: toDateOnly(data.date),
      startTime: data.startTime,
      endTime,
      notes: data.notes || null,
      source: "customer_widget",
      status: "confirmed"
    },
    include: { service: true, employee: true }
  });
  clearPublicBookingCache();

  return NextResponse.json(
    {
      booking: {
        id: booking.id,
        date: isoDate(booking.date),
        startTime: booking.startTime,
        endTime: booking.endTime,
        customerName: booking.customerName,
        serviceName: booking.service.name,
        employeeName: booking.employee.name
      }
    },
    { status: 201 }
  );
}
