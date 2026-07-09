import { NextRequest, NextResponse } from "next/server";
import { listPublicAvailabilityDays } from "@/lib/public-booking";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const serviceId = request.nextUrl.searchParams.get("serviceId") ?? "";
  const employeeId = request.nextUrl.searchParams.get("employeeId") ?? "any";
  const month = request.nextUrl.searchParams.get("month") ?? "";

  if (!serviceId || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Service und Monat sind erforderlich.", days: [] }, { status: 400 });
  }

  const days = await listPublicAvailabilityDays({ serviceId, month, employeeId });
  return NextResponse.json({ days });
}
