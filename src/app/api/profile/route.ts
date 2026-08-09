import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  createSessionToken,
  getSessionFromCookies,
  setSessionCookie,
  unauthorized,
} from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import {
  findMockUserById,
  isMockMode,
} from "@/lib/mock-store";
import { normalizePhone } from "@/lib/phone";
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
    console.error("GET /api/profile error:", error);
    return NextResponse.json({ error: "خطا در دریافت پروفایل" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return unauthorized();

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
      const user = findMockUserById(session.userId);
      if (!user) return unauthorized();

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
    const user = await User.findById(session.userId);
    if (!user) return unauthorized();

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
