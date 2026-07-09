import { NextResponse } from "next/server";
import { demoAdminSummary } from "@/lib/admin-data";
import { requireAdminApi } from "@/lib/auth";
import { isoDate } from "@/lib/date";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const authError = await requireAdminApi();
  if (authError) return authError;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(demoAdminSummary);
  }

  try {
    const [settings, employees, services, vacations, bookings] = await Promise.all([
      prisma.businessSettings.findUnique({ where: { id: "default" } }),
      prisma.employee.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
      prisma.service.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
      prisma.vacation.findMany({
        include: { employee: { select: { name: true } } },
        orderBy: { startDate: "asc" },
        take: 12
      }),
      prisma.booking.findMany({
        where: { status: { not: "cancelled" } },
        include: {
          employee: { select: { name: true } },
          service: { select: { name: true } }
        },
        orderBy: [{ date: "desc" }, { startTime: "asc" }],
        take: 8
      })
    ]);

    return NextResponse.json({
      settings: {
        studioName: settings?.studioName ?? demoAdminSummary.settings.studioName,
        defaultStartTime: settings?.defaultStartTime ?? demoAdminSummary.settings.defaultStartTime,
        defaultEndTime: settings?.defaultEndTime ?? demoAdminSummary.settings.defaultEndTime,
        defaultBreakStartTime: settings?.defaultBreakStartTime ?? demoAdminSummary.settings.defaultBreakStartTime,
        defaultBreakEndTime: settings?.defaultBreakEndTime ?? demoAdminSummary.settings.defaultBreakEndTime
      },
      employees,
      services,
      vacations: vacations.map((vacation) => ({
        id: vacation.id,
        employeeId: vacation.employeeId,
        employeeName: vacation.employee.name,
        startDate: isoDate(vacation.startDate),
        endDate: isoDate(vacation.endDate),
        note: vacation.note
      })),
      bookings: bookings.map((booking) => ({
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
      }))
    });
  } catch {
    return NextResponse.json(demoAdminSummary);
  }
}
