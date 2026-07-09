import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { validateBookingSlot } from "@/lib/booking-rules";
import { isoDate } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { createStaffChatMessage, listStaffChatMessages } from "@/lib/staff-chat";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  if (!process.env.DATABASE_URL) return NextResponse.json({ messages: [] });

  const messages = await enrichMessages(await listStaffChatMessages(), user.employeeId);
  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const payload = await request.json();
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Nachricht ist erforderlich." }, { status: 400 });

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL ist fuer den Teamchat erforderlich." }, { status: 503 });
  }

  const chatMessage = await createStaffChatMessage({
    fromEmployeeId: user.employeeId,
    fromName: user.name,
    type: "message",
    message,
    status: "info"
  });

  return NextResponse.json({ message: chatMessage }, { status: 201 });
}

async function enrichMessages(messages: Awaited<ReturnType<typeof listStaffChatMessages>>, employeeId: string | null) {
  const bookingIds = Array.from(new Set(messages.map((message) => message.bookingId).filter(Boolean) as string[]));
  if (!bookingIds.length) return messages;

  const bookings = await prisma.booking.findMany({
    where: { id: { in: bookingIds } },
    include: { service: true, employee: true }
  });
  const bookingById = new Map(bookings.map((booking) => [booking.id, booking]));

  return Promise.all(
    messages.map(async (message) => {
      const booking = message.bookingId ? bookingById.get(message.bookingId) : null;
      if (!booking) return message;

      let canAccept = false;
      let canCancel = false;
      let acceptBlockedReason = "";
      if (message.type === "transfer_request" && message.status === "open" && employeeId) {
        if (booking.employeeId === employeeId) {
          acceptBlockedReason = "Eigener Termin";
        } else {
          const slotError = await validateBookingSlot({
            employeeId,
            serviceId: booking.serviceId,
            date: isoDate(booking.date),
            startTime: booking.startTime,
            endTime: booking.endTime,
            excludeBookingId: booking.id
          });
          canAccept = !slotError;
          acceptBlockedReason = slotError ?? "";
        }
      }
      if (message.type === "cancel_required" && message.status === "open") {
        canCancel = booking.status === "confirmed";
        acceptBlockedReason = canCancel ? "" : "Termin ist nicht mehr aktiv";
      }

      return {
        ...message,
        booking: {
          customerName: booking.customerName,
          date: isoDate(booking.date),
          startTime: booking.startTime,
          endTime: booking.endTime,
          serviceName: booking.service.name,
          employeeName: booking.employee.name
        },
        canAccept,
        canCancel,
        acceptBlockedReason
      };
    })
  );
}
