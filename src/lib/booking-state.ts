export type BookingStep = 1 | 2 | 3 | 4 | 5;

export interface BookingProgress {
  step: BookingStep;
  service?: string;
  date?: string;
  time?: string;
  notes?: string;
}

export const BOOKING_PROGRESS_KEY = "nail-booking-progress";

export function loadBookingProgress(): BookingProgress | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(BOOKING_PROGRESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BookingProgress;
  } catch {
    return null;
  }
}

export function saveBookingProgress(progress: BookingProgress) {
  if (typeof window === "undefined") return;
  localStorage.setItem(BOOKING_PROGRESS_KEY, JSON.stringify(progress));
}

export function clearBookingProgress() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(BOOKING_PROGRESS_KEY);
}

export function parseBookingStep(value: string | null): BookingStep {
  const step = Number(value);
  if (step >= 1 && step <= 5) return step as BookingStep;
  return 1;
}

export function buildBookingSearchParams(progress: BookingProgress): URLSearchParams {
  const params = new URLSearchParams();
  params.set("step", String(progress.step));

  if (progress.service) params.set("service", progress.service);
  if (progress.date) params.set("date", progress.date);
  if (progress.time) params.set("time", progress.time);

  return params;
}
