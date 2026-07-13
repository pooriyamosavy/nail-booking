import { NextRequest, NextResponse } from "next/server";
import { verifyOtp } from "@/lib/sms";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, code } = body as { phone?: string; code?: string };

    if (!phone?.trim() || !code?.trim()) {
      return NextResponse.json(
        { error: "شماره موبایل و کد تأیید الزامی است" },
        { status: 400 },
      );
    }

    const valid = verifyOtp(phone, code);
    if (!valid) {
      return NextResponse.json(
        { error: "کد تأیید نامعتبر یا منقضی شده است" },
        { status: 400 },
      );
    }

    return NextResponse.json({ verified: true, mock: true });
  } catch (error) {
    console.error("POST /api/otp/verify error:", error);
    return NextResponse.json(
      { error: "تأیید کد ناموفق بود" },
      { status: 500 },
    );
  }
}
