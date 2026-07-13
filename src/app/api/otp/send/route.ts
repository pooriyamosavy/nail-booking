import { NextRequest, NextResponse } from "next/server";
import { sendOtp } from "@/lib/sms";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = body as { phone?: string };

    if (!phone?.trim()) {
      return NextResponse.json(
        { error: "شماره موبایل الزامی است" },
        { status: 400 },
      );
    }

    const result = sendOtp(phone);
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/otp/send error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "ارسال کد تأیید ناموفق بود",
      },
      { status: 500 },
    );
  }
}
