import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isoDate, toDateOnly } from "@/lib/date";
import { getCurrentUser } from "@/lib/auth";
import { validateBookingSlot } from "@/lib/booking-rules";
import { canUseEmployee } from "@/lib/permissions";
import { bookingCreateSchema, bookingUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const employeeId = params.get("employeeId");
  const from = params.get("from");
  const to = params.get("to");

  if (!employeeId || !from || !to) {
    return NextResponse.json({ error: "employeeId, from und to sind erforderlich" }, { status: 400 });
  }

  const wantsAllEmployees = employeeId === "all";
  const canSeeAllEmployees = user.role === "owner" || user.role === "admin";

  if (wantsAllEmployees && !canSeeAllEmployees) {
    return NextResponse.json({ error: "Keine Berechtigung fuer alle Kalender" }, { status: 403 });
  }

  if (!wantsAllEmployees && !(await canUseEmployee(user, employeeId, "bookings"))) {
    return NextResponse.json({ error: "Keine Berechtigung fuer diesen Kalender" }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ bookings: [] });
  }

  const bookings = await prisma.booking.findMany({
    where: {
      employeeId: wantsAllEmployees ? undefined : employeeId,
      date: {
        gte: toDateOnly(from),
        lte: toDateOnly(to)
      },
      status: { not: "cancelled" }
    },
    include: {
      service: true,
      employee: true
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }]
  });

  return NextResponse.json({ bookings });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const payload = await request.json();
  const parsed = bookingCreateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const date = toDateOnly(data.date);

  if (!(await canUseEmployee(user, data.employeeId, "bookings"))) {
    return NextResponse.json({ error: "Keine Berechtigung fuer diesen Mitarbeiter" }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL ist fuer das Speichern von Terminen erforderlich." }, { status: 503 });
  }

  const slotError = await validateBookingSlot(data);
  if (slotError) {
    return NextResponse.json({ error: slotError }, { status: slotError.includes("ueberschneidet") ? 409 : 400 });
  }

  const booking = await prisma.booking.create({
    data: {
      employeeId: data.employeeId,
      serviceId: data.serviceId,
      customerName: data.customerName,
      customerPhone: data.customerPhone || null,
      customerEmail: data.customerEmail || null,
      date,
      startTime: data.startTime,
      endTime: data.endTime,
      notes: data.notes || null,
      source: "manual_staff",
      status: "confirmed"
    },
    include: {
      service: true,
      employee: true
    }
  });

  return NextResponse.json({ booking }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const payload = await request.json();
  const parsed = bookingUpdateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, status, cancellationWindow } = parsed.data;
  const isStatusAction = status === "cancelled" || status === "no_show";

  if (status && !isStatusAction && status !== "confirmed" && status !== "completed") {
    return NextResponse.json({ error: "Ungueltiger Terminstatus." }, { status: 400 });
  }

  if (status === "cancelled" && !cancellationWindow) {
    return NextResponse.json({ error: "Bitte auswaehlen, ob die Absage unter oder ueber 24 Stunden war." }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL ist fuer das Aendern von Terminen erforderlich." }, { status: 503 });
  }

  const current = await prisma.booking.findUnique({
    where: { id },
    include: {
      employee: true,
      service: true
    }
  });

  if (!current) return NextResponse.json({ error: "Termin nicht gefunden." }, { status: 404 });

  if (!(await canUseEmployee(user, current.employeeId, "bookings"))) {
    return NextResponse.json({ error: "Keine Berechtigung fuer diesen Termin" }, { status: 403 });
  }

  if (isStatusAction) {
    if (status === "no_show" && bookingStartDate(current.date, current.startTime) > new Date()) {
      return NextResponse.json({ error: "Nicht erschienen kann erst ab Terminbeginn gesetzt werden." }, { status: 400 });
    }

    const feeApplies = status === "no_show" || cancellationWindow === "under_24h";
    const notes = appendStatusNote(current.notes, status, feeApplies, cancellationWindow);

    const booking = await prisma.booking.update({
      where: { id },
      data: { status, notes },
      include: {
        service: true,
        employee: true
      }
    });

    return NextResponse.json({
      booking,
      fee: {
        applies: feeApplies,
        amountCents: feeApplies ? 2000 : 0
      },
      mail: {
        sent: false,
        reason: "disabled"
      }
    });
  }

  const next = {
    employeeId: parsed.data.employeeId ?? current.employeeId,
    serviceId: parsed.data.serviceId ?? current.serviceId,
    customerName: parsed.data.customerName ?? current.customerName,
    customerPhone: parsed.data.customerPhone === undefined ? current.customerPhone : parsed.data.customerPhone || null,
    customerEmail: parsed.data.customerEmail === undefined ? current.customerEmail : parsed.data.customerEmail || null,
    date: parsed.data.date ?? isoDate(current.date),
    startTime: parsed.data.startTime ?? current.startTime,
    endTime: parsed.data.endTime ?? current.endTime,
    notes: parsed.data.notes === undefined ? current.notes : parsed.data.notes || null,
    status: status ?? current.status
  };

  if (!(await canUseEmployee(user, next.employeeId, "bookings"))) {
    return NextResponse.json({ error: "Keine Berechtigung fuer diesen Mitarbeiter" }, { status: 403 });
  }

  const slotError = await validateBookingSlot({
    employeeId: next.employeeId,
    serviceId: next.serviceId,
    date: next.date,
    startTime: next.startTime,
    endTime: next.endTime,
    excludeBookingId: id
  });

  if (slotError) {
    return NextResponse.json({ error: slotError }, { status: slotError.includes("ueberschneidet") ? 409 : 400 });
  }

  const booking = await prisma.booking.update({
    where: { id },
    data: {
      employeeId: next.employeeId,
      serviceId: next.serviceId,
      customerName: next.customerName,
      customerPhone: next.customerPhone,
      customerEmail: next.customerEmail,
      date: toDateOnly(next.date),
      startTime: next.startTime,
      endTime: next.endTime,
      notes: next.notes,
      status: next.status
    },
    include: {
      service: true,
      employee: true
    }
  });

  return NextResponse.json({ booking });
}

function bookingStartDate(date: Date, startTime: string) {
  return new Date(`${isoDate(date)}T${startTime}:00`);
}

function appendStatusNote(existing: string | null, status: "cancelled" | "no_show", feeApplies: boolean, cancellationWindow?: "under_24h" | "over_24h" | "studio_cancelled") {
  const label = status === "no_show" ? "Nicht erschienen" : cancellationWindow === "studio_cancelled" ? "Vom Studio abgesagt" : "Kunde hat abgesagt";
  const windowLabel = cancellationWindow === "under_24h" ? "unter 24h" : cancellationWindow === "over_24h" ? "ueber 24h" : cancellationWindow === "studio_cancelled" ? "Studio-Absage" : "nicht erschienen";
  const fee = feeApplies ? "20 EUR Ausfallpauschale" : "keine Ausfallpauschale";
  const line = `${new Date().toISOString()}: ${label} (${windowLabel}), ${fee}`;
  return existing ? `${existing}\n${line}` : line;
}
