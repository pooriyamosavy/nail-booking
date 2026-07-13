"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import JalaliCalendar from "@/components/JalaliCalendar";
import {
  APPOINTMENT_STATUS_LABELS,
  formatDateKey,
  formatPersianDate,
  getServiceById,
  getTodayKey,
  isDateDisabled,
  parseDateKey,
  PHONE_STORAGE_KEY,
  SERVICES,
  ServiceId,
  TimeSlot,
} from "@/lib/constants";
import {
  formatTimeRemaining,
  formatTimeRange,
  getAppointmentDateTime,
  minutesToTime,
  timeToMinutes,
} from "@/lib/scheduling";
import {
  BookingProgress,
  BookingStep,
  buildBookingSearchParams,
  clearBookingProgress,
  parseBookingStep,
  saveBookingProgress,
} from "@/lib/booking-state";

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
  phone: string;
  status: string;
  notes?: string;
}

const BOOKING_TIPS = [
  "لطفاً ۱۰ دقیقه زودتر از ساعت نوبت حضور داشته باشید.",
  "در صورت داشتن ناخن مصنوعی، قبل از مراجعه آن را بردارید.",
  "پس از ثبت نوبت، تأیید نهایی از طریق پیامک یا تماس انجام می‌شود.",
  "برای لغو نوبت، حداقل ۲۴ ساعت قبل اطلاع دهید.",
];

const STEPS = [
  { num: 1, label: "خدمات" },
  { num: 2, label: "تاریخ" },
  { num: 3, label: "ساعت" },
  { num: 4, label: "اطلاعات" },
  { num: 5, label: "تأیید" },
  { num: 6, label: "ثبت" },
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

  const serviceParam = searchParams.get("service") ?? "";
  const service =
    serviceParam && getServiceById(serviceParam)
      ? (serviceParam as ServiceId)
      : undefined;

  return {
    step: parseBookingStep(searchParams.get("step") ?? "1"),
    service,
    date: searchParams.get("date") ?? undefined,
    time: searchParams.get("time") ?? undefined,
  };
}

function SummaryTimeRow({
  time,
  durationMinutes,
}: {
  time: string;
  durationMinutes: number;
}) {
  return (
    <p className="mt-2">
      <span className="text-muted">ساعت:</span>{" "}
      <span className="font-medium" dir="ltr">
        {formatTimeRange(time, durationMinutes)}
      </span>
    </p>
  );
}

function BookingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initial = readProgressFromParams(searchParams);

  const [step, setStep] = useState<BookingStep>(initial.step);
  const [selectedServiceId, setSelectedServiceId] = useState<ServiceId | "">(
    initial.service ?? "",
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    initial.date ? parseDateKey(initial.date) : null,
  );
  const [selectedTime, setSelectedTime] = useState<TimeSlot | "">(
    (initial.time as TimeSlot) ?? "",
  );
  const [availableStarts, setAvailableStarts] = useState<TimeSlot[]>([]);
  const [dayActive, setDayActive] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpDebugCode, setOtpDebugCode] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [myAppointments, setMyAppointments] = useState<UserAppointment[]>([]);

  const selectedService = selectedServiceId
    ? getServiceById(selectedServiceId)
    : undefined;

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
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      setStep(nextStep);
      syncUrl(progress);
    },
    [selectedServiceId, selectedDate, selectedTime, phone, notes, syncUrl],
  );

  const loadMyAppointments = useCallback(async (storedPhone: string) => {
    if (!storedPhone.trim()) {
      setMyAppointments([]);
      return;
    }

    try {
      const response = await fetch(
        `/api/appointments?phone=${encodeURIComponent(storedPhone.trim())}&from=${getTodayKey()}`,
      );
      const data = (await response.json()) as UserAppointment[];
      if (response.ok) {
        setMyAppointments(data);
      }
    } catch {
      setMyAppointments([]);
    }
  }, []);

  useEffect(() => {
    const progress = readProgressFromParams(searchParams);
    setStep(progress.step);
    setSelectedServiceId(progress.service ?? "");
    setSelectedDate(progress.date ? parseDateKey(progress.date) : null);
    setSelectedTime((progress.time as TimeSlot) ?? "");

    const hasBookingParams =
      searchParams.has("step") ||
      searchParams.has("service") ||
      searchParams.has("date") ||
      searchParams.has("time");

    if (!hasBookingParams) {
      clearBookingProgress();
      setPhone("");
      setNotes("");
      setOtp("");
      setOtpSent(false);
      setOtpDebugCode("");
    }
  }, [searchParams]);

  useEffect(() => {
    const storedPhone = localStorage.getItem(PHONE_STORAGE_KEY) ?? "";
    if (storedPhone) {
      loadMyAppointments(storedPhone);
    }
  }, [loadMyAppointments]);

  useEffect(() => {
    if (!selectedDate || !selectedService || step < 3) {
      if (step < 3) {
        setAvailableStarts([]);
        setDayActive(false);
      }
      return;
    }

    const dateKey = formatDateKey(selectedDate);
    const duration = selectedService.durationMinutes;

    async function loadAvailability() {
      setLoadingSlots(true);
      setError("");

      try {
        const response = await fetch(
          `/api/availability?date=${dateKey}&duration=${duration}`,
        );
        const data = (await response.json()) as AvailabilityResponse & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "خطا در بارگذاری زمان‌ها");
        }

        setDayActive(data.isActive);
        setAvailableStarts(data.availableStarts);
      } catch (err) {
        setError(err instanceof Error ? err.message : "مشکلی پیش آمد");
        setAvailableStarts([]);
        setDayActive(false);
      } finally {
        setLoadingSlots(false);
      }
    }

    loadAvailability();
  }, [selectedDate, selectedService, step]);

  useEffect(() => {
    if (step !== 5 || !phone.trim() || otpSent || sendingOtp) return;

    async function sendOtpCode() {
      setSendingOtp(true);
      setError("");

      try {
        const response = await fetch("/api/otp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: phone.trim() }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "ارسال کد تأیید ناموفق بود");
        }

        setOtpSent(true);
        if (data.debugCode) {
          setOtpDebugCode(data.debugCode);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "مشکلی پیش آمد");
      } finally {
        setSendingOtp(false);
      }
    }

    sendOtpCode();
  }, [step, phone, otpSent, sendingOtp]);

  function resetBooking() {
    clearBookingProgress();
    setStep(1);
    setSelectedServiceId("");
    setSelectedDate(null);
    setSelectedTime("");
    setNotes("");
    setOtp("");
    setOtpSent(false);
    setOtpDebugCode("");
    setError("");
    router.replace("/?step=1", { scroll: false });
  }

  async function resendOtp() {
    setSendingOtp(true);
    setError("");

    try {
      const response = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "ارسال مجدد کد ناموفق بود");
      }

      setOtpSent(true);
      if (data.debugCode) {
        setOtpDebugCode(data.debugCode);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "مشکلی پیش آمد");
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleVerifyAndSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedService || !selectedDate || !selectedTime || !phone.trim()) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const verifyResponse = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), code: otp.trim() }),
      });
      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        throw new Error(verifyData.error ?? "کد تأیید نامعتبر است");
      }

      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: formatDateKey(selectedDate),
          time: selectedTime,
          name: phone.trim(),
          serviceId: selectedService.id,
          phone: phone.trim(),
          notes: notes.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "خطا در ثبت نوبت");
      }

      localStorage.setItem(PHONE_STORAGE_KEY, phone.trim());
      loadMyAppointments(phone.trim());
      goToStep(6);
    } catch (err) {
      setError(err instanceof Error ? err.message : "مشکلی پیش آمد");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          حالت آزمایشی: داده‌ها در حافظه ذخیره می‌شوند (بدون دیتابیس). با ری‌استارت
          سرور پاک می‌شوند.
        </div>
      )}

      {myAppointments.length > 0 && step !== 6 && (
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max gap-3">
            {myAppointments.map((appointment) => {
              const status = normalizeStatus(appointment.status);
              const service =
                getServiceById(appointment.serviceId) ??
                ({ label: appointment.serviceId } as { label: string });
              const duration = appointment.durationMinutes ?? 60;
              const appointmentAt = getAppointmentDateTime(
                appointment.date,
                appointment.time,
              );
              const showCountdown =
                status !== "cancelled" && appointmentAt.getTime() > Date.now();

              return (
                <div
                  key={appointment._id}
                  className={`min-w-64 shrink-0 rounded-xl border px-4 py-3 text-sm ${statusBannerClass(status)}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{service.label}</span>
                    <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs">
                      {APPOINTMENT_STATUS_LABELS[status]}
                    </span>
                  </div>
                  <p className="mt-2">
                    {formatPersianDate(parseDateKey(appointment.date))}
                  </p>
                  <p className="mt-1" dir="ltr">
                    {formatTimeRange(appointment.time, duration)}
                  </p>
                  {showCountdown && (
                    <p className="mt-2 text-xs font-medium">
                      {formatTimeRemaining(appointmentAt)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {step !== 6 && (
        <div className="flex items-center justify-center gap-1 overflow-x-auto pb-1 sm:gap-2">
          {STEPS.slice(0, 5).map((s, index) => (
            <div key={s.num} className="flex items-center gap-1 sm:gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  step >= s.num
                    ? "bg-primary text-white"
                    : "border border-border bg-background text-muted"
                }`}
              >
                {s.num}
              </div>
              <span
                className={`hidden text-sm sm:inline ${
                  step >= s.num ? "text-foreground" : "text-muted"
                }`}
              >
                {s.label}
              </span>
              {index < 4 && (
                <div
                  className={`mx-1 h-px w-4 sm:w-8 ${
                    step > s.num ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        {step === 6 ? (
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700">
              ✓
            </div>
            <h2 className="mt-4 text-xl font-semibold">درخواست شما ثبت شد</h2>
            <p className="mt-2 text-sm text-muted">
              نوبت شما پس از تأیید مدیر، از طریق پیامک به شما اطلاع‌رسانی
              می‌شود.
            </p>
            {selectedService && selectedDate && selectedTime && (
              <div className="mx-auto mt-6 max-w-sm rounded-xl bg-accent px-4 py-4 text-sm text-right">
                <p>
                  <span className="text-muted">خدمت:</span>{" "}
                  <span className="font-medium">{selectedService.label}</span>
                </p>
                <p className="mt-2">
                  <span className="text-muted">تاریخ:</span>{" "}
                  <span className="font-medium">
                    {formatPersianDate(selectedDate)}
                  </span>
                </p>
                <SummaryTimeRow
                  time={selectedTime}
                  durationMinutes={selectedService.durationMinutes}
                />
              </div>
            )}
            <button
              type="button"
              onClick={resetBooking}
              className="mt-6 rounded-xl bg-primary px-6 py-3 font-medium text-white hover:bg-primary-dark"
            >
              رزرو نوبت جدید
            </button>
          </div>
        ) : (
          <>
            {step === 1 && (
              <div>
                <h1 className="text-2xl font-semibold">انتخاب خدمات</h1>
                <p className="mt-2 text-sm text-muted">
                  نوع خدمت و مدت زمان مورد نیاز را انتخاب کنید.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {SERVICES.map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => setSelectedServiceId(service.id)}
                      className={`rounded-xl border p-4 text-right transition ${
                        selectedServiceId === service.id
                          ? "border-primary bg-accent"
                          : "border-border hover:border-primary hover:bg-accent/50"
                      }`}
                    >
                      <p className="font-medium">{service.label}</p>
                      <p className="mt-1 text-sm text-muted">
                        مدت: {formatDuration(service.durationMinutes)}
                      </p>
                    </button>
                  ))}
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    disabled={!selectedServiceId}
                    onClick={() => goToStep(2)}
                    className="rounded-xl bg-primary px-6 py-3 font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    مرحله بعد
                  </button>
                </div>
              </div>
            )}

            {step === 2 && selectedService && (
              <div>
                <h1 className="text-2xl font-semibold">انتخاب تاریخ</h1>
                <p className="mt-2 text-sm text-muted">
                  {selectedService.label} —{" "}
                  {formatDuration(selectedService.durationMinutes)}
                </p>
                <div className="mt-6">
                  <JalaliCalendar
                    selectedDate={selectedDate}
                    onSelectDate={(day) => {
                      if (isDateDisabled(day)) return;
                      setSelectedDate(day);
                      setSelectedTime("");
                      setError("");
                    }}
                    isDateDisabled={isDateDisabled}
                  />
                </div>
                <div className="mt-6 flex justify-between">
                  <button
                    type="button"
                    onClick={() => goToStep(1)}
                    className="rounded-xl border border-border px-6 py-3 text-sm hover:bg-accent"
                  >
                    بازگشت
                  </button>
                  <button
                    type="button"
                    disabled={!selectedDate}
                    onClick={() => goToStep(3)}
                    className="rounded-xl bg-primary px-6 py-3 font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    مرحله بعد
                  </button>
                </div>
              </div>
            )}

            {step === 3 && selectedService && selectedDate && (
              <div>
                <h1 className="text-2xl font-semibold">انتخاب ساعت</h1>
                <p className="mt-2 text-sm text-muted">
                  {formatPersianDate(selectedDate)} — بازه‌های ۱۵ دقیقه‌ای
                </p>

                <div className="mt-6 min-h-48">
                  {loadingSlots && (
                    <p className="text-center text-sm text-muted">
                      در حال بارگذاری...
                    </p>
                  )}

                  {!loadingSlots && error && (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-red-200 bg-red-50 px-6 py-12 text-center">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  {!loadingSlots && !error && !dayActive && (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background px-6 py-12 text-center">
                      <p className="text-sm text-muted">
                        این روز توسط مدیر بسته شده است.
                      </p>
                    </div>
                  )}

                  {!loadingSlots &&
                    !error &&
                    dayActive &&
                    availableStarts.length === 0 && (
                      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background px-6 py-12 text-center">
                        <p className="text-sm text-muted">
                          بازه‌ای به اندازه{" "}
                          {formatDuration(selectedService.durationMinutes)} آزاد
                          نیست.
                        </p>
                      </div>
                    )}

                  {!loadingSlots &&
                    !error &&
                    dayActive &&
                    availableStarts.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                        {availableStarts.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedTime(slot)}
                            className={`rounded-xl border px-2 py-3 text-sm transition ${
                              selectedTime === slot
                                ? "border-primary bg-primary text-white"
                                : "border-border hover:border-primary hover:bg-accent"
                            }`}
                            dir="ltr"
                          >
                            <span className="block font-medium">{slot}</span>
                            <span className="mt-0.5 block text-xs opacity-80">
                              تا{" "}
                              {minutesToTime(
                                timeToMinutes(slot) +
                                  selectedService.durationMinutes,
                              )}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                </div>

                <div className="mt-6 flex justify-between">
                  <button
                    type="button"
                    onClick={() => goToStep(2)}
                    className="rounded-xl border border-border px-6 py-3 text-sm hover:bg-accent"
                  >
                    بازگشت
                  </button>
                  <button
                    type="button"
                    disabled={!selectedTime}
                    onClick={() => goToStep(4)}
                    className="rounded-xl bg-primary px-6 py-3 font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    مرحله بعد
                  </button>
                </div>
              </div>
            )}

            {step === 4 && selectedService && selectedDate && selectedTime && (
              <div>
                <h1 className="text-2xl font-semibold">اطلاعات تماس</h1>
                <p className="mt-2 text-sm text-muted">
                  شماره موبایل و توضیحات اختیاری را وارد کنید.
                </p>

                <div className="mt-6 rounded-xl bg-accent px-4 py-4 text-sm">
                  <p>
                    <span className="text-muted">خدمت:</span>{" "}
                    <span className="font-medium">{selectedService.label}</span>
                  </p>
                  <p className="mt-2">
                    <span className="text-muted">تاریخ:</span>{" "}
                    <span className="font-medium">
                      {formatPersianDate(selectedDate)}
                    </span>
                  </p>
                  <SummaryTimeRow
                    time={selectedTime}
                    durationMinutes={selectedService.durationMinutes}
                  />
                </div>

                <div className="mt-6 space-y-4">
                  <div>
                    <label
                      htmlFor="phone"
                      className="mb-1 block text-sm font-medium"
                    >
                      شماره موبایل
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-xl border border-border px-3 py-2 outline-none focus:border-primary"
                      placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="notes"
                      className="mb-1 block text-sm font-medium"
                    >
                      توضیحات (اختیاری)
                    </label>
                    <textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-border px-3 py-2 outline-none focus:border-primary"
                      placeholder="مثلاً حساسیت پوستی، رنگ مورد علاقه و..."
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-between">
                  <button
                    type="button"
                    onClick={() => goToStep(3)}
                    className="rounded-xl border border-border px-6 py-3 text-sm hover:bg-accent"
                  >
                    بازگشت
                  </button>
                  <button
                    type="button"
                    disabled={!phone.trim()}
                    onClick={() => {
                      setOtp("");
                      setOtpSent(false);
                      setOtpDebugCode("");
                      goToStep(5);
                    }}
                    className="rounded-xl bg-primary px-6 py-3 font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    مرحله بعد
                  </button>
                </div>
              </div>
            )}

            {step === 5 && selectedService && selectedDate && selectedTime && (
              <div>
                <h1 className="text-2xl font-semibold">تأیید با کد پیامکی</h1>
                <p className="mt-2 text-sm text-muted">
                  کد تأیید به شماره{" "}
                  <span dir="ltr" className="font-medium">
                    {phone.trim()}
                  </span>{" "}
                  ارسال شد.
                </p>

                <div className="mt-6 rounded-xl border border-border bg-background px-4 py-4">
                  <h3 className="text-sm font-medium">نکات مهم</h3>
                  <ul className="mt-3 space-y-2 text-sm text-muted">
                    {BOOKING_TIPS.map((tip) => (
                      <li key={tip} className="flex gap-2">
                        <span className="text-primary">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {otpDebugCode && (
                  <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    حالت آزمایشی — کد تأیید:{" "}
                    <span dir="ltr" className="font-mono font-bold">
                      {otpDebugCode}
                    </span>
                  </p>
                )}

                <form onSubmit={handleVerifyAndSubmit} className="mt-6 space-y-4">
                  <div>
                    <label htmlFor="otp" className="mb-1 block text-sm font-medium">
                      کد تأیید
                    </label>
                    <input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={(e) =>
                        setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      className="w-full rounded-xl border border-border px-3 py-2 text-center font-mono text-lg tracking-widest outline-none focus:border-primary"
                      placeholder="------"
                      dir="ltr"
                    />
                  </div>

                  {error && (
                    <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => goToStep(4)}
                      className="rounded-xl border border-border px-6 py-3 text-sm hover:bg-accent"
                    >
                      بازگشت
                    </button>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={resendOtp}
                        disabled={sendingOtp}
                        className="rounded-xl border border-border px-4 py-3 text-sm hover:bg-accent disabled:opacity-50"
                      >
                        {sendingOtp ? "در حال ارسال..." : "ارسال مجدد کد"}
                      </button>
                      <button
                        type="submit"
                        disabled={submitting || otp.length !== 6 || sendingOtp}
                        className="rounded-xl bg-primary px-6 py-3 font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {submitting ? "در حال ثبت..." : "تأیید و ثبت نوبت"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted">
          در حال بارگذاری...
        </div>
      }
    >
      <BookingPageContent />
    </Suspense>
  );
}
