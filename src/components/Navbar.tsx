"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PAGE_CONTAINER_CLASS } from "@/lib/constants";

interface AuthUser {
  id: string;
  phone: string;
  name: string | null;
  role: "user" | "admin";
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = pathname === "/login" || pathname === "/register";

  const [user, setUser] = useState<AuthUser | null>(null);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const loadUser = useCallback(async () => {
    if (isAuthPage) {
      setLoaded(true);
      return;
    }
    try {
      const [meRes, notifRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/notifications"),
      ]);
      if (meRes.ok) {
        const data = await meRes.json();
        setUser(data.user);
      } else if (meRes.status === 401 || meRes.status >= 500) {
        setUser(null);
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        router.refresh();
        return;
      } else {
        setUser(null);
      }
      if (notifRes.ok) {
        const data = await notifRes.json();
        setUnread(data.unreadCount ?? 0);
      }
    } catch {
      setUser(null);
    } finally {
      setLoaded(true);
    }
  }, [isAuthPage, pathname, router]);

  useEffect(() => {
    loadUser();
  }, [loadUser, pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.replace("/login");
    router.refresh();
  }

  if (isAuthPage) {
    return (
      <header className="border-b border-border bg-card/80 backdrop-blur" dir="ltr">
        <div className={`${PAGE_CONTAINER_CLASS} flex items-center justify-between py-4`}>
          <span className="text-xl font-semibold text-primary">رزرو نوبت ناخن</span>
          <Image src="/logo.svg" alt="لوگو" width={44} height={44} priority />
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur" dir="ltr">
      <div className={`${PAGE_CONTAINER_CLASS} flex items-center justify-between py-4`}>
        <Link href="/" className="text-xl font-semibold text-primary">
          رزرو نوبت ناخن
        </Link>
        <div className="flex items-center gap-2 sm:gap-3" dir="rtl">
          {loaded && user && (
            <>
              {user.role === "admin" && (
                <Link
                  href="/admin"
                  className="rounded-xl border border-border px-3 py-2 text-sm transition hover:bg-accent"
                >
                  مدیریت
                </Link>
              )}
              <Link
                href="/profile"
                className="rounded-xl border border-border px-3 py-2 text-sm transition hover:bg-accent"
              >
                پروفایل
              </Link>
              <Link
                href="/notifications"
                className="relative rounded-xl border border-border p-2 text-primary transition hover:bg-accent"
                aria-label="اعلان‌ها"
                title="اعلان‌ها"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-5 w-5"
                >
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                {unread > 0 && (
                  <span className="absolute -top-1 -left-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-white">
                    {unread > 9 ? "۹+" : unread.toLocaleString("fa-IR")}
                  </span>
                )}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-border px-3 py-2 text-sm transition hover:bg-accent"
              >
                خروج
              </button>
            </>
          )}
          <Link href="/" aria-label="صفحه اصلی">
            <Image src="/logo.svg" alt="لوگو" width={44} height={44} priority />
          </Link>
        </div>
      </div>
    </header>
  );
}
