"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ATTENDANCE_LABELS,
  APPOINTMENT_STATUS_LABELS,
  addJalaliMonths,
  formatDateKey,
  formatPersianDate,
  getJalaliMonth,
  getJalaliMonthDays,
  getJalaliMonthLabel,
  parseDateKey,
} from "@/lib/constants";
import { formatPrice } from "@/lib/service-types";
import { formatTimeRange } from "@/lib/scheduling";

interface ProfileUser {
  id: string;
  phone: string;
  name: string | null;
  role: string;
}

interface AppointmentRow {
  _id: string;
  date: string;
  time: string;
  serviceId: string;
  durationMinutes: number;
  price?: number;
  status: keyof typeof APPOINTMENT_STATUS_LABELS;
  attendance?: keyof typeof ATTENDANCE_LABELS;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function ProfilePage() {
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [serviceNames, setServiceNames] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const todayMonth = getJalaliMonth(new Date());
  const [jy, setJy] = useState(todayMonth.jy);
  const [jm, setJm] = useState(todayMonth.jm);

  const load = useCallback(async () => {
    const [meRes, svcRes] = await Promise.all([
      fetch("/api/profile"),
      fetch("/api/services"),
    ]);
    if (meRes.ok) {
      const data = await meRes.json();
      setUser(data.user);
      setName(data.user.name ?? "");
      setPhone(data.user.phone);
    }
    if (svcRes.ok) {
      const data = await svcRes.json();
      setServiceNames(
        Object.fromEntries(
          (data.services ?? []).map((s: { slug: string; name: string }) => [
            s.slug,
            s.name,
          ]),
        ),
      );
    }
  }, []);

  const loadMonthAppointments = useCallback(async () => {
    const days = getJalaliMonthDays(jy, jm);
    if (days.length === 0) return;
    const from = formatDateKey(days[0]);
    const to = formatDateKey(days[days.length - 1]);
    const res = await fetch(`/api/appointments?mine=1&from=${from}&to=${to}`);
    if (res.ok) {
      const data = await res.json();
      setAppointments(Array.isArray(data) ? data : []);
    }
  }, [jy, jm]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadMonthAppointments();
  }, [loadMonthAppointments]);

  useEffect(() => {
    async function checkPush() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        setPushEnabled(Boolean(sub));
      } catch {
        setPushEnabled(false);
      }
    }
    checkPush();
  }, []);

  const chartData = useMemo(() => {
    const monthDays = getJalaliMonthDays(jy, jm);
    const counts = Array.from({ length: monthDays.length }, () => 0);
    const keyToIndex = new Map(
      monthDays.map((d, i) => [formatDateKey(d), i]),
    );
    for (const appt of appointments) {
      if (appt.status === "cancelled") continue;
      const idx = keyToIndex.get(appt.date);
      if (idx != null) counts[idx] += 1;
    }
    const max = Math.max(1, ...counts);
    return { counts, max };
  }, [appointments, jy, jm]);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const phoneChanged = user && phone.trim() !== user.phone;
      const body: Record<string, string> = { name };
      if (phoneChanged) {
        body.phone = phone;
        body.currentPassword = currentPassword;
      }
      if (newPassword) {
        body.newPassword = newPassword;
        body.currentPassword = currentPassword;
      }

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ذخیره ناموفق بود");

      setUser(data.user);
      setName(data.user.name ?? "");
      setPhone(data.user.phone);
      setCurrentPassword("");
      setNewPassword("");
      setMessage("پروفایل ذخیره شد.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا");
    } finally {
      setSaving(false);
    }
  }

  async function enablePush() {
    setPushBusy(true);
    setError("");
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        throw new Error("کلید اعلان مرورگر تنظیم نشده است");
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("مرورگر از اعلان پشتیبانی نمی‌کند");
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("اجازه اعلان داده نشد");
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ثبت اشتراک ناموفق");
      setPushEnabled(true);
      setMessage("اعلان‌های مرورگر فعال شد.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در فعال‌سازی اعلان");
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setPushEnabled(false);
      setMessage("اعلان‌های مرورگر غیرفعال شد.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا");
    } finally {
      setPushBusy(false);
    }
  }

  function shiftMonth(delta: number) {
    const next = addJalaliMonths(jy, jm, delta);
    setJy(next.jy);
    setJm(next.jm);
  }

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-semibold text-primary">پروفایل</h1>
        <p className="mt-1 text-sm text-muted">اطلاعات حساب و تاریخچه نوبت‌ها</p>

        <form onSubmit={saveProfile} className="mt-6 max-w-lg space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">نام</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2 outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">شماره موبایل</label>
            <input
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2 outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              رمز فعلی (برای تغییر شماره یا رمز)
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2 outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">رمز جدید</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2 outline-none focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
          </button>
        </form>

        <div className="mt-6 flex flex-wrap gap-2">
          {!pushEnabled ? (
            <button
              type="button"
              disabled={pushBusy}
              onClick={enablePush}
              className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
            >
              فعال‌سازی اعلان مرورگر
            </button>
          ) : (
            <button
              type="button"
              disabled={pushBusy}
              onClick={disablePush}
              className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
            >
              غیرفعال‌سازی اعلان مرورگر
            </button>
          )}
        </div>

        {message && (
          <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">نوبت‌های ماه</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="rounded-lg border border-border px-3 py-1 text-sm"
            >
              ماه قبل
            </button>
            <span className="text-sm font-medium">
              {getJalaliMonthLabel(jy, jm)}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="rounded-lg border border-border px-3 py-1 text-sm"
            >
              ماه بعد
            </button>
          </div>
        </div>

        <div className="mt-4 flex h-40 items-end gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-4">
          {chartData.counts.map((count, index) => (
            <div
              key={index}
              className="flex min-w-[10px] flex-1 flex-col items-center justify-end"
              title={`روز ${(index + 1).toLocaleString("fa-IR")}: ${count.toLocaleString("fa-IR")}`}
            >
              <div
                className="w-full rounded-t bg-primary/80 transition-all"
                style={{
                  height: `${Math.max(count > 0 ? 12 : 2, (count / chartData.max) * 100)}%`,
                }}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          تعداد نوبت‌های ثبت‌شده در هر روز این ماه (بدون لغوشده‌ها)
        </p>

        <div className="mt-6 space-y-3">
          {appointments.length === 0 && (
            <p className="text-sm text-muted">نوبتی در این ماه نیست.</p>
          )}
          {appointments.map((appt) => (
            <div
              key={appt._id}
              className="rounded-2xl border border-border p-4 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {serviceNames[appt.serviceId] ?? appt.serviceId}
                </p>
                <span className="rounded-full bg-accent px-2 py-0.5 text-xs">
                  {ATTENDANCE_LABELS[appt.attendance ?? "unset"]}
                </span>
              </div>
              <p className="mt-1 text-muted">
                {formatPersianDate(parseDateKey(appt.date))} ·{" "}
                <span dir="ltr">
                  {formatTimeRange(appt.time, appt.durationMinutes)}
                </span>
              </p>
              <p className="mt-1 text-muted">
                {APPOINTMENT_STATUS_LABELS[appt.status] ?? appt.status}
                {appt.price != null ? ` · ${formatPrice(appt.price)}` : ""}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
