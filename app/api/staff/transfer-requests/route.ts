import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { validateBookingSlot } from "@/lib/booking-rules";
import { isoDate } from "@/lib/date";
import { canUseEmployee } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createStaffChatMessage, findStaffChatMessage, updateStaffChatMessageStatus } from "@/lib/staff-chat";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const bookingId = request.nextUrl.searchParams.get("bookingId");
  if (!bookingId) return NextResponse.json({ error: "Termin ist erforderlich." }, { status: 400 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ availableCount: 0, availableEmployees: [] });

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { employee: true, service: true }
  });

  if (!booking) return NextResponse.json({ error: "Termin nicht gefunden." }, { status: 404 });
  if (!(await canUseEmployee(user, booking.employeeId, "bookings"))) {
    return NextResponse.json({ error: "Keine Berechtigung fuer diesen Termin." }, { status: 403 });
  }

  const availableEmployees = await findAvailableEmployeesForBooking(booking);
  return NextResponse.json({
    availableCount: availableEmployees.length,
    availableEmployees
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const payload = await request.json();
  const bookingId = typeof payload.bookingId === "string" ? payload.bookingId : "";
  if (!bookingId) return NextResponse.json({ error: "Termin ist erforderlich." }, { status: 400 });

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL ist fuer Uebernahme-Anfragen erforderlich." }, { status: 503 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { employee: true, service: true }
  });

  if (!booking) return NextResponse.json({ error: "Termin nicht gefunden." }, { status: 404 });
  if (!(await canUseEmployee(user, booking.employeeId, "bookings"))) {
    return NextResponse.json({ error: "Keine Berechtigung fuer diesen Termin." }, { status: 403 });
  }

  const availableEmployees = await findAvailableEmployeesForBooking(booking);
  if (!availableEmployees.length) {
    return NextResponse.json({ error: "Kein anderer Mitarbeiter ist fuer diesen Termin frei." }, { status: 409 });
  }

  const message = await createStaffChatMessage({
    bookingId,
    fromEmployeeId: user.employeeId,
    fromName: user.name,
    type: "transfer_request",
    status: "open",
    message: `${booking.service.name} am ${formatDate(booking.date)} ${booking.startTime}-${booking.endTime} fuer ${booking.customerName}`
  });

  return NextResponse.json({ message }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.employeeId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const payload = await request.json();
  const requestId = typeof payload.id === "string" ? payload.id : "";
  if (!requestId) return NextResponse.json({ error: "Anfrage ist erforderlich." }, { status: 400 });

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL ist fuer Uebernahme-Anfragen erforderlich." }, { status: 503 });
  }

  const chatMessage = await findStaffChatMessage(requestId);
  if (!chatMessage || chatMessage.type !== "transfer_request" || !chatMessage.bookingId) {
    return NextResponse.json({ error: "Anfrage nicht gefunden." }, { status: 404 });
  }
  if (chatMessage.status !== "open") return NextResponse.json({ error: "Anfrage ist nicht mehr offen." }, { status: 409 });

  const booking = await prisma.booking.findUnique({
    where: { id: chatMessage.bookingId },
    include: { service: true, employee: true }
  });
  if (!booking) return NextResponse.json({ error: "Termin nicht gefunden." }, { status: 404 });
  if (booking.employeeId === user.employeeId) return NextResponse.json({ error: "Der Termin liegt bereits bei dir." }, { status: 400 });

  const slotError = await validateBookingSlot({
    employeeId: user.employeeId,
    serviceId: booking.serviceId,
    date: isoDate(booking.date),
    startTime: booking.startTime,
    endTime: booking.endTime,
    excludeBookingId: booking.id
  });
  if (slotError) return NextResponse.json({ error: slotError }, { status: slotError.includes("ueberschneidet") ? 409 : 400 });

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { employeeId: user.employeeId },
    include: { service: true, employee: true }
  });

  await updateStaffChatMessageStatus(requestId, "accepted");
  await createStaffChatMessage({
    bookingId: booking.id,
    fromEmployeeId: user.employeeId,
    fromName: user.name,
    type: "transfer_accepted",
    status: "info",
    message: `${user.name} hat den Termin ${booking.startTime}-${booking.endTime} uebernommen.`
  });

  return NextResponse.json({ booking: mapBooking(updated) });
}

function mapBooking(booking: {
  id: string;
  employeeId: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  date: Date;
  startTime: string;
  endTime: string;
  status: "confirmed" | "cancelled" | "completed" | "no_show";
  notes: string | null;
  service: { id: string; name: string; durationMinutes: number };
  employee: { id: string; name: string };
}) {
  return {
    id: booking.id,
    employeeId: booking.employeeId,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    customerPhone: booking.customerPhone,
    date: isoDate(booking.date),
    startTime: booking.startTime,
    endTime: booking.endTime,
    status: booking.status,
    notes: booking.notes,
    service: booking.service,
    employee: { id: booking.employee.id, name: booking.employee.name }
  };
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

async function findAvailableEmployeesForBooking(booking: {
  id: string;
  employeeId: string;
  serviceId: string;
  date: Date;
  startTime: string;
  endTime: string;
}) {
  const candidates = await prisma.employee.findMany({
    where: { active: true, id: { not: booking.employeeId } },
    orderBy: { name: "asc" },
    select: { id: true, name: true }
  });

  const available: Array<{ id: string; name: string }> = [];
  for (const candidate of candidates) {
    const slotError = await validateBookingSlot({
      employeeId: candidate.id,
      serviceId: booking.serviceId,
      date: isoDate(booking.date),
      startTime: booking.startTime,
      endTime: booking.endTime,
      excludeBookingId: booking.id
    });
    if (!slotError) available.push(candidate);
  }
  return available;
}
