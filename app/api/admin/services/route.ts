import { NextRequest, NextResponse } from "next/server";
import { demoAdminSummary } from "@/lib/admin-data";
import { requireAdminApi } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminServiceCreateSchema, adminServiceUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  const payload = await request.json();
  const parsed = adminServiceCreateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ service: { ...parsed.data, id: `local-service-${Date.now()}`, active: true } }, { status: 201 });
  }

  const service = await prisma.service.create({
    data: {
      ...parsed.data,
      description: parsed.data.description || null,
      priceCents: parsed.data.priceCents ?? null
    }
  });

  return NextResponse.json({ service }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  const payload = await request.json();
  const parsed = adminServiceUpdateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...data } = parsed.data;

  if (!process.env.DATABASE_URL) {
    const service = demoAdminSummary.services.find((entry) => entry.id === id);
    return NextResponse.json({ service: { ...service, ...data, id } });
  }

  const service = await prisma.service.update({
    where: { id },
    data: {
      ...data,
      description: data.description === undefined ? undefined : data.description || null,
      priceCents: data.priceCents === undefined ? undefined : data.priceCents ?? null
    }
  });

  return NextResponse.json({ service });
}
