import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      settings: { studioName: "Nagelstudio" },
      services: [],
      employees: []
    });
  }

  const [settings, services, employees] = await Promise.all([
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
    prisma.service.findMany({
      where: { active: true },
      orderBy: [{ durationMinutes: "asc" }, { name: "asc" }],
      select: { id: true, name: true, description: true, durationMinutes: true, priceCents: true }
    }),
    prisma.employee.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    })
  ]);

  return NextResponse.json({
    settings: {
      studioName: settings?.studioName ?? "Nagelstudio"
    },
    services,
    employees
  });
}
