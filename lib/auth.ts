import "server-only";

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const sessionCookieName = "nail_session";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "staff";
  employeeId: string | null;
};

type SessionPayload = SessionUser & {
  exp: number;
};

const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, passwordHash: string | null) {
  if (!passwordHash) return false;

  const [method, salt, storedHash] = passwordHash.split(":");
  if (method !== "scrypt" || !salt || !storedHash) return false;

  const hash = scryptSync(password, salt, 64);
  const stored = Buffer.from(storedHash, "hex");
  return stored.length === hash.length && timingSafeEqual(stored, hash);
}

export function createSessionToken(user: SessionUser) {
  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + sessionMaxAgeSeconds
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(body);
  return `${body}.${signature}`;
}

export function readSessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;

  const [body, signature] = token.split(".");
  if (!body || !signature || sign(body) !== signature) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.id || !payload.email || !payload.role || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const session = readSessionToken(cookies().get(sessionCookieName)?.value);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: { employee: { select: { active: true } } }
  });

  if (!user || user.employee?.active === false) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    employeeId: user.employeeId
  } satisfies SessionUser;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdminPage() {
  const user = await requireUser();
  if (user.role !== "owner" && user.role !== "admin") redirect("/staff/calendar");
  return user;
}

export async function requireAdminApi() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  if (user.role !== "owner" && user.role !== "admin") return NextResponse.json({ error: "Keine Admin-Berechtigung" }, { status: 403 });
  return null;
}

export function setSessionCookie(response: NextResponse, user: SessionUser) {
  response.cookies.set(sessionCookieName, createSessionToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: sessionMaxAgeSeconds,
    path: "/"
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/"
  });
}

function sign(value: string) {
  const secret = process.env.AUTH_SECRET || "dev-only-change-me";
  return createHmac("sha256", secret).update(value).digest("base64url");
}
