import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  setSessionCookie,
} from "@/lib/auth";
import { ensureAdminUser } from "@/lib/ensure-admin";
import { connectDB } from "@/lib/mongodb";
import {
  createMockUser,
  findMockUserByPhone,
  isMockMode,
} from "@/lib/mock-store";
import { normalizePhone } from "@/lib/phone";
import { User } from "@/models/User";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone: phoneRaw, password, name } = body as {
      phone?: string;
      password?: string;
      name?: string;
    };

    if (!phoneRaw?.trim() || !password) {
      return NextResponse.json(
        { error: "شماره موبایل و رمز عبور الزامی است" },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "رمز عبور باید حداقل ۶ کاراکتر باشد" },
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

    const passwordHash = await bcrypt.hash(password, 10);
    const trimmedName = name?.trim() || undefined;

    if (isMockMode()) {
      if (findMockUserByPhone(phone)) {
        return NextResponse.json(
          { error: "این شماره قبلاً ثبت شده است" },
          { status: 409 },
        );
      }

      const user = createMockUser({
        phone,
        passwordHash,
        name: trimmedName,
        role: "user",
      });

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

    const existing = await User.findOne({ phone });
    if (existing) {
      return NextResponse.json(
        { error: "این شماره قبلاً ثبت شده است" },
        { status: 409 },
      );
    }

    const user = await User.create({
      phone,
      passwordHash,
      name: trimmedName,
      role: "user",
    });

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
    console.error("POST /api/auth/register error:", error);
    return NextResponse.json({ error: "ثبت‌نام ناموفق بود" }, { status: 500 });
  }
}
