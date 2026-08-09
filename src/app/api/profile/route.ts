import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  createSessionToken,
  setSessionCookie,
  unauthorizedClearSession,
} from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { isMockMode, type MockUser } from "@/lib/mock-store";
import { normalizePhone } from "@/lib/phone";
import { requireAuthUser } from "@/lib/require-user";
import { User } from "@/models/User";

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
    console.error("GET /api/profile error:", error);
    return NextResponse.json({ error: "خطا در دریافت پروفایل" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuthUser();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const {
      name,
      phone: phoneRaw,
      currentPassword,
      newPassword,
    } = body as {
      name?: string;
      phone?: string;
      currentPassword?: string;
      newPassword?: string;
    };

    if (isMockMode()) {
      const user = auth.doc as MockUser;

      if (typeof name === "string") {
        user.name = name.trim() || undefined;
      }

      if (phoneRaw !== undefined) {
        if (!currentPassword) {
          return NextResponse.json(
            { error: "برای تغییر شماره، رمز فعلی لازم است" },
            { status: 400 },
          );
        }
        if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
          return NextResponse.json({ error: "رمز فعلی نادرست است" }, { status: 401 });
        }
        const phone = normalizePhone(phoneRaw);
        if (!phone) {
          return NextResponse.json({ error: "شماره موبایل نامعتبر است" }, { status: 400 });
        }
        user.phone = phone;
      }

      if (newPassword) {
        if (!currentPassword) {
          return NextResponse.json(
            { error: "برای تغییر رمز، رمز فعلی لازم است" },
            { status: 400 },
          );
        }
        if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
          return NextResponse.json({ error: "رمز فعلی نادرست است" }, { status: 401 });
        }
        if (newPassword.length < 6) {
          return NextResponse.json(
            { error: "رمز عبور باید حداقل ۶ کاراکتر باشد" },
            { status: 400 },
          );
        }
        user.passwordHash = await bcrypt.hash(newPassword, 10);
      }

      user.updatedAt = new Date().toISOString();

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

    await connectDB();
    const user = await User.findById(auth.user.id);
    if (!user) return unauthorizedClearSession();

    if (typeof name === "string") {
      user.name = name.trim() || undefined;
    }

    if (phoneRaw !== undefined) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "برای تغییر شماره، رمز فعلی لازم است" },
          { status: 400 },
        );
      }
      if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
        return NextResponse.json({ error: "رمز فعلی نادرست است" }, { status: 401 });
      }
      const phone = normalizePhone(phoneRaw);
      if (!phone) {
        return NextResponse.json({ error: "شماره موبایل نامعتبر است" }, { status: 400 });
      }
      const clash = await User.findOne({ phone, _id: { $ne: user._id } });
      if (clash) {
        return NextResponse.json(
          { error: "این شماره قبلاً ثبت شده است" },
          { status: 409 },
        );
      }
      user.phone = phone;
    }

    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "برای تغییر رمز، رمز فعلی لازم است" },
          { status: 400 },
        );
      }
      if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
        return NextResponse.json({ error: "رمز فعلی نادرست است" }, { status: 401 });
      }
      if (newPassword.length < 6) {
        return NextResponse.json(
          { error: "رمز عبور باید حداقل ۶ کاراکتر باشد" },
          { status: 400 },
        );
      }
      user.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    await user.save();

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
    console.error("PATCH /api/profile error:", error);
    return NextResponse.json({ error: "به‌روزرسانی پروفایل ناموفق بود" }, { status: 500 });
  }
}
