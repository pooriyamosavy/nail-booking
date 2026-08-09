import { NextResponse } from "next/server";
import { getSessionFromCookies, unauthorized } from "@/lib/auth";
import {
  listNotificationsForUser,
  markAllNotificationsRead,
  unreadCountForUser,
} from "@/lib/notifications";

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) return unauthorized();

    const [notifications, unreadCount] = await Promise.all([
      listNotificationsForUser(session.userId),
      unreadCountForUser(session.userId),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json({ error: "خطا در دریافت اعلان‌ها" }, { status: 500 });
  }
}

export async function PATCH() {
  try {
    const session = await getSessionFromCookies();
    if (!session) return unauthorized();

    await markAllNotificationsRead(session.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/notifications error:", error);
    return NextResponse.json({ error: "خطا در به‌روزرسانی اعلان‌ها" }, { status: 500 });
  }
}
