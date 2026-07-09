import { NextRequest, NextResponse } from "next/server";
import { addDays } from "date-fns";
import { demoAdminSummary } from "@/lib/admin-data";
import { requireAdminApi } from "@/lib/auth";
import { getWeekStart, isoDate, toDateOnly } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { vacationCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  const employeeId = request.nextUrl.searchParams.get("employeeId");

  if (!employeeId) {
    return NextResponse.json({ error: "employeeId ist erforderlich" }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ vacations: demoAdminSummary.vacations.filter((vacation) => vacation.employeeId === employeeId) });
  }

  const vacations = await prisma.vacation.findMany({
    where: { employeeId },
    include: { employee: { select: { name: true } } },
    orderBy: { startDate: "asc" }
  });

  return NextResponse.json({
    vacations: vacations.map((vacation) => ({
      id: vacation.id,
      employeeId: vacation.employeeId,
      employeeName: vacation.employee.name,
      startDate: isoDate(vacation.startDate),
      endDate: isoDate(vacation.endDate),
      note: vacation.note
    }))
  });
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  const payload = await request.json();
  const parsed = vacationCreateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    const employee = demoAdminSummary.employees.find((entry) => entry.id === parsed.data.employeeId);
    return NextResponse.json(
      {
        vacation: {
          id: `local-vacation-${Date.now()}`,
          employeeId: parsed.data.employeeId,
          employeeName: employee?.name ?? "Mitarbeiter",
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
          note: parsed.data.note || "Urlaub"
        }
      },
      { status: 201 }
    );
  }

  const vacation = await prisma.vacation.create({
    data: {
      employeeId: parsed.data.employeeId,
      startDate: toDateOnly(parsed.data.startDate),
      endDate: toDateOnly(parsed.data.endDate),
      note: parsed.data.note || null
    },
    include: { employee: { select: { name: true } } }
  });

  const days = collectDates(parsed.data.startDate, parsed.data.endDate);
  await prisma.$transaction(
    days.map((day) => {
      const date = new Date(`${day}T00:00:00`);
      const weekday = date.getDay() === 0 ? 7 : date.getDay();

      return prisma.workingHours.upsert({
        where: { employeeId_date: { employeeId: parsed.data.employeeId, date: toDateOnly(day) } },
        update: {
          isWorking: false,
          startTime: null,
          endTime: null,
          breakStartTime: null,
          breakEndTime: null
        },
        create: {
          employeeId: parsed.data.employeeId,
          weekStartDate: toDateOnly(isoDate(getWeekStart(date))),
          date: toDateOnly(day),
          weekday,
          isWorking: false
        }
      });
    })
  );

  return NextResponse.json(
    {
      vacation: {
        id: vacation.id,
        employeeId: vacation.employeeId,
        employeeName: vacation.employee.name,
        startDate: isoDate(vacation.startDate),
        endDate: isoDate(vacation.endDate),
        note: vacation.note
      }
    },
    { status: 201 }
  );
}

export async function DELETE(request: NextRequest) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id ist erforderlich" }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: true });
  }

  await prisma.vacation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

function collectDates(startDate: string, endDate: string) {
  const dates: string[] = [];
  const end = new Date(`${endDate}T00:00:00`);

  for (let current = new Date(`${startDate}T00:00:00`); current <= end; current = addDays(current, 1)) {
    dates.push(isoDate(current));
  }

  return dates;
}
