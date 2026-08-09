import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  setSessionCookie,
} from "@/lib/auth";
import { ensureAdminUser } from "@/lib/ensure-admin";
import { connectDB } from "@/lib/mongodb";
import {
  ensureMockAdmin,
  findMockUserByPhone,
  isMockMode,
} from "@/lib/mock-store";
import { normalizePhone } from "@/lib/phone";
import { User } from "@/models/User";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone: phoneRaw, password } = body as {
      phone?: string;
      password?: string;
    };

    if (!phoneRaw?.trim() || !password) {
      return NextResponse.json(
        { error: "شماره موبایل و رمز عبور الزامی است" },
        { status: 400 },
      );
    }

    const phone = normalizePhone(phoneRaw);
    if (!phone) {
      return NextResponse.json(
        { error: "شماره موبایل نامعتبر است" },
        { status: 400 },
      );
    }

    if (isMockMode()) {
      ensureMockAdmin();
      const user = findMockUserByPhone(phone);
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return NextResponse.json(
          { error: "شماره یا رمز عبور نادرست است" },
          { status: 401 },
        );
      }

      const token = await createSessionToken({
        userId: user._id,
        phone: user.phone,
        role: user.role,
        name: user.name,
      });

      const response = NextResponse.json({
        user: {
          id: user._id,
          phone: user.phone,
          name: user.name ?? null,
          role: user.role,
        },
      });
      setSessionCookie(response, token);
      return response;
    }

    await ensureAdminUser();
    await connectDB();

    const user = await User.findOne({ phone });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json(
        { error: "شماره یا رمز عبور نادرست است" },
        { status: 401 },
      );
    }

    const token = await createSessionToken({
      userId: user._id.toString(),
      phone: user.phone,
      role: user.role,
      name: user.name,
    });

    const response = NextResponse.json({
      user: {
        id: user._id.toString(),
        phone: user.phone,
        name: user.name ?? null,
        role: user.role,
      },
    });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error("POST /api/auth/login error:", error);
    return NextResponse.json({ error: "ورود ناموفق بود" }, { status: 500 });
  }
}
