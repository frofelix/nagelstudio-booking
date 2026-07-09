import { CalendarClient } from "@/components/CalendarClient";
import { requireUser } from "@/lib/auth";
import { getDefaultCalendarDate, isoDate } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function StaffCalendarPage({ searchParams }: { searchParams?: { date?: string } }) {
  const user = await requireUser();
  return <CalendarClient employeeId={user.employeeId} role={user.role} initialDate={searchParams?.date ?? isoDate(getDefaultCalendarDate())} />;
}
