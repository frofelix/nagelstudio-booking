import { addDays } from "date-fns";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { businessDefaults } from "@/lib/constants";
import { isoDate, toDateOnly } from "@/lib/date";
import { getCurrentUser } from "@/lib/auth";
import { canUseEmployee } from "@/lib/permissions";
import { workingHoursSaveSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

function defaultDays(
  employeeId: string,
  weekStartDate: string,
  settings = businessDefaults
) {
  const start = toDateOnly(weekStartDate);

  return Array.from({ length: 6 }, (_, index) => {
    const isWorking = index < 5;
    const date = addDays(start, index);
    return {
      id: `default-${employeeId}-${isoDate(date)}`,
      employeeId,
      weekStartDate: isoDate(start),
      date: isoDate(date),
      weekday: index + 1,
      isWorking,
      startTime: isWorking ? settings.startTime : null,
      endTime: isWorking ? settings.endTime : null,
      breakStartTime: isWorking ? settings.breakStartTime : null,
      breakEndTime: isWorking ? settings.breakEndTime : null
    };
  });
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const employeeId = params.get("employeeId");
  const weekStartDate = params.get("weekStartDate");

  if (!employeeId || !weekStartDate) {
    return NextResponse.json({ error: "employeeId und weekStartDate sind erforderlich" }, { status: 400 });
  }

  if (!(await canUseEmployee(user, employeeId, "workingHours"))) {
    return NextResponse.json({ error: "Keine Berechtigung fuer diese Arbeitszeiten" }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ workingHours: defaultDays(employeeId, weekStartDate) });
  }

  const settings = await prisma.businessSettings.findUnique({ where: { id: "default" } });
  const defaults = {
    startTime: settings?.defaultStartTime ?? businessDefaults.startTime,
    endTime: settings?.defaultEndTime ?? businessDefaults.endTime,
    breakStartTime: settings?.defaultBreakStartTime ?? businessDefaults.breakStartTime,
    breakEndTime: settings?.defaultBreakEndTime ?? businessDefaults.breakEndTime
  };

  const rows = await prisma.workingHours.findMany({
    where: {
      employeeId,
      weekStartDate: toDateOnly(weekStartDate)
    },
    orderBy: { weekday: "asc" }
  });

  if (!rows.length) {
    return NextResponse.json({ workingHours: defaultDays(employeeId, weekStartDate, defaults) });
  }

  const workingHours = rows.map((row) => ({
    ...row,
    weekStartDate: isoDate(row.weekStartDate),
    date: isoDate(row.date)
  }));

  return NextResponse.json({ workingHours });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const payload = await request.json();
  const parsed = workingHoursSaveSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { employeeId, weekStartDate, days } = parsed.data;
  const weekStart = toDateOnly(weekStartDate);

  if (!(await canUseEmployee(user, employeeId, "workingHours"))) {
    return NextResponse.json({ error: "Keine Berechtigung fuer diese Arbeitszeiten" }, { status: 403 });
  }

  const today = isoDate(new Date());
  const writableDays = days.filter((day) => day.date >= today);

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: true, demo: true });
  }

  await prisma.$transaction(
    writableDays.map((day) =>
      prisma.workingHours.upsert({
        where: { employeeId_date: { employeeId, date: toDateOnly(day.date) } },
        update: {
          weekStartDate: weekStart,
          weekday: day.weekday,
          isWorking: day.isWorking,
          startTime: day.isWorking ? day.startTime : null,
          endTime: day.isWorking ? day.endTime : null,
          breakStartTime: day.isWorking ? day.breakStartTime : null,
          breakEndTime: day.isWorking ? day.breakEndTime : null
        },
        create: {
          employeeId,
          weekStartDate: weekStart,
          date: toDateOnly(day.date),
          weekday: day.weekday,
          isWorking: day.isWorking,
          startTime: day.isWorking ? day.startTime : null,
          endTime: day.isWorking ? day.endTime : null,
          breakStartTime: day.isWorking ? day.breakStartTime : null,
          breakEndTime: day.isWorking ? day.breakEndTime : null
        }
      })
    )
  );

  return NextResponse.json({ ok: true, skippedPastDays: days.length - writableDays.length });
}
