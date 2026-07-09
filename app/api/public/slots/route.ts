import { NextRequest, NextResponse } from "next/server";
import { listPublicBookingSlots } from "@/lib/public-booking";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const serviceId = request.nextUrl.searchParams.get("serviceId") ?? "";
  const date = request.nextUrl.searchParams.get("date") ?? "";
  const employeeId = request.nextUrl.searchParams.get("employeeId") ?? "any";

  if (!serviceId || !date) {
    return NextResponse.json({ error: "Service und Datum sind erforderlich.", slots: [] }, { status: 400 });
  }

  const slots = await listPublicBookingSlots({ serviceId, date, employeeId });
  return NextResponse.json({ slots });
}
