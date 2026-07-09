import "server-only";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

export type StaffChatMessageDto = {
  id: string;
  bookingId: string | null;
  fromEmployeeId: string | null;
  fromName: string;
  type: "message" | "transfer_request" | "transfer_accepted" | "sick_notice" | "cancel_required";
  message: string;
  status: "open" | "accepted" | "info";
  createdAt: string;
};

type StaffChatRow = {
  id: string;
  booking_id: string | null;
  from_employee_id: string | null;
  from_name: string | null;
  type: StaffChatMessageDto["type"];
  message: string;
  status: StaffChatMessageDto["status"];
  created_at: Date;
};

export async function ensureStaffChatTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS staff_chat_messages (
      id TEXT PRIMARY KEY,
      booking_id TEXT NULL,
      from_employee_id TEXT NULL,
      from_name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'message',
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'info',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS staff_chat_messages_created_at_idx ON staff_chat_messages (created_at DESC)`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS staff_chat_messages_booking_id_idx ON staff_chat_messages (booking_id)`);
}

export async function listStaffChatMessages(limit = 80) {
  await ensureStaffChatTable();
  const rows = await prisma.$queryRawUnsafe<StaffChatRow[]>(
    `
      SELECT id, booking_id, from_employee_id, from_name, type, message, status, created_at
      FROM staff_chat_messages
      ORDER BY created_at DESC
      LIMIT $1
    `,
    limit
  );
  return rows.reverse().map(mapStaffChatRow);
}

export async function createStaffChatMessage(input: {
  bookingId?: string | null;
  fromEmployeeId?: string | null;
  fromName: string;
  type: StaffChatMessageDto["type"];
  message: string;
  status?: StaffChatMessageDto["status"];
}) {
  await ensureStaffChatTable();
  const id = randomUUID();
  const rows = await prisma.$queryRawUnsafe<StaffChatRow[]>(
    `
      INSERT INTO staff_chat_messages (id, booking_id, from_employee_id, from_name, type, message, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, booking_id, from_employee_id, from_name, type, message, status, created_at
    `,
    id,
    input.bookingId ?? null,
    input.fromEmployeeId ?? null,
    input.fromName,
    input.type,
    input.message,
    input.status ?? "info"
  );
  return mapStaffChatRow(rows[0]);
}

export async function findStaffChatMessage(id: string) {
  await ensureStaffChatTable();
  const rows = await prisma.$queryRawUnsafe<StaffChatRow[]>(
    `
      SELECT id, booking_id, from_employee_id, from_name, type, message, status, created_at
      FROM staff_chat_messages
      WHERE id = $1
      LIMIT 1
    `,
    id
  );
  return rows[0] ? mapStaffChatRow(rows[0]) : null;
}

export async function updateStaffChatMessageStatus(id: string, status: StaffChatMessageDto["status"]) {
  await ensureStaffChatTable();
  const rows = await prisma.$queryRawUnsafe<StaffChatRow[]>(
    `
      UPDATE staff_chat_messages
      SET status = $2
      WHERE id = $1
      RETURNING id, booking_id, from_employee_id, from_name, type, message, status, created_at
    `,
    id,
    status
  );
  return rows[0] ? mapStaffChatRow(rows[0]) : null;
}

function mapStaffChatRow(row: StaffChatRow): StaffChatMessageDto {
  return {
    id: row.id,
    bookingId: row.booking_id,
    fromEmployeeId: row.from_employee_id,
    fromName: row.from_name ?? "Team",
    type: row.type,
    message: row.message,
    status: row.status,
    createdAt: row.created_at.toISOString()
  };
}
