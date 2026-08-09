"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface NotificationItem {
  _id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  type?: string;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "خطا");
      setItems(data.notifications ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH" });
    await load();
  }

  async function markOne(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setItems((prev) =>
      prev.map((n) => (n._id === id ? { ...n, read: true } : n)),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-primary">اعلان‌ها</h1>
          <p className="mt-1 text-sm text-muted">پیام‌های مربوط به نوبت‌ها</p>
        </div>
        <button
          type="button"
          onClick={markAllRead}
          className="rounded-xl border border-border px-3 py-2 text-sm hover:bg-accent"
        >
          خواندن همه
        </button>
      </div>

      {loading && <p className="text-muted">در حال بارگذاری...</p>}
      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {!loading && items.length === 0 && (
        <p className="text-sm text-muted">اعلانی ندارید.</p>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <button
            key={item._id}
            type="button"
            onClick={() => !item.read && markOne(item._id)}
            className={`w-full rounded-2xl border p-4 text-right transition ${
              item.read
                ? "border-border bg-card"
                : "border-primary/40 bg-accent"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">{item.title}</p>
              {!item.read && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-white">
                  جدید
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted">{item.body}</p>
            <p className="mt-2 text-xs text-muted" dir="ltr">
              {new Date(item.createdAt).toLocaleString("fa-IR")}
            </p>
          </button>
        ))}
      </div>

      <Link href="/profile" className="text-sm text-primary">
        مشاهده پروفایل
      </Link>
    </div>
  );
}
