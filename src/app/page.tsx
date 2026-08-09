"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import JalaliCalendar from "@/components/JalaliCalendar";
import {
  APPOINTMENT_STATUS_LABELS,
  formatDateKey,
  formatPersianDate,
  getTodayKey,
  isDateDisabled,
  parseDateKey,
  TimeSlot,
} from "@/lib/constants";
import {
  formatTimeRange,
  getAppointmentDateTime,
  formatTimeRemaining,
} from "@/lib/scheduling";
import {
  BookingProgress,
  BookingStep,
  buildBookingSearchParams,
  clearBookingProgress,
  parseBookingStep,
  saveBookingProgress,
} from "@/lib/booking-state";
import { formatPrice, type PublicService } from "@/lib/service-types";

interface AvailabilityResponse {
  date: string;
  isActive: boolean;
  availableStarts: TimeSlot[];
  bookedSlots: TimeSlot[];
}

interface UserAppointment {
  _id: string;
  date: string;
  time: string;
  name: string;
  serviceId: string;
  durationMinutes: number;
  price?: number;
  phone: string;
  status: string;
  attendance?: string;
  notes?: string;
}

const BOOKING_TIPS = [
  "لطفاً ۱۰ دقیقه زودتر از ساعت نوبت حضور داشته باشید.",
  "در صورت داشتن ناخن مصنوعی، قبل از مراجعه آن را بردارید.",
  "پس از ثبت نوبت، تأیید نهایی از طریق اعلان انجام می‌شود.",
  "برای لغو نوبت، حداقل ۲۴ ساعت قبل اطلاع دهید.",
];

const STEPS = [
  { num: 1, label: "خدمات" },
  { num: 2, label: "تاریخ" },
  { num: 3, label: "ساعت" },
  { num: 4, label: "تأیید" },
  { num: 5, label: "ثبت" },
] as const;

function normalizeStatus(status: string): "pending" | "approved" | "cancelled" {
  if (status === "booked") return "approved";
  if (status === "pending" || status === "cancelled") return status;
  return "approved";
}

function statusBannerClass(status: "pending" | "approved" | "cancelled"): string {
  switch (status) {
    case "pending":
      return "border-amber-300 bg-amber-50 text-amber-900";
    case "cancelled":
      return "border-red-300 bg-red-50 text-red-800";
    default:
      return "border-green-300 bg-green-50 text-green-800";
  }
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} دقیقه`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours} ساعت`;
  return `${hours} ساعت و ${rest} دقیقه`;
}

function readProgressFromParams(searchParams: URLSearchParams): BookingProgress {
  const hasBookingParams =
    searchParams.has("step") ||
    searchParams.has("service") ||
    searchParams.has("date") ||
    searchParams.has("time");

  if (!hasBookingParams) {
    return { step: 1 };
  }

  return {
    step: parseBookingStep(searchParams.get("step") ?? "1"),
    service: searchParams.get("service") ?? undefined,
    date: searchParams.get("date") ?? undefined,
    time: searchParams.get("time") ?? undefined,
  };
}

function BookingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = readProgressFromParams(searchParams);

  const [step, setStep] = useState<BookingStep>(initial.step);
  const [services, setServices] = useState<PublicService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState(initial.service ?? "");
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    initial.date ? parseDateKey(initial.date) : null,
  );
  const [selectedTime, setSelectedTime] = useState<TimeSlot | "">(
    (initial.time as TimeSlot) ?? "",
  );
  const [availableStarts, setAvailableStarts] = useState<TimeSlot[]>([]);
  const [dayActive, setDayActive] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [notes, setNotes] = useState("");
  const [firstName, setFirstName] = useState("");
  const [needsName, setNeedsName] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [myAppointments, setMyAppointments] = useState<UserAppointment[]>([]);
  const [serviceNames, setServiceNames] = useState<Record<string, string>>({});

  const selectedService = services.find((s) => s.slug === selectedServiceId);

  const syncUrl = useCallback(
    (progress: BookingProgress) => {
      saveBookingProgress(progress);
      router.replace(`/?${buildBookingSearchParams(progress).toString()}`, {
        scroll: false,
      });
    },
    [router],
  );

  const goToStep = useCallback(
    (nextStep: BookingStep) => {
      const progress: BookingProgress = {
        step: nextStep,
        service: selectedServiceId || undefined,
        date: selectedDate ? formatDateKey(selectedDate) : undefined,
        time: selectedTime || undefined,
        notes: notes.trim() || undefined,
      };
      setStep(nextStep);
      syncUrl(progress);
    },
    [selectedServiceId, selectedDate, selectedTime, notes, syncUrl],
  );

  const loadMyAppointments = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/appointments?mine=1&from=${getTodayKey()}`,
      );
      if (!response.ok) return;
      const data = await response.json();
      setMyAppointments(Array.isArray(data) ? data : []);
    } catch {
      setMyAppointments([]);
    }
  }, []);

  useEffect(() => {
    async function loadServicesAndProfile() {
      try {
        const [svcRes, meRes] = await Promise.all([
          fetch("/api/services"),
          fetch("/api/auth/me"),
        ]);
        if (svcRes.ok) {
          const data = await svcRes.json();
          const list = (data.services ?? []) as PublicService[];
          setServices(list);
          setServiceNames(
            Object.fromEntries(list.map((s) => [s.slug, s.name])),
          );
          if (
            initial.service &&
            !list.some((s) => s.slug === initial.service)
          ) {
            setSelectedServiceId("");
          }
        }
        if (meRes.ok) {
          const data = await meRes.json();
          setNeedsName(!data.user?.name);
          if (data.user?.name) setFirstName(data.user.name);
        }
      } catch {
        setError("خطا در بارگذاری خدمات");
      }
    }
    loadServicesAndProfile();
    loadMyAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMyAppointments]);

  useEffect(() => {
    if (!selectedDate || !selectedService) {
      setAvailableStarts([]);
      return;
    }

    const dateKey = formatDateKey(selectedDate);
    let cancelled = false;

    async function loadSlots() {
      setLoadingSlots(true);
      setError("");
      try {
        const response = await fetch(
          `/api/availability?date=${dateKey}&duration=${selectedService!.durationMinutes}`,
        );
        const data: AvailabilityResponse & { error?: string } =
          await response.json();
        if (!response.ok) throw new Error(data.error ?? "خطا در بارگذاری ساعات");
        if (cancelled) return;
        setDayActive(Boolean(data.isActive));
        setAvailableStarts(data.availableStarts ?? []);
        if (
          selectedTime &&
          !(data.availableStarts ?? []).includes(selectedTime)
        ) {
          setSelectedTime("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "مشکلی پیش آمد");
          setAvailableStarts([]);
        }
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    }

    loadSlots();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, selectedService, selectedTime]);

  async function submitBooking() {
    if (!selectedService || !selectedDate || !selectedTime) return;
    if (needsName && !firstName.trim()) {
      setError("لطفاً نام خود را وارد کنید");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: formatDateKey(selectedDate),
          time: selectedTime,
          serviceId: selectedService.slug,
          notes: notes.trim() || undefined,
          name: needsName ? firstName.trim() : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "ثبت نوبت ناموفق بود");
      }

      setNeedsName(false);
      clearBookingProgress();
      await loadMyAppointments();
      goToStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : "مشکلی پیش آمد");
    } finally {
      setSubmitting(false);
    }
  }

  function resetBooking() {
    setStep(1);
    setSelectedServiceId("");
    setSelectedDate(null);
    setSelectedTime("");
    setNotes("");
    setError("");
    clearBookingProgress();
    router.replace("/", { scroll: false });
  }

  return (
    <div className="space-y-8">
      {myAppointments.length > 0 && step < 5 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">نوبت‌های پیش‌رو</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {myAppointments.map((appt) => {
              const status = normalizeStatus(appt.status);
              const when = getAppointmentDateTime(appt.date, appt.time);
              return (
                <div
                  key={appt._id}
                  className={`min-w-[220px] rounded-2xl border p-4 ${statusBannerClass(status)}`}
                >
                  <p className="font-medium">
                    {serviceNames[appt.serviceId] ?? appt.serviceId}
                  </p>
                  <p className="mt-1 text-sm">
                    {formatPersianDate(parseDateKey(appt.date))}
                  </p>
                  <p className="text-sm" dir="ltr">
                    {formatTimeRange(appt.time, appt.durationMinutes)}
                  </p>
                  <p className="mt-2 text-xs">
                    {APPOINTMENT_STATUS_LABELS[status]}
                    {when > new Date()
                      ? ` · ${formatTimeRemaining(when)}`
                      : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <nav className="flex flex-wrap gap-2">
        {STEPS.map((s) => (
          <span
            key={s.num}
            className={`rounded-full px-3 py-1 text-sm ${
              step === s.num
                ? "bg-primary text-white"
                : step > s.num
                  ? "bg-accent text-primary"
                  : "bg-muted/20 text-muted"
            }`}
          >
            {s.num}. {s.label}
          </span>
        ))}
      </nav>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {step === 1 && (
        <section>
          <h1 className="text-2xl font-semibold">انتخاب خدمت</h1>
          <p className="mt-1 text-sm text-muted">خدمت مورد نظر را انتخاب کنید.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {services.map((service) => (
              <button
                key={service.slug}
                type="button"
                onClick={() => {
                  setSelectedServiceId(service.slug);
                  setSelectedTime("");
                  setTimeout(() => goToStep(2), 0);
                }}
                className={`rounded-2xl border p-4 text-right transition hover:border-primary ${
                  selectedServiceId === service.slug
                    ? "border-primary bg-accent"
                    : "border-border"
                }`}
              >
                <p className="font-medium">{service.name}</p>
                <p className="mt-1 text-sm text-muted">
                  {formatDuration(service.durationMinutes)} ·{" "}
                  {formatPrice(service.price)}
                </p>
              </button>
            ))}
          </div>
          {services.length === 0 && (
            <p className="mt-4 text-sm text-muted">خدمتی تعریف نشده است.</p>
          )}
        </section>
      )}

      {step === 2 && selectedService && (
        <section>
          <h1 className="text-2xl font-semibold">انتخاب تاریخ</h1>
          <p className="mt-1 text-sm text-muted">
            {selectedService.name} · {formatPrice(selectedService.price)}
          </p>
          <div className="mt-6">
            <JalaliCalendar
              selectedDate={selectedDate}
              onSelectDate={(date) => {
                setSelectedDate(date);
                setSelectedTime("");
              }}
              isDateDisabled={isDateDisabled}
            />
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => goToStep(1)}
              className="rounded-xl border border-border px-4 py-2 text-sm"
            >
              بازگشت
            </button>
            <button
              type="button"
              disabled={!selectedDate}
              onClick={() => goToStep(3)}
              className="rounded-xl bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              ادامه
            </button>
          </div>
        </section>
      )}

      {step === 3 && selectedService && selectedDate && (
        <section>
          <h1 className="text-2xl font-semibold">انتخاب ساعت</h1>
          <p className="mt-1 text-sm text-muted">
            {formatPersianDate(selectedDate)}
          </p>
          {loadingSlots ? (
            <p className="mt-6 text-muted">در حال بارگذاری ساعات...</p>
          ) : !dayActive ? (
            <p className="mt-6 text-muted">این روز برای رزرو بسته است.</p>
          ) : availableStarts.length === 0 ? (
            <p className="mt-6 text-muted">ساعت خالی در این روز وجود ندارد.</p>
          ) : (
            <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {availableStarts.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  dir="ltr"
                  onClick={() => {
                    setSelectedTime(slot);
                    setTimeout(() => goToStep(4), 0);
                  }}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    selectedTime === slot
                      ? "border-primary bg-accent"
                      : "border-border"
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => goToStep(2)}
              className="rounded-xl border border-border px-4 py-2 text-sm"
            >
              بازگشت
            </button>
          </div>
        </section>
      )}

      {step === 4 && selectedService && selectedDate && selectedTime && (
        <section>
          <h1 className="text-2xl font-semibold">تأیید رزرو</h1>
          <div className="mt-4 rounded-2xl border border-border p-4 text-sm">
            <p>
              <span className="text-muted">خدمت:</span>{" "}
              <span className="font-medium">{selectedService.name}</span>
            </p>
            <p className="mt-2">
              <span className="text-muted">قیمت:</span>{" "}
              <span className="font-medium">
                {formatPrice(selectedService.price)}
              </span>
            </p>
            <p className="mt-2">
              <span className="text-muted">تاریخ:</span>{" "}
              <span className="font-medium">
                {formatPersianDate(selectedDate)}
              </span>
            </p>
            <p className="mt-2">
              <span className="text-muted">ساعت:</span>{" "}
              <span className="font-medium" dir="ltr">
                {formatTimeRange(selectedTime, selectedService.durationMinutes)}
              </span>
            </p>
          </div>

          {needsName && (
            <div className="mt-4">
              <label htmlFor="first-name" className="mb-1 block text-sm font-medium">
                نام (فقط یک‌بار)
              </label>
              <input
                id="first-name"
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-xl border border-border px-3 py-2 outline-none focus:border-primary"
                placeholder="نام شما"
              />
              <p className="mt-1 text-xs text-muted">
                این نام در پروفایل ذخیره می‌شود و دوباره پرسیده نمی‌شود.
              </p>
            </div>
          )}

          <div className="mt-4">
            <label htmlFor="notes" className="mb-1 block text-sm font-medium">
              توضیحات (اختیاری)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border px-3 py-2 outline-none focus:border-primary"
            />
          </div>

          <ul className="mt-4 list-disc space-y-1 pr-5 text-sm text-muted">
            {BOOKING_TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>

          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={() => goToStep(3)}
              className="rounded-xl border border-border px-4 py-2 text-sm"
            >
              بازگشت
            </button>
            <button
              type="button"
              disabled={submitting || (needsName && !firstName.trim())}
              onClick={submitBooking}
              className="rounded-xl bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {submitting ? "در حال ثبت..." : "ثبت نوبت"}
            </button>
          </div>
        </section>
      )}

      {step === 5 && (
        <section className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
          <h1 className="text-2xl font-semibold text-green-800">نوبت ثبت شد</h1>
          <p className="mt-2 text-sm text-green-800">
            درخواست شما ثبت شد. پس از تأیید مدیر، اعلان دریافت می‌کنید.
          </p>
          <button
            type="button"
            onClick={resetBooking}
            className="mt-6 rounded-xl bg-primary px-4 py-2 text-sm text-white"
          >
            رزرو جدید
          </button>
        </section>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<p className="text-muted">در حال بارگذاری...</p>}>
      <BookingPageContent />
    </Suspense>
  );
}
