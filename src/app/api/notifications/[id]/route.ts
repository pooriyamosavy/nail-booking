import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies, unauthorized } from "@/lib/auth";
import { markNotificationRead } from "@/lib/notifications";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return unauthorized();

    const { id } = await params;
    const notification = await markNotificationRead(session.userId, id);
    if (!notification) {
      return NextResponse.json({ error: "اعلان یافت نشد" }, { status: 404 });
    }
    return NextResponse.json({ notification });
  } catch (error) {
    console.error("PATCH /api/notifications/[id] error:", error);
    return NextResponse.json({ error: "خطا در به‌روزرسانی اعلان" }, { status: 500 });
  }
}
