import { addDays, format, startOfWeek } from "date-fns";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const employees = [
  {
    id: "demo-lisa",
    name: "Lisa Mueller",
    email: "lisa@nailstudio.test",
    color: "#111111",
    role: "owner" as const,
    inviteStatus: "active" as const,
    canManageBookings: true,
    canManageServices: true
  },
  {
    id: "demo-sarah",
    name: "Sarah Schneider",
    email: "sarah@nailstudio.test",
    color: "#6b7280",
    role: "staff" as const,
    inviteStatus: "invited" as const,
    canManageBookings: false,
    canManageServices: false
  },
  {
    id: "demo-anna",
    name: "Anna Weber",
    email: "anna@nailstudio.test",
    color: "#9ca3af",
    role: "staff" as const,
    inviteStatus: "draft" as const,
    canManageBookings: false,
    canManageServices: false
  },
  {
    id: "demo-julia",
    name: "Julia Wagner",
    email: "julia@nailstudio.test",
    color: "#4b5563",
    role: "staff" as const,
    inviteStatus: "draft" as const,
    canManageBookings: false,
    canManageServices: false
  }
];

const services = [
  { id: "service-manicure", name: "Manikuere", durationMinutes: 45 },
  { id: "service-gel", name: "Gel Manikuere", durationMinutes: 60 },
  { id: "service-refill-design", name: "Auffuellen + Design", durationMinutes: 90 },
  { id: "service-pedicure", name: "Pedikuere", durationMinutes: 60 },
  { id: "service-new-set", name: "Neumodellage", durationMinutes: 90 }
];

function asDateOnly(date: Date) {
  return new Date(`${format(date, "yyyy-MM-dd")}T00:00:00.000Z`);
}

async function main() {
  await prisma.businessSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", studioName: "Nagelstudio" }
  });

  for (const employee of employees) {
    await prisma.employee.upsert({
      where: { id: employee.id },
      update: employee,
      create: employee
    });

    await prisma.user.upsert({
      where: { email: employee.email },
      update: {
        name: employee.name,
        role: employee.role ?? "staff",
        employeeId: employee.id
      },
      create: {
        email: employee.email,
        name: employee.name,
        role: employee.role ?? "staff",
        employeeId: employee.id
      }
    });
  }

  for (const service of services) {
    await prisma.service.upsert({
      where: { id: service.id },
      update: service,
      create: service
    });
  }

  const today = asDateOnly(new Date());
  const weekStart = asDateOnly(startOfWeek(today, { weekStartsOn: 1 }));

  for (let index = 0; index < 6; index += 1) {
    const date = asDateOnly(addDays(weekStart, index));
    const isWorking = index < 5;

    await prisma.workingHours.upsert({
      where: { employeeId_date: { employeeId: "demo-lisa", date } },
      update: {
        weekStartDate: weekStart,
        weekday: index + 1,
        isWorking,
        startTime: isWorking ? "09:00" : null,
        endTime: isWorking ? "18:00" : null,
        breakStartTime: isWorking ? "13:00" : null,
        breakEndTime: isWorking ? "13:30" : null
      },
      create: {
        employeeId: "demo-lisa",
        weekStartDate: weekStart,
        date,
        weekday: index + 1,
        isWorking,
        startTime: isWorking ? "09:00" : null,
        endTime: isWorking ? "18:00" : null,
        breakStartTime: isWorking ? "13:00" : null,
        breakEndTime: isWorking ? "13:30" : null
      }
    });
  }

  const demoBookings = [
    ["demo-lisa", "service-gel", "Lisa Mueller", "09:00", "10:00"],
    ["demo-lisa", "service-refill-design", "Sarah Schneider", "10:30", "12:00"],
    ["demo-lisa", "service-pedicure", "Anna Weber", "14:00", "15:00"],
    ["demo-lisa", "service-new-set", "Julia Wagner", "15:30", "17:00"]
  ] as const;

  await prisma.booking.deleteMany({ where: { date: today } });

  for (const [employeeId, serviceId, customerName, startTime, endTime] of demoBookings) {
    await prisma.booking.create({
      data: {
        employeeId,
        serviceId,
        customerName,
        date: today,
        startTime,
        endTime,
        status: "confirmed",
        source: "manual_staff"
      }
    });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
