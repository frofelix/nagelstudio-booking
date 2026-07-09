import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { validateBookingSlot } from "@/lib/booking-rules";
import { isoDate, toDateOnly } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { bookingUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  const payload = await request.json();
  const parsed = bookingUpdateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL ist erforderlich." }, { status: 503 });
  }

  const { id, ...data } = parsed.data;
  const current = await prisma.booking.findUnique({
    where: { id },
    include: { employee: { select: { name: true } }, service: { select: { name: true } } }
  });

  if (!current) return NextResponse.json({ error: "Termin nicht gefunden." }, { status: 404 });

  const next = {
    employeeId: data.employeeId ?? current.employeeId,
    serviceId: data.serviceId ?? current.serviceId,
    date: data.date ?? isoDate(current.date),
    startTime: data.startTime ?? current.startTime,
    endTime: data.endTime ?? current.endTime,
    status: data.status ?? current.status
  };

  const slotFieldsChanged =
    data.employeeId !== undefined ||
    data.serviceId !== undefined ||
    data.date !== undefined ||
    data.startTime !== undefined ||
    data.endTime !== undefined ||
    data.status === "confirmed";

  if (next.status === "confirmed" && slotFieldsChanged) {
    const slotError = await validateBookingSlot({ ...next, excludeBookingId: id });
    if (slotError) return NextResponse.json({ error: slotError }, { status: slotError.includes("ueberschneidet") ? 409 : 400 });
  }

  const booking = await prisma.booking.update({
    where: { id },
    data: {
      employeeId: data.employeeId,
      serviceId: data.serviceId,
      customerName: data.customerName,
      customerPhone: data.customerPhone === undefined ? undefined : data.customerPhone || null,
      customerEmail: data.customerEmail === undefined ? undefined : data.customerEmail || null,
      date: data.date ? toDateOnly(data.date) : undefined,
      startTime: data.startTime,
      endTime: data.endTime,
      status: data.status,
      notes: data.notes === undefined ? undefined : data.notes || null
    },
    include: {
      employee: { select: { name: true } },
      service: { select: { name: true } }
    }
  });

  return NextResponse.json({ booking: mapAdminBooking(booking) });
}

export async function DELETE(request: NextRequest) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id ist erforderlich" }, { status: 400 });

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: true, demo: true });
  }

  const booking = await prisma.booking.update({
    where: { id },
    data: { status: "cancelled" },
    include: {
      employee: { select: { name: true } },
      service: { select: { name: true } }
    }
  });

  return NextResponse.json({ booking: mapAdminBooking(booking) });
}

function mapAdminBooking(booking: {
  id: string;
  employeeId: string;
  serviceId: string;
  customerName: string;
  date: Date;
  startTime: string;
  endTime: string;
  status: "confirmed" | "cancelled" | "completed" | "no_show";
  notes: string | null;
  employee: { name: string };
  service: { name: string };
}) {
  return {
    id: booking.id,
    employeeId: booking.employeeId,
    serviceId: booking.serviceId,
    customerName: booking.customerName,
    date: isoDate(booking.date),
    startTime: booking.startTime,
    endTime: booking.endTime,
    status: booking.status,
    notes: booking.notes,
    employeeName: booking.employee.name,
    serviceName: booking.service.name
  };
}
