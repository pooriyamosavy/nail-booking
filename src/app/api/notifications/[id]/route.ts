import { NextRequest, NextResponse } from "next/server";
import { markNotificationRead } from "@/lib/notifications";
import { requireAuthUser } from "@/lib/require-user";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuthUser();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const notification = await markNotificationRead(auth.user.id, id);
    if (!notification) {
      return NextResponse.json({ error: "اعلان یافت نشد" }, { status: 404 });
    }
    return NextResponse.json({ notification });
  } catch (error) {
    console.error("PATCH /api/notifications/[id] error:", error);
    return NextResponse.json({ error: "خطا در به‌روزرسانی اعلان" }, { status: 500 });
  }
}
