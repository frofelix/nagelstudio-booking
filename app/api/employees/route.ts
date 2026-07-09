import { NextResponse } from "next/server";
import { demoAdminSummary } from "@/lib/admin-data";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ employees: demoAdminSummary.employees.filter((employee) => employee.active) });
  }

  const isManager = user.role === "owner" || user.role === "admin";

  const employees = await prisma.employee.findMany({
    where: { active: true, id: isManager || !user.employeeId ? undefined : user.employeeId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      color: true,
      role: true,
      active: true
    }
  });

  return NextResponse.json({ employees });
}
