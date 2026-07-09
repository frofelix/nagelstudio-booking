import { NextResponse } from "next/server";
import { demoAdminSummary } from "@/lib/admin-data";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ settings: demoAdminSummary.settings });
  }

  const settings = await prisma.businessSettings.findUnique({ where: { id: "default" } });

  return NextResponse.json({
    settings: {
      studioName: settings?.studioName ?? demoAdminSummary.settings.studioName,
      defaultStartTime: settings?.defaultStartTime ?? demoAdminSummary.settings.defaultStartTime,
      defaultEndTime: settings?.defaultEndTime ?? demoAdminSummary.settings.defaultEndTime,
      defaultBreakStartTime: settings?.defaultBreakStartTime ?? demoAdminSummary.settings.defaultBreakStartTime,
      defaultBreakEndTime: settings?.defaultBreakEndTime ?? demoAdminSummary.settings.defaultBreakEndTime
    }
  });
}
