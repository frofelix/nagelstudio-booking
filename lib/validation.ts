import { z } from "zod";
import { isBefore, isWithin } from "./time";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ungueltige Uhrzeit");
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungueltiges Datum");
const roleSchema = z.enum(["owner", "admin", "staff"]);
const inviteStatusSchema = z.enum(["draft", "invited", "active", "disabled"]);
const bookingStatusSchema = z.enum(["confirmed", "cancelled", "completed", "no_show"]);
const cancellationWindowSchema = z.enum(["under_24h", "over_24h", "studio_cancelled"]);

export const bookingCreateSchema = z
  .object({
    employeeId: z.string().min(1),
    serviceId: z.string().min(1),
    customerName: z.string().min(2, "Bitte Kundin oder Kunden eintragen"),
    customerPhone: z.string().optional().nullable(),
    customerEmail: z.string().email().optional().or(z.literal("")).nullable(),
    date: dateSchema,
    startTime: timeSchema,
    endTime: timeSchema,
    notes: z.string().optional().nullable()
  })
  .refine((value) => isBefore(value.startTime, value.endTime), {
    path: ["endTime"],
    message: "Endzeit muss nach der Startzeit liegen"
  });

export const publicBookingCreateSchema = z.object({
  employeeId: z.string().min(1),
  serviceId: z.string().min(1),
  customerName: z.string().min(3, "Bitte mindestens 3 Zeichen eintragen"),
  customerPhone: z.string().optional().nullable(),
  customerEmail: z.string().min(1, "Bitte E-Mail eintragen").refine((value) => value.includes("@"), "E-Mail muss ein @ enthalten"),
  date: dateSchema,
  startTime: timeSchema,
  notes: z.string().max(500).optional().nullable()
});

export const bookingUpdateSchema = z
  .object({
    id: z.string().min(1),
    employeeId: z.string().min(1).optional(),
    serviceId: z.string().min(1).optional(),
    customerName: z.string().min(2, "Bitte Kundin oder Kunden eintragen").optional(),
    customerPhone: z.string().optional().nullable(),
    customerEmail: z.string().email().optional().or(z.literal("")).nullable(),
    date: dateSchema.optional(),
    startTime: timeSchema.optional(),
    endTime: timeSchema.optional(),
    status: bookingStatusSchema.optional(),
    cancellationWindow: cancellationWindowSchema.optional(),
    notes: z.string().optional().nullable()
  })
  .superRefine((value, ctx) => {
    if (value.startTime && value.endTime && !isBefore(value.startTime, value.endTime)) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "Endzeit muss nach der Startzeit liegen" });
    }
  });

export const workingHoursDaySchema = z
  .object({
    date: dateSchema,
    weekday: z.number().int().min(1).max(6),
    isWorking: z.boolean(),
    startTime: timeSchema.nullable(),
    endTime: timeSchema.nullable(),
    breakStartTime: timeSchema.nullable(),
    breakEndTime: timeSchema.nullable()
  })
  .superRefine((value, ctx) => {
    if (!value.isWorking) return;
    if (!value.startTime || !value.endTime) {
      ctx.addIssue({ code: "custom", message: "Start- und Endzeit sind erforderlich" });
      return;
    }
    if (!isBefore(value.startTime, value.endTime)) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "Endzeit muss nach Startzeit liegen" });
    }
    if (value.breakStartTime && value.breakEndTime) {
      if (!isBefore(value.breakStartTime, value.breakEndTime)) {
        ctx.addIssue({ code: "custom", path: ["breakEndTime"], message: "Pausenende muss nach Pausenstart liegen" });
      }
      if (!isWithin(value.breakStartTime, value.breakEndTime, value.startTime, value.endTime)) {
        ctx.addIssue({ code: "custom", path: ["breakStartTime"], message: "Pause muss innerhalb der Arbeitszeit liegen" });
      }
    }
  });

export const workingHoursSaveSchema = z.object({
  employeeId: z.string().min(1),
  weekStartDate: dateSchema,
  days: z.array(workingHoursDaySchema).length(6)
});

export const adminEmployeeCreateSchema = z.object({
  name: z.string().min(2, "Name ist erforderlich"),
  email: z.string().email("Bitte gueltige E-Mail eintragen"),
  phone: z.string().optional().nullable(),
  role: roleSchema.default("staff"),
  canManageBookings: z.boolean().default(false),
  canManageWorkingHours: z.boolean().default(true),
  canManageServices: z.boolean().default(false)
});

export const adminEmployeeUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  role: roleSchema.optional(),
  inviteStatus: inviteStatusSchema.optional(),
  active: z.boolean().optional(),
  canManageBookings: z.boolean().optional(),
  canManageWorkingHours: z.boolean().optional(),
  canManageServices: z.boolean().optional()
});

export const adminServiceCreateSchema = z.object({
  name: z.string().min(2, "Service ist erforderlich"),
  description: z.string().optional().nullable(),
  durationMinutes: z.number().int().min(10).max(480),
  priceCents: z.number().int().min(0).optional().nullable()
});

export const adminServiceUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  durationMinutes: z.number().int().min(10).max(480).optional(),
  priceCents: z.number().int().min(0).optional().nullable(),
  active: z.boolean().optional()
});

export const vacationCreateSchema = z
  .object({
    employeeId: z.string().min(1),
    startDate: dateSchema,
    endDate: dateSchema,
    note: z.string().optional().nullable()
  })
  .refine((value) => value.endDate >= value.startDate, {
    path: ["endDate"],
    message: "Enddatum muss nach dem Startdatum liegen"
  });

export const adminSettingsUpdateSchema = z
  .object({
    studioName: z.string().min(2, "Name ist erforderlich"),
    defaultStartTime: timeSchema,
    defaultEndTime: timeSchema,
    defaultBreakStartTime: timeSchema,
    defaultBreakEndTime: timeSchema
  })
  .superRefine((value, ctx) => {
    if (!isBefore(value.defaultStartTime, value.defaultEndTime)) {
      ctx.addIssue({ code: "custom", path: ["defaultEndTime"], message: "Schliesszeit muss nach Oeffnungszeit liegen" });
    }
    if (!isBefore(value.defaultBreakStartTime, value.defaultBreakEndTime)) {
      ctx.addIssue({ code: "custom", path: ["defaultBreakEndTime"], message: "Pausenende muss nach Pausenstart liegen" });
    }
    if (!isWithin(value.defaultBreakStartTime, value.defaultBreakEndTime, value.defaultStartTime, value.defaultEndTime)) {
      ctx.addIssue({ code: "custom", path: ["defaultBreakStartTime"], message: "Pause muss innerhalb der Oeffnungszeit liegen" });
    }
  });
