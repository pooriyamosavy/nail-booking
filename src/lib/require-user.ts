import mongoose from "mongoose";
import { NextResponse } from "next/server";
import {
  getSessionFromCookies,
  unauthorized,
  unauthorizedClearSession,
  type SessionPayload,
} from "@/lib/auth";
import { ensureAdminUser } from "@/lib/ensure-admin";
import { connectDB } from "@/lib/mongodb";
import {
  findMockUserById,
  isMockMode,
  type MockUser,
} from "@/lib/mock-store";
import { User, type IUser } from "@/models/User";

export type AuthUser = {
  id: string;
  phone: string;
  name?: string;
  role: "user" | "admin";
};

type RequireResult =
  | { ok: true; session: SessionPayload; user: AuthUser; doc: IUser | MockUser }
  | { ok: false; response: NextResponse };

/** Resolve session and load user from DB; clear cookie if user is missing. */
export async function requireAuthUser(): Promise<RequireResult> {
  const session = await getSessionFromCookies();
  if (!session) {
    return { ok: false, response: unauthorized() };
  }

  try {
    if (isMockMode()) {
      const user = findMockUserById(session.userId);
      if (!user) {
        return { ok: false, response: unauthorizedClearSession() };
      }
      return {
        ok: true,
        session,
        user: {
          id: user._id,
          phone: user.phone,
          name: user.name,
          role: user.role,
        },
        doc: user,
      };
    }

    // Stale mock/session IDs are not valid Mongo ObjectIds — kick out.
    if (!mongoose.Types.ObjectId.isValid(session.userId)) {
      return { ok: false, response: unauthorizedClearSession() };
    }

    await ensureAdminUser();
    await connectDB();
    const user = await User.findById(session.userId);
    if (!user) {
      return { ok: false, response: unauthorizedClearSession() };
    }

    return {
      ok: true,
      session,
      user: {
        id: user._id.toString(),
        phone: user.phone,
        name: user.name,
        role: user.role,
      },
      doc: user,
    };
  } catch (error) {
    // DB/cast failures while resolving an existing cookie → treat as invalid session
    console.error("requireAuthUser error:", error);
    return { ok: false, response: unauthorizedClearSession() };
  }
}

export async function requireAdminUser(): Promise<RequireResult> {
  const result = await requireAuthUser();
  if (!result.ok) return result;
  if (result.user.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "دسترسی مجاز نیست" }, { status: 403 }),
    };
  }
  return result;
}
