// Jalali calendar (jalaali-js algorithm)

function div(a: number, b: number): number {
  return ~~(a / b);
}

function mod(a: number, b: number): number {
  return a - ~~(a / b) * b;
}

const breaks = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
  2192, 2262, 2324, 2394, 2456, 3178,
];

function jalCalLeap(jy: number): number {
  const bl = breaks.length;
  let jp = breaks[0];
  let jm: number;
  let jump = 0;
  let leap: number;
  let n: number;
  let i: number;

  if (jy < jp || jy >= breaks[bl - 1]) {
    throw new Error(`Invalid Jalaali year ${jy}`);
  }

  for (i = 1; i < bl; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    jp = jm;
  }
  n = jy - jp;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return leap;
}

function jalCal(jy: number, withoutLeap = false) {
  const bl = breaks.length;
  let gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jm: number;
  let jump = 0;
  let leap: number;
  let leapG: number;
  let march: number;
  let n: number;
  let i: number;

  if (jy < jp || jy >= breaks[bl - 1]) {
    throw new Error(`Invalid Jalaali year ${jy}`);
  }

  for (i = 1; i < bl; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  march = 20 + leapJ - leapG;

  if (withoutLeap) return { gy, march };

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn: number) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy, true);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn: number) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy, false);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;
  let jm: number;
  let jd: number;

  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

function toJalaali(gy: number, gm: number, gd: number) {
  return d2j(g2d(gy, gm, gd));
}

function toGregorian(jy: number, jm: number, jd: number) {
  return d2g(j2d(jy, jm, jd));
}

function jalaaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  if (jalCalLeap(jy) === 0) return 30;
  return 29;
}

function jalaaliToDate(jy: number, jm: number, jd: number): Date {
  const { gy, gm, gd } = toGregorian(jy, jm, jd);
  return new Date(gy, gm - 1, gd);
}

export const WORK_START_MINUTES = 10 * 60;
export const WORK_END_MINUTES = 18 * 60;
export const SLOT_STEP_MINUTES = 15;

export const TIME_SLOTS = (() => {
  const slots: string[] = [];
  for (let m = WORK_START_MINUTES; m < WORK_END_MINUTES; m += SLOT_STEP_MINUTES) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  return slots;
})() as readonly string[];

export type TimeSlot = (typeof TIME_SLOTS)[number];

export const SERVICES = [
  { id: "classic-manicure", label: "مانیکور کلاسیک", durationMinutes: 60 },
  { id: "gel-manicure", label: "مانیکور ژلی", durationMinutes: 75 },
  { id: "acrylic", label: "ناخن اکریلیک", durationMinutes: 120 },
  { id: "nail-art", label: "نقاشی ناخن", durationMinutes: 90 },
  { id: "french", label: "فرنچ", durationMinutes: 60 },
  { id: "pedicure", label: "پدیکور", durationMinutes: 90 },
] as const;

export type ServiceId = (typeof SERVICES)[number]["id"];

export function getServiceById(id: string) {
  return SERVICES.find((service) => service.id === id);
}

/** @deprecated use SERVICES */
export const NAIL_TYPES = SERVICES.map((s) => s.id) as unknown as readonly string[];

export type NailType = ServiceId;

/** @deprecated use getServiceById */
export const NAIL_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  SERVICES.map((s) => [s.id, s.label]),
);

export const APPOINTMENT_STATUS_LABELS = {
  pending: "در انتظار تأیید",
  approved: "تأیید شده",
  cancelled: "لغو شده",
  booked: "تأیید شده",
} as const;

export type AppointmentStatus = keyof typeof APPOINTMENT_STATUS_LABELS;

export const PERSIAN_WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"] as const;

export const PHONE_STORAGE_KEY = "nail-booking-phone";
export const ADMIN_AUTH_KEY = "nail-booking-admin-auth";
export const PAGE_CONTAINER_CLASS = "mx-auto w-full max-w-5xl px-6 md:px-10";

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isSameDay(a: Date, b: Date): boolean {
  return formatDateKey(a) === formatDateKey(b);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

export function getMonthDays(date: Date): Date[] {
  const start = startOfMonth(date);
  const daysInMonth = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    return new Date(start.getFullYear(), start.getMonth(), index + 1);
  });
}

export function isPastDate(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compare = new Date(date);
  compare.setHours(0, 0, 0, 0);
  return compare < today;
}

export function isClosedWeekday(date: Date): boolean {
  const day = date.getDay();
  return day === 4 || day === 5;
}

export function isDateDisabled(date: Date): boolean {
  return isPastDate(date);
}

export function isDayOpenByAdmin(isActiveRecord: boolean | undefined | null): boolean {
  return isActiveRecord !== false;
}

export function getTodayKey(): string {
  return formatDateKey(new Date());
}

export interface JalaliMonth {
  jy: number;
  jm: number;
}

export function getJalaliMonth(date: Date): JalaliMonth {
  const { jy, jm } = toJalaali(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
  return { jy, jm };
}

export function getJalaliMonthLabel(jy: number, jm: number): string {
  const date = jalaaliToDate(jy, jm, 1);
  return date.toLocaleDateString("fa-IR", {
    calendar: "persian",
    month: "long",
    year: "numeric",
  });
}

export function getJalaliMonthDays(jy: number, jm: number): Date[] {
  const daysInMonth = jalaaliMonthLength(jy, jm);
  return Array.from({ length: daysInMonth }, (_, index) => {
    return jalaaliToDate(jy, jm, index + 1);
  });
}

export function addJalaliMonths(
  jy: number,
  jm: number,
  count: number,
): JalaliMonth {
  let newJm = jm + count;
  let newJy = jy;

  while (newJm > 12) {
    newJm -= 12;
    newJy += 1;
  }
  while (newJm < 1) {
    newJm += 12;
    newJy -= 1;
  }

  return { jy: newJy, jm: newJm };
}

export function getSaturdayFirstOffset(date: Date): number {
  const day = date.getDay();
  return (day + 1) % 7;
}

export function formatPersianDate(date: Date): string {
  return date.toLocaleDateString("fa-IR", {
    calendar: "persian",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatPersianDay(date: Date): string {
  const { jd } = toJalaali(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
  return jd.toLocaleString("fa-IR");
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}
