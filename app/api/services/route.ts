import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      services: [
        { id: "service-manicure", name: "Maniküre", durationMinutes: 45 },
        { id: "service-gel", name: "Gel Maniküre", durationMinutes: 60 },
        { id: "service-refill-design", name: "Auffüllen + Design", durationMinutes: 90 },
        { id: "service-pedicure", name: "Pediküre", durationMinutes: 60 },
        { id: "service-new-set", name: "Neumodellage", durationMinutes: 90 }
      ]
    });
  }

  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: { durationMinutes: "asc" }
  });

  return NextResponse.json({ services });
}
