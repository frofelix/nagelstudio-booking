import { addDays } from "date-fns";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getWeekStart, isoDate, toDateOnly } from "@/lib/date";
import { canUseEmployee } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { vacationCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const employeeId = request.nextUrl.searchParams.get("employeeId");
  if (!employeeId) return NextResponse.json({ error: "employeeId ist erforderlich" }, { status: 400 });

  if (!(await canUseEmployee(user, employeeId, "workingHours"))) {
    return NextResponse.json({ error: "Keine Berechtigung fuer diesen Urlaub" }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) return NextResponse.json({ vacations: [] });

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
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const payload = await request.json();
  const parsed = vacationCreateSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;
  if (!(await canUseEmployee(user, data.employeeId, "workingHours"))) {
    return NextResponse.json({ error: "Keine Berechtigung fuer diesen Urlaub" }, { status: 403 });
  }

  if (data.startDate < isoDate(new Date())) {
    return NextResponse.json({ error: "Urlaub kann nicht in der Vergangenheit starten." }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ vacation: { id: `local-vacation-${Date.now()}`, employeeName: "", ...data } }, { status: 201 });
  }

  const vacation = await prisma.vacation.create({
    data: {
      employeeId: data.employeeId,
      startDate: toDateOnly(data.startDate),
      endDate: toDateOnly(data.endDate),
      note: data.note || null
    },
    include: { employee: { select: { name: true } } }
  });

  const days = collectDates(data.startDate, data.endDate);
  await prisma.$transaction(
    days.map((date) =>
      prisma.workingHours.upsert({
        where: { employeeId_date: { employeeId: data.employeeId, date: toDateOnly(date) } },
        update: { isWorking: false, startTime: null, endTime: null, breakStartTime: null, breakEndTime: null },
        create: {
          employeeId: data.employeeId,
          weekStartDate: getWeekStart(date),
          date: toDateOnly(date),
          weekday: Math.max(1, Math.min(6, getWeekday(date))),
          isWorking: false,
          startTime: null,
          endTime: null,
          breakStartTime: null,
          breakEndTime: null
        }
      })
    )
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
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  const employeeId = request.nextUrl.searchParams.get("employeeId");
  if (!id || !employeeId) return NextResponse.json({ error: "id und employeeId sind erforderlich" }, { status: 400 });

  if (!(await canUseEmployee(user, employeeId, "workingHours"))) {
    return NextResponse.json({ error: "Keine Berechtigung fuer diesen Urlaub" }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) return NextResponse.json({ ok: true, demo: true });

  const result = await prisma.vacation.deleteMany({ where: { id, employeeId } });
  if (!result.count) return NextResponse.json({ error: "Urlaub nicht gefunden." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

function collectDates(startDate: string, endDate: string) {
  const dates: string[] = [];
  let current = toDateOnly(startDate);
  const end = toDateOnly(endDate);

  while (current <= end) {
    dates.push(isoDate(current));
    current = addDays(current, 1);
  }

  return dates;
}

function getWeekday(value: string) {
  const day = toDateOnly(value).getUTCDay();
  return day === 0 ? 7 : day;
}
