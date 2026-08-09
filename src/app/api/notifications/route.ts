import { NextResponse } from "next/server";
import {
  listNotificationsForUser,
  markAllNotificationsRead,
  unreadCountForUser,
} from "@/lib/notifications";
import { requireAuthUser } from "@/lib/require-user";

export async function GET() {
  try {
    const auth = await requireAuthUser();
    if (!auth.ok) return auth.response;

    const [notifications, unreadCount] = await Promise.all([
      listNotificationsForUser(auth.user.id),
      unreadCountForUser(auth.user.id),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json({ error: "خطا در دریافت اعلان‌ها" }, { status: 500 });
  }
}

export async function PATCH() {
  try {
    const auth = await requireAuthUser();
    if (!auth.ok) return auth.response;

    await markAllNotificationsRead(auth.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/notifications error:", error);
    return NextResponse.json({ error: "خطا در به‌روزرسانی اعلان‌ها" }, { status: 500 });
  }
}
