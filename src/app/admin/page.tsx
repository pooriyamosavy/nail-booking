"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import JalaliCalendar from "@/components/JalaliCalendar";
import {
  ATTENDANCE_LABELS,
  APPOINTMENT_STATUS_LABELS,
  formatDateKey,
  formatPersianDate,
  isPastDate,
  TIME_SLOTS,
  TimeSlot,
  type AttendanceStatus,
} from "@/lib/constants";
import { formatTimeRange } from "@/lib/scheduling";
import { formatPrice, type PublicService } from "@/lib/service-types";

interface Appointment {
  _id: string;
  date: string;
  time: string;
  name: string;
  serviceId: string;
  durationMinutes: number;
  price?: number;
  phone: string;
  notes?: string;
  status: "pending" | "approved" | "cancelled" | "booked";
  attendance?: AttendanceStatus;
}

type AdminTab = "schedule" | "services";

export default function AdminPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [tab, setTab] = useState<AdminTab>("schedule");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [closedSlots, setClosedSlots] = useState<TimeSlot[]>([]);
  const [bookedSlots, setBookedSlots] = useState<TimeSlot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<PublicService[]>([]);
  const [serviceNames, setServiceNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savingDay, setSavingDay] = useState(false);
  const [savingSlots, setSavingSlots] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [svcName, setSvcName] = useState("");
  const [svcPrice, setSvcPrice] = useState("");
  const [svcDuration, setSvcDuration] = useState("60");
  const [savingService, setSavingService] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.replace("/login?next=/admin");
          return;
        }
        const data = await res.json();
        if (data.user?.role !== "admin") {
          router.replace("/");
          return;
        }
        setAuthenticated(true);
      } catch {
        router.replace("/login?next=/admin");
      } finally {
        setAuthChecked(true);
      }
    }
    checkAdmin();
  }, [router]);

  async function loadServices() {
    const res = await fetch("/api/services?all=1");
    if (!res.ok) return;
    const data = await res.json();
    const list = (data.services ?? []) as PublicService[];
    setServices(list);
    setServiceNames(Object.fromEntries(list.map((s) => [s.slug, s.name])));
  }

  useEffect(() => {
    if (authenticated) loadServices();
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated || !selectedDate) return;

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

  async function updateDay(nextActive: boolean) {
    if (!selectedDate || isPastDate(selectedDate)) return;
    setSavingDay(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: formatDateKey(selectedDate),
          isActive: nextActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ذخیره ناموفق");
      setIsActive(nextActive);
      setMessage(nextActive ? "روز باز شد." : "روز بسته شد.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا");
    } finally {
      setSavingDay(false);
    }
  }

  async function toggleSlot(slot: TimeSlot) {
    if (!selectedDate || isPastDate(selectedDate)) return;
    if (bookedSlots.includes(slot)) return;

    const next = closedSlots.includes(slot)
      ? closedSlots.filter((s) => s !== slot)
      : [...closedSlots, slot];

    setSavingSlots(true);
    setError("");
    try {
      const res = await fetch("/api/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: formatDateKey(selectedDate),
          closedSlots: next,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ذخیره ناموفق");
      setClosedSlots(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا");
    } finally {
      setSavingSlots(false);
    }
  }

  async function patchAppointment(
    id: string,
    body: { status?: "approved" | "cancelled"; attendance?: AttendanceStatus },
  ) {
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "به‌روزرسانی ناموفق");
      setAppointments((prev) =>
        prev.map((a) => (a._id === id ? { ...a, ...data } : a)),
      );
      setMessage("نوبت به‌روز شد.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا");
    }
  }

  async function createService(event: React.FormEvent) {
    event.preventDefault();
    setSavingService(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: svcName,
          price: Number(svcPrice),
          durationMinutes: Number(svcDuration),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ایجاد خدمت ناموفق");
      setSvcName("");
      setSvcPrice("");
      setSvcDuration("60");
      setMessage("خدمت اضافه شد.");
      await loadServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا");
    } finally {
      setSavingService(false);
    }
  }

  async function toggleServiceActive(service: PublicService) {
    const res = await fetch(`/api/services/${service._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !service.isActive }),
    });
    if (res.ok) await loadServices();
  }

  async function deleteService(service: PublicService) {
    if (!confirm(`حذف «${service.name}»؟`)) return;
    const res = await fetch(`/api/services/${service._id}`, { method: "DELETE" });
    if (res.ok) await loadServices();
  }

  if (!authChecked) {
    return <p className="text-muted">در حال بررسی دسترسی...</p>;
  }

  if (!authenticated) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-primary">پنل مدیریت</h1>
          <p className="mt-1 text-sm text-muted">زمان‌بندی، نوبت‌ها و خدمات</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("schedule")}
            className={`rounded-xl px-3 py-2 text-sm ${
              tab === "schedule" ? "bg-primary text-white" : "border border-border"
            }`}
          >
            زمان‌بندی
          </button>
          <button
            type="button"
            onClick={() => setTab("services")}
            className={`rounded-xl px-3 py-2 text-sm ${
              tab === "services" ? "bg-primary text-white" : "border border-border"
            }`}
          >
            خدمات
          </button>
        </div>
      </div>

      {message && (
        <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {tab === "services" && (
        <section className="space-y-6">
          <form
            onSubmit={createService}
            className="grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-4"
          >
            <input
              required
              placeholder="نام خدمت"
              value={svcName}
              onChange={(e) => setSvcName(e.target.value)}
              className="rounded-xl border border-border px-3 py-2 sm:col-span-2"
            />
            <input
              required
              type="number"
              min={0}
              placeholder="قیمت (تومان)"
              value={svcPrice}
              onChange={(e) => setSvcPrice(e.target.value)}
              className="rounded-xl border border-border px-3 py-2"
              dir="ltr"
            />
            <input
              required
              type="number"
              min={15}
              step={15}
              placeholder="دقیقه"
              value={svcDuration}
              onChange={(e) => setSvcDuration(e.target.value)}
              className="rounded-xl border border-border px-3 py-2"
              dir="ltr"
            />
            <button
              type="submit"
              disabled={savingService}
              className="rounded-xl bg-primary px-4 py-2 text-sm text-white disabled:opacity-50 sm:col-span-4"
            >
              {savingService ? "در حال افزودن..." : "افزودن خدمت"}
            </button>
          </form>

          <div className="space-y-3">
            {services.map((service) => (
              <div
                key={service._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4"
              >
                <div>
                  <p className="font-medium">
                    {service.name}
                    {!service.isActive && (
                      <span className="mr-2 text-xs text-muted">(غیرفعال)</span>
                    )}
                  </p>
                  <p className="text-sm text-muted">
                    {service.durationMinutes} دقیقه · {formatPrice(service.price)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => toggleServiceActive(service)}
                    className="rounded-xl border border-border px-3 py-1.5 text-sm"
                  >
                    {service.isActive ? "غیرفعال" : "فعال"}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteService(service)}
                    className="rounded-xl border border-red-200 px-3 py-1.5 text-sm text-red-700"
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "schedule" && (
        <>
          <JalaliCalendar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            isDateDisabled={() => false}
          />

          {selectedDate && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">
                  {formatPersianDate(selectedDate)}
                </h2>
                {!isPastDate(selectedDate) && (
                  <button
                    type="button"
                    disabled={savingDay}
                    onClick={() => updateDay(!isActive)}
                    className="rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-50"
                  >
                    {isActive ? "بستن روز" : "باز کردن روز"}
                  </button>
                )}
              </div>

              {loading ? (
                <p className="text-muted">در حال بارگذاری...</p>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                    {TIME_SLOTS.map((slot) => {
                      const booked = bookedSlots.includes(slot);
                      const closed = closedSlots.includes(slot);
                      return (
                        <button
                          key={slot}
                          type="button"
                          dir="ltr"
                          disabled={booked || isPastDate(selectedDate) || savingSlots}
                          onClick={() => toggleSlot(slot)}
                          className={`rounded-lg border px-2 py-2 text-xs ${
                            booked
                              ? "border-green-300 bg-green-50 text-green-800"
                              : closed
                                ? "border-red-200 bg-red-50 text-red-700"
                                : "border-border"
                          } disabled:opacity-60`}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-medium">نوبت‌های روز</h3>
                    {appointments.length === 0 && (
                      <p className="text-sm text-muted">نوبتی نیست.</p>
                    )}
                    {appointments.map((appt) => (
                      <div
                        key={appt._id}
                        className="rounded-2xl border border-border p-4 text-sm"
                      >
                        <p className="font-medium">
                          {appt.name} · {appt.phone}
                        </p>
                        <p className="mt-1 text-muted">
                          {serviceNames[appt.serviceId] ?? appt.serviceId} ·{" "}
                          <span dir="ltr">
                            {formatTimeRange(appt.time, appt.durationMinutes)}
                          </span>
                          {appt.price != null ? ` · ${formatPrice(appt.price)}` : ""}
                        </p>
                        <p className="mt-1">
                          وضعیت:{" "}
                          {APPOINTMENT_STATUS_LABELS[appt.status] ?? appt.status}
                        </p>
                        {appt.notes && (
                          <p className="mt-1 text-muted">یادداشت: {appt.notes}</p>
                        )}

                        <div className="mt-3 flex flex-wrap gap-2">
                          {appt.status === "pending" && (
                            <button
                              type="button"
                              onClick={() =>
                                patchAppointment(appt._id, { status: "approved" })
                              }
                              className="rounded-xl bg-primary px-3 py-1.5 text-xs text-white"
                            >
                              تأیید
                            </button>
                          )}
                          {appt.status !== "cancelled" && (
                            <button
                              type="button"
                              onClick={() =>
                                patchAppointment(appt._id, { status: "cancelled" })
                              }
                              className="rounded-xl border border-red-200 px-3 py-1.5 text-xs text-red-700"
                            >
                              لغو
                            </button>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="text-xs text-muted self-center">حضور:</span>
                          {(
                            ["unset", "present", "absent"] as AttendanceStatus[]
                          ).map((value) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() =>
                                patchAppointment(appt._id, { attendance: value })
                              }
                              className={`rounded-xl px-3 py-1.5 text-xs ${
                                (appt.attendance ?? "unset") === value
                                  ? "bg-accent text-primary"
                                  : "border border-border"
                              }`}
                            >
                              {ATTENDANCE_LABELS[value]}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
