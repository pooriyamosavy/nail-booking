import { NextResponse } from "next/server";
import { getSessionFromCookies, unauthorized } from "@/lib/auth";
import { ensureAdminUser } from "@/lib/ensure-admin";
import { connectDB } from "@/lib/mongodb";
import { findMockUserById, isMockMode } from "@/lib/mock-store";
import { User } from "@/models/User";

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) return unauthorized();

    if (isMockMode()) {
      const user = findMockUserById(session.userId);
      if (!user) return unauthorized();
      return NextResponse.json({
        user: {
          id: user._id,
          phone: user.phone,
          name: user.name ?? null,
          role: user.role,
        },
      });
    }

    await ensureAdminUser();
    await connectDB();
    const user = await User.findById(session.userId);
    if (!user) return unauthorized();

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        phone: user.phone,
        name: user.name ?? null,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("GET /api/auth/me error:", error);
    return NextResponse.json({ error: "خطا در دریافت کاربر" }, { status: 500 });
  }
}
