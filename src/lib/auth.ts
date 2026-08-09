import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@/models/User";

export const SESSION_COOKIE = "session";
const SESSION_DAYS = 30;

export interface SessionPayload {
  userId: string;
  phone: string;
  role: UserRole;
  name?: string;
}

function getJwtSecret(): Uint8Array {
  const secret =
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV !== "production"
      ? "dev-only-jwt-secret-change-me"
      : "");
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET must be set (at least 16 characters)");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    phone: payload.phone,
    role: payload.role,
    name: payload.name ?? "",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getJwtSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (
      typeof payload.userId !== "string" ||
      typeof payload.phone !== "string" ||
      (payload.role !== "user" && payload.role !== "admin")
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      phone: payload.phone,
      role: payload.role,
      name: typeof payload.name === "string" && payload.name ? payload.name : undefined,
    };
  } catch {
    return null;
  }
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getSessionFromRequest(
  request: NextRequest,
): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function unauthorized(message = "ورود لازم است") {
  return NextResponse.json({ error: message }, { status: 401 });
}

/** 401 response that also clears the session cookie (e.g. user deleted). */
export function unauthorizedClearSession(message = "کاربر یافت نشد. دوباره وارد شوید") {
  const response = NextResponse.json({ error: message, code: "USER_NOT_FOUND" }, { status: 401 });
  clearSessionCookie(response);
  return response;
}

export function forbidden(message = "دسترسی مجاز نیست") {
  return NextResponse.json({ error: message }, { status: 403 });
}
