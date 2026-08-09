import { NextResponse } from "next/server";
import { unauthorizedClearSession } from "@/lib/auth";
import { requireAuthUser } from "@/lib/require-user";

export async function GET() {
  try {
    const auth = await requireAuthUser();
    if (!auth.ok) return auth.response;

    return NextResponse.json({
      user: {
        id: auth.user.id,
        phone: auth.user.phone,
        name: auth.user.name ?? null,
        role: auth.user.role,
      },
    });
  } catch (error) {
    // Never leave a broken session as HTTP 500 — kick to login instead.
    console.error("GET /api/auth/me error:", error);
    return unauthorizedClearSession();
  }
}
