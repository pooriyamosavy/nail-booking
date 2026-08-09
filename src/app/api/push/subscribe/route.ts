import { NextRequest, NextResponse } from "next/server";
import { unauthorizedClearSession } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { isMockMode, type MockUser } from "@/lib/mock-store";
import { requireAuthUser } from "@/lib/require-user";
import { User, type PushSubscriptionData } from "@/models/User";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthUser();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { endpoint, keys } = body as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "اشتراک نامعتبر است" }, { status: 400 });
    }

    const sub = {
      endpoint,
      keys: { p256dh: keys.p256dh, auth: keys.auth },
    };

    if (isMockMode()) {
      const user = auth.doc as MockUser;
      user.pushSubscriptions = [
        ...user.pushSubscriptions.filter((s) => s.endpoint !== endpoint),
        sub,
      ];
      return NextResponse.json({ ok: true });
    }

    await connectDB();
    const user = await User.findById(auth.user.id);
    if (!user) return unauthorizedClearSession();

    user.pushSubscriptions = [
      ...user.pushSubscriptions.filter(
        (s: PushSubscriptionData) => s.endpoint !== endpoint,
      ),
      sub,
    ];
    await user.save();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/push/subscribe error:", error);
    return NextResponse.json({ error: "ثبت اشتراک ناموفق بود" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuthUser();
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const { endpoint } = body as { endpoint?: string };

    if (isMockMode()) {
      const user = auth.doc as MockUser;
      if (endpoint) {
        user.pushSubscriptions = user.pushSubscriptions.filter(
          (s) => s.endpoint !== endpoint,
        );
      } else {
        user.pushSubscriptions = [];
      }
      return NextResponse.json({ ok: true });
    }

    await connectDB();
    const user = await User.findById(auth.user.id);
    if (!user) return unauthorizedClearSession();

    if (endpoint) {
      user.pushSubscriptions = user.pushSubscriptions.filter(
        (s: PushSubscriptionData) => s.endpoint !== endpoint,
      );
    } else {
      user.pushSubscriptions = [];
    }
    await user.save();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/push/subscribe error:", error);
    return NextResponse.json({ error: "حذف اشتراک ناموفق بود" }, { status: 500 });
  }
}
