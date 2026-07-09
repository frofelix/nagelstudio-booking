import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isoDate } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { createStaffChatMessage, findStaffChatMessage, updateStaffChatMessageStatus } from "@/lib/staff-chat";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const payload = await request.json();
  const messageId = typeof payload.id === "string" ? payload.id : "";
  if (!messageId) return NextResponse.json({ error: "Chat-Aufgabe ist erforderlich." }, { status: 400 });

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL ist fuer Terminabsagen erforderlich." }, { status: 503 });
  }

  const chatMessage = await findStaffChatMessage(messageId);
  if (!chatMessage || chatMessage.type !== "cancel_required" || !chatMessage.bookingId) {
    return NextResponse.json({ error: "Absage-Aufgabe nicht gefunden." }, { status: 404 });
  }
  if (chatMessage.status !== "open") return NextResponse.json({ error: "Absage-Aufgabe ist bereits erledigt." }, { status: 409 });

  const booking = await prisma.booking.findUnique({
    where: { id: chatMessage.bookingId },
    include: { service: true, employee: true }
  });
  if (!booking) return NextResponse.json({ error: "Termin nicht gefunden." }, { status: 404 });

  const notes = appendStudioCancellationNote(booking.notes);
  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "cancelled", notes },
    include: { service: true, employee: true }
  });

  await updateStaffChatMessageStatus(messageId, "accepted");
  await createStaffChatMessage({
    bookingId: booking.id,
    fromEmployeeId: user.employeeId,
    fromName: user.name,
    type: "sick_notice",
    status: "info",
    message: `${user.name} hat den Termin ${booking.startTime}-${booking.endTime} fuer ${booking.customerName} abgesagt.`
  });

  return NextResponse.json({
    booking: {
      id: updated.id,
      employeeId: updated.employeeId,
      customerName: updated.customerName,
      customerEmail: updated.customerEmail,
      customerPhone: updated.customerPhone,
      date: isoDate(updated.date),
      startTime: updated.startTime,
      endTime: updated.endTime,
      status: updated.status,
      notes: updated.notes,
      service: updated.service,
      employee: { id: updated.employee.id, name: updated.employee.name }
    },
    mail: {
      sent: false,
      reason: "disabled"
    }
  });
}

function appendStudioCancellationNote(existing: string | null) {
  const line = `${new Date().toISOString()}: Vom Studio abgesagt (Krankmeldung), keine Ausfallpauschale`;
  return existing ? `${existing}\n${line}` : line;
}
