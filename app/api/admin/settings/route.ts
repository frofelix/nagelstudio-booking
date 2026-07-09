import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminSettingsUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  const payload = await request.json();
  const parsed = adminSettingsUpdateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ settings: parsed.data });
  }

  const settings = await prisma.businessSettings.upsert({
    where: { id: "default" },
    update: parsed.data,
    create: {
      id: "default",
      ...parsed.data
    }
  });

  return NextResponse.json({
    settings: {
      studioName: settings.studioName,
      defaultStartTime: settings.defaultStartTime,
      defaultEndTime: settings.defaultEndTime,
      defaultBreakStartTime: settings.defaultBreakStartTime,
      defaultBreakEndTime: settings.defaultBreakEndTime
    }
  });
}
