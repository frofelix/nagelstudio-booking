import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { hashPassword, requireAdminApi } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  const { employeeId } = await request.json();

  if (typeof employeeId !== "string" || !employeeId) {
    return NextResponse.json({ error: "employeeId ist erforderlich" }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { user: true }
  });

  if (!employee) {
    return NextResponse.json({ error: "Mitarbeiter nicht gefunden" }, { status: 404 });
  }

  const temporaryPassword = createTemporaryPassword();

  const user = await prisma.user.upsert({
    where: { email: employee.email },
    update: {
      name: employee.name,
      role: employee.role,
      employeeId: employee.id,
      passwordHash: hashPassword(temporaryPassword),
      mustChangePassword: true
    },
    create: {
      email: employee.email,
      name: employee.name,
      role: employee.role,
      employee: { connect: { id: employee.id } },
      passwordHash: hashPassword(temporaryPassword),
      mustChangePassword: true
    }
  });

  const updatedEmployee = await prisma.employee.update({
    where: { id: employee.id },
    data: { inviteStatus: "invited", active: true }
  });

  return NextResponse.json({
    invite: {
      email: user.email,
      temporaryPassword,
      loginPath: "/login",
      employeeName: updatedEmployee.name
    },
    employee: updatedEmployee
  });
}

function createTemporaryPassword() {
  const chunk = randomBytes(6).toString("base64url");
  return `Start-${chunk}`;
}
