import "server-only";

import { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function canUseEmployee(user: SessionUser, employeeId: string, capability: "bookings" | "workingHours" | "services" = "bookings") {
  if (user.role === "owner" || user.role === "admin") return true;
  if (user.employeeId === employeeId) return true;

  if (!user.employeeId) return false;

  const employee = await prisma.employee.findUnique({
    where: { id: user.employeeId },
    select: {
      canManageBookings: true,
      canManageWorkingHours: true,
      canManageServices: true
    }
  });

  if (!employee) return false;
  if (capability === "bookings") return employee.canManageBookings;
  if (capability === "workingHours") return employee.canManageWorkingHours;
  return employee.canManageServices;
}
