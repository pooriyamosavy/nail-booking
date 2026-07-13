"use client";

import { useEffect, useState } from "react";
import JalaliCalendar from "@/components/JalaliCalendar";
import {
  ADMIN_AUTH_KEY,
  APPOINTMENT_STATUS_LABELS,
  formatDateKey,
  formatPersianDate,
  getServiceById,
  isPastDate,
  TIME_SLOTS,
  TimeSlot,
} from "@/lib/constants";
import { formatTimeRange } from "@/lib/scheduling";

interface Appointment {
  _id: string;
  date: string;
  time: string;
  name: string;
  serviceId: string;
  durationMinutes: number;
  phone: string;
  notes?: string;
  status: "pending" | "approved" | "cancelled" | "booked";
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [closedSlots, setClosedSlots] = useState<TimeSlot[]>([]);
  const [bookedSlots, setBookedSlots] = useState<TimeSlot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingDay, setSavingDay] = useState(false);
  const [savingSlots, setSavingSlots] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function restoreSession() {
      const savedPassword = sessionStorage.getItem(ADMIN_AUTH_KEY);
      if (!savedPassword) {
        setAuthChecked(true);
        return;
      }

      try {
        const response = await fetch("/api/admin/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: savedPassword }),
        });

        if (response.ok) {
          setPassword(savedPassword);
          setAuthenticated(true);
        } else {
          sessionStorage.removeItem(ADMIN_AUTH_KEY);
        }
      } catch {
        sessionStorage.removeItem(ADMIN_AUTH_KEY);
      } finally {
        setAuthChecked(true);
      }
    }

    restoreSession();
  }, []);

  useEffect(() => {
    if (!authenticated || !selectedDate) {
      return;
    }

    const date = selectedDate;

    async function loadAdminData() {
      setLoading(true);
      setError("");

      const dateKey = formatDateKey(date);

      try {
        const [availabilityResponse, appointmentsResponse] = await Promise.all([
          fetch(`/api/availability?date=${dateKey}`),
          fetch(`/api/appointments?date=${dateKey}`),
        ]);

        const availability = await availabilityResponse.json();
        const appointmentData = await appointmentsResponse.json();

        if (!availabilityResponse.ok) {
          throw new Error(availability.error ?? "خطا در بارگذاری وضعیت روز");
        }

        if (!appointmentsResponse.ok) {
          throw new Error(appointmentData.error ?? "خطا در بارگذاری نوبت‌ها");
        }

        setIsActive(Boolean(availability.isActive));
        setClosedSlots(availability.closedSlots ?? []);
        setBookedSlots(availability.bookedSlots ?? []);
        setAppointments(appointmentData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "مشکلی پیش آمد");
      } finally {
        setLoading(false);
      }
    }

    loadAdminData();
  }, [authenticated, selectedDate]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = password.trim();
    if (!trimmed) return;

    setError("");

    try {
      const response = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: trimmed }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "رمز عبور نادرست است");
      }

      sessionStorage.setItem(ADMIN_AUTH_KEY, trimmed);
      setAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ورود ناموفق بود");
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(ADMIN_AUTH_KEY);
    setAuthenticated(false);
    setPassword("");
    setSelectedDate(null);
    setAppointments([]);
    setMessage("");
    setError("");
  }

  async function toggleActiveDay() {
    if (!selectedDate) return;

    setSavingDay(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/availability", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({
          date: formatDateKey(selectedDate),
          isActive: !isActive,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "خطا در به‌روزرسانی روز");
      }

      setIsActive(!isActive);
      setMessage(
        !isActive ? "این روز برای رزرو باز شد." : "این روز برای رزرو بسته شد.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "مشکلی پیش آمد");
    } finally {
      setSavingDay(false);
    }
  }

  async function toggleClosedSlot(slot: TimeSlot) {
    if (!selectedDate || bookedSlots.includes(slot)) return;

    const nextClosed = closedSlots.includes(slot)
      ? closedSlots.filter((item) => item !== slot)
      : [...closedSlots, slot];

    setSavingSlots(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/availability", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({
          date: formatDateKey(selectedDate),
          closedSlots: nextClosed,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "خطا در به‌روزرسانی ساعات");
      }

      setClosedSlots(nextClosed);
      setMessage(
        closedSlots.includes(slot)
          ? `ساعت ${slot} برای رزرو باز شد.`
          : `ساعت ${slot} برای رزرو بسته شد.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "مشکلی پیش آمد");
    } finally {
      setSavingSlots(false);
    }
  }

  async function updateAppointmentStatus(
    id: string,
    status: "approved" | "cancelled",
  ) {
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "خطا در به‌روزرسانی نوبت");
      }

      setAppointments((items) =>
        items.map((item) => (item._id === id ? { ...item, status } : item)),
      );
      setMessage(status === "approved" ? "نوبت تأیید شد." : "نوبت لغو شد.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "مشکلی پیش آمد");
    }
  }

  function displayStatus(status: Appointment["status"]): string {
    return APPOINTMENT_STATUS_LABELS[status] ?? status;
  }

  function statusClass(status: Appointment["status"]): string {
    if (status === "pending") return "bg-amber-100 text-amber-800";
    if (status === "cancelled") return "bg-red-100 text-red-800";
    return "bg-green-100 text-green-800";
  }

  const canToggle = selectedDate && !isPastDate(selectedDate);

  if (!authChecked) {
    return null;
  }

  if (!authenticated) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">ورود مدیر</h1>
        <p className="mt-2 text-sm text-muted">
          برای مدیریت روزها و نوبت‌ها رمز عبور را وارد کنید.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleLogin}>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              رمز عبور
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2 outline-none focus:border-primary"
              placeholder="رمز عبور مدیر"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-primary px-4 py-3 font-medium text-white transition hover:bg-primary-dark"
          >
            ورود
          </button>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </form>
      </div>
    );
  }

  return (
    <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">مدیریت روزها</h1>
            <p className="mt-2 text-sm text-muted">
              همه روزها به‌صورت پیش‌فرض باز هستند (۱۰ صبح تا ۶ عصر).
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="shrink-0 rounded-lg border border-border px-3 py-1 text-sm text-muted hover:bg-accent"
          >
            خروج
          </button>
        </div>

        <div className="mt-6">
          <JalaliCalendar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </div>

        {selectedDate && (
          <div className="mt-6 rounded-xl bg-accent px-4 py-4">
            <p className="text-sm">
              روز انتخاب‌شده:{" "}
              <span className="font-medium">
                {formatPersianDate(selectedDate)}
              </span>
            </p>
            <p className="mt-1 text-sm">
              وضعیت:{" "}
              <span className="font-medium">
                {isActive ? "باز برای رزرو" : "بسته برای رزرو"}
              </span>
            </p>

            {canToggle && (
              <button
                type="button"
                onClick={toggleActiveDay}
                disabled={savingDay}
                className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingDay
                  ? "در حال ذخیره..."
                  : isActive
                    ? "بستن این روز"
                    : "باز کردن این روز"}
              </button>
            )}

            {canToggle && isActive && (
              <div className="mt-6">
                <h3 className="text-sm font-medium">بستن ساعات</h3>
                <p className="mt-1 text-xs text-muted">
                  روی هر ساعت کلیک کنید تا برای رزرو بسته یا باز شود. ساعات
                  رزرو شده قابل تغییر نیستند.
                </p>
                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {TIME_SLOTS.map((slot) => {
                    const isBooked = bookedSlots.includes(slot);
                    const isClosed = closedSlots.includes(slot);

                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={savingSlots || isBooked}
                        onClick={() => toggleClosedSlot(slot)}
                        className={`rounded-lg border px-2 py-2 text-xs transition ${
                          isBooked
                            ? "cursor-not-allowed border-border bg-muted/20 text-muted"
                            : isClosed
                              ? "border-red-300 bg-red-50 text-red-800"
                              : "border-border bg-background hover:border-primary hover:bg-accent"
                        }`}
                        dir="ltr"
                        title={
                          isBooked
                            ? "رزرو شده"
                            : isClosed
                              ? "بسته — کلیک برای باز کردن"
                              : "باز — کلیک برای بستن"
                        }
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            {message && (
              <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
                {message}
              </p>
            )}

          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-2xl font-semibold">نوبت‌های رزرو شده</h2>
        <p className="mt-2 text-sm text-muted">
          نوبت‌های روز انتخاب‌شده را مشاهده و لغو کنید.
        </p>

        <div className="mt-6 flex min-h-64 flex-col">
          {!selectedDate && (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background px-6 py-12 text-center">
              <p className="text-sm text-muted">
                برای مشاهده نوبت‌ها، ابتدا یک تاریخ انتخاب کنید.
              </p>
            </div>
          )}

          {selectedDate && loading && (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-muted">در حال بارگذاری...</p>
            </div>
          )}

          {selectedDate && !loading && appointments.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background px-6 py-12 text-center">
              <p className="text-sm text-muted">
                نوبتی برای این روز ثبت نشده است.
              </p>
            </div>
          )}

          {selectedDate && !loading && appointments.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                {formatPersianDate(selectedDate)}
              </p>
              {appointments.map((appointment) => {
                const service = getServiceById(appointment.serviceId);
                const duration = appointment.durationMinutes ?? 60;

                return (
                <div
                  key={appointment._id}
                  className="rounded-xl border border-border px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{appointment.name}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${statusClass(appointment.status)}`}
                        >
                          {displayStatus(appointment.status)}
                        </span>
                      </div>
                      <p className="text-sm text-muted">
                        {service?.label ?? appointment.serviceId}
                      </p>
                      <p className="text-sm text-muted" dir="ltr">
                        {formatTimeRange(appointment.time, duration)}
                      </p>
                      <p className="text-sm text-muted" dir="ltr">
                        {appointment.phone}
                      </p>
                      {appointment.notes && (
                        <p className="mt-1 text-sm text-muted">
                          {appointment.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      {appointment.status === "pending" && (
                        <button
                          type="button"
                          onClick={() =>
                            updateAppointmentStatus(appointment._id, "approved")
                          }
                          className="rounded-lg border border-green-200 px-3 py-1 text-sm text-green-700 transition hover:bg-green-50"
                        >
                          تأیید
                        </button>
                      )}
                      {appointment.status !== "cancelled" && (
                        <button
                          type="button"
                          onClick={() =>
                            updateAppointmentStatus(appointment._id, "cancelled")
                          }
                          className="rounded-lg border border-red-200 px-3 py-1 text-sm text-red-700 transition hover:bg-red-50"
                        >
                          لغو
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {message && (
          <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
