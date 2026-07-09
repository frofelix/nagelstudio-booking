import { NextRequest, NextResponse } from "next/server";
import { demoAdminSummary } from "@/lib/admin-data";
import { requireAdminApi } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminEmployeeCreateSchema, adminEmployeeUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  const payload = await request.json();
  const parsed = adminEmployeeCreateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ employee: { ...parsed.data, id: `local-${Date.now()}`, inviteStatus: "draft", active: true } }, { status: 201 });
  }

  const employee = await prisma.employee.create({
    data: {
      ...parsed.data,
      phone: parsed.data.phone || null,
      color: "#111111",
      inviteStatus: "draft"
    }
  });

  return NextResponse.json({ employee }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  const payload = await request.json();
  const parsed = adminEmployeeUpdateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...data } = parsed.data;

  if (!process.env.DATABASE_URL) {
    const employee = demoAdminSummary.employees.find((entry) => entry.id === id);
    return NextResponse.json({ employee: { ...employee, ...data, id } });
  }

  const employee = await prisma.employee.update({
    where: { id },
    data: {
      ...data,
      phone: data.phone === undefined ? undefined : data.phone || null
    }
  });

  return NextResponse.json({ employee });
}
