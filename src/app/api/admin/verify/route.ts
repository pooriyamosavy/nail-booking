import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body as { password?: string };

    if (!password?.trim()) {
      return NextResponse.json({ error: "رمز عبور الزامی است" }, { status: 400 });
    }

    if (password.trim() !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "رمز عبور نادرست است" }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/admin/verify error:", error);
    return NextResponse.json({ error: "خطا در تأیید رمز عبور" }, { status: 500 });
  }
}
