"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const AUTH_PAGES = new Set(["/login", "/register"]);

/**
 * If the session cookie is valid but the user no longer exists in DB,
 * clear the session and send them to login.
 */
export default function SessionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const kicking = useRef(false);

  useEffect(() => {
    if (AUTH_PAGES.has(pathname)) return;
    if (kicking.current) return;

    let cancelled = false;

    async function kickToLogin() {
      if (kicking.current || cancelled) return;
      kicking.current = true;
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      const next = encodeURIComponent(pathname || "/");
      router.replace(`/login?next=${next}`);
      router.refresh();
    }

    async function verify() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (cancelled) return;

        if (res.status === 401) {
          await kickToLogin();
          return;
        }

        // Defensive: older responses used 500 with this message
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (
            res.status === 500 ||
            data?.code === "USER_NOT_FOUND" ||
            data?.error === "خطا در دریافت کاربر" ||
            data?.error === "کاربر یافت نشد. دوباره وارد شوید"
          ) {
            await kickToLogin();
          }
        }
      } catch {
        // network blip — don't kick
      }
    }

    void verify();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return <>{children}</>;
}
