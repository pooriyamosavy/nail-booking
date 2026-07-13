"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PAGE_CONTAINER_CLASS, PHONE_STORAGE_KEY, getTodayKey } from "@/lib/constants";

export default function Navbar() {
  const [showModal, setShowModal] = useState(false);
  const [phone, setPhone] = useState("");
  const [sendingSms, setSendingSms] = useState(false);
  const [smsMessage, setSmsMessage] = useState("");
  const [smsError, setSmsError] = useState("");

  useEffect(() => {
    const storedPhone = localStorage.getItem(PHONE_STORAGE_KEY) ?? "";
    setPhone(storedPhone);
  }, []);

  function openSmsModal() {
    const storedPhone = localStorage.getItem(PHONE_STORAGE_KEY) ?? "";
    setPhone(storedPhone);
    setSmsMessage("");
    setSmsError("");
    setShowModal(true);
  }

  async function sendAppointmentsSms(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!phone.trim()) return;

    setSendingSms(true);
    setSmsMessage("");
    setSmsError("");

    try {
      const response = await fetch("/api/sms/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          from: getTodayKey(),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "ارسال پیامک ناموفق بود");
      }

      setSmsMessage(
        data.appointmentCount > 0
          ? "لیست نوبت‌ها به صورت آزمایشی (mock) ارسال شد."
          : "نوبتی برای ارسال یافت نشد.",
      );
    } catch (err) {
      setSmsError(err instanceof Error ? err.message : "مشکلی پیش آمد");
    } finally {
      setSendingSms(false);
    }
  }

  return (
    <>
      <header className="border-b border-border bg-card/80 backdrop-blur" dir="ltr">
        <div className={`${PAGE_CONTAINER_CLASS} flex items-center justify-between py-4`}>
          <Link href="/" className="text-xl font-semibold text-primary">
            رزرو نوبت ناخن
          </Link>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openSmsModal}
              className="rounded-xl border border-border p-2 text-primary transition hover:bg-accent"
              aria-label="ارسال پیامک نوبت‌ها"
              title="ارسال پیامک نوبت‌ها"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
              >
                <path d="M8 2v4" />
                <path d="M16 2v4" />
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <path d="M3 10h18" />
                <path d="M8 14h.01" />
                <path d="M12 14h.01" />
                <path d="M16 14h.01" />
                <path d="M8 18h.01" />
                <path d="M12 18h.01" />
              </svg>
            </button>
            <Link href="/" aria-label="صفحه اصلی">
              <Image
                src="/logo.svg"
                alt="لوگو"
                width={44}
                height={44}
                priority
              />
            </Link>
          </div>
        </div>
      </header>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          dir="rtl"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">ارسال پیامک نوبت‌ها</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg px-2 py-1 text-muted hover:bg-accent"
                aria-label="بستن"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-sm text-muted">
              شماره موبایل خود را وارد کنید تا لیست نوبت‌های آینده برایتان
              پیامک شود.
            </p>

            <form onSubmit={sendAppointmentsSms} className="mt-4 space-y-3">
              <div>
                <label htmlFor="my-phone" className="mb-1 block text-sm font-medium">
                  شماره موبایل
                </label>
                <input
                  id="my-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="w-full rounded-xl border border-border px-3 py-2 outline-none focus:border-primary"
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                  dir="ltr"
                />
              </div>
              <button
                type="submit"
                disabled={!phone.trim() || sendingSms}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {sendingSms ? "در حال ارسال..." : "ارسال پیامک نوبت‌ها"}
              </button>
            </form>

            {smsMessage && (
              <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">
                {smsMessage}
              </p>
            )}

            {smsError && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {smsError}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
