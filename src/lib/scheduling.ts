import {
  SLOT_STEP_MINUTES,
  TIME_SLOTS,
  TimeSlot,
  WORK_END_MINUTES,
  WORK_START_MINUTES,
} from "@/lib/constants";

export { WORK_START_MINUTES, WORK_END_MINUTES, SLOT_STEP_MINUTES };

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function slotsNeeded(durationMinutes: number): number {
  return durationMinutes / SLOT_STEP_MINUTES;
}

export function getSlotsForRange(
  startTime: string,
  durationMinutes: number,
): TimeSlot[] {
  const needed = slotsNeeded(durationMinutes);
  const startMinutes = timeToMinutes(startTime);
  const result: TimeSlot[] = [];

  for (let i = 0; i < needed; i += 1) {
    const slotMinutes = startMinutes + i * SLOT_STEP_MINUTES;
    const slot = minutesToTime(slotMinutes) as TimeSlot;
    if (!TIME_SLOTS.includes(slot)) return [];
    result.push(slot);
  }

  if (startMinutes + durationMinutes > WORK_END_MINUTES) return [];
  return result;
}

export function expandAppointmentSlots(
  startTime: string,
  durationMinutes: number,
): TimeSlot[] {
  return getSlotsForRange(startTime, durationMinutes);
}

export function getAvailableStartTimes(
  durationMinutes: number,
  occupiedSlots: Set<string>,
): TimeSlot[] {
  const needed = slotsNeeded(durationMinutes);
  const starts: TimeSlot[] = [];

  for (const slot of TIME_SLOTS) {
    const range = getSlotsForRange(slot, durationMinutes);
    if (range.length !== needed) continue;
    if (range.every((s) => !occupiedSlots.has(s))) {
      starts.push(slot);
    }
  }

  return starts;
}

export function getAppointmentDateTime(dateKey: string, time: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function formatTimeRange(
  start: string,
  durationMinutes: number,
): string {
  const end = minutesToTime(timeToMinutes(start) + durationMinutes);
  return `${start} – ${end}`;
}

export function formatTimeRemaining(target: Date): string {
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) return "هم‌اکنون";

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days} روز و ${hours} ساعت مانده`;
  if (hours > 0) return `${hours} ساعت و ${minutes} دقیقه مانده`;
  return `${minutes} دقیقه مانده`;
}
