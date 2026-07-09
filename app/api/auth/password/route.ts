import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { currentPassword, newPassword } = await request.json();

  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return NextResponse.json({ error: "Passwoerter sind erforderlich" }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: "Das neue Passwort braucht mindestens 8 Zeichen." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });

  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    return NextResponse.json({ error: "Aktuelles Passwort stimmt nicht." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(newPassword), mustChangePassword: false }
  });

  return NextResponse.json({ ok: true });
}
