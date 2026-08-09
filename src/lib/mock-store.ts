import bcrypt from "bcryptjs";
import type { UserRole } from "@/models/User";
import type { AttendanceStatus } from "@/models/Appointment";

export interface MockUser {
  _id: string;
  phone: string;
  passwordHash: string;
  name?: string;
  role: UserRole;
  pushSubscriptions: Array<{
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface MockAppointment {
  _id: string;
  userId?: string;
  date: string;
  time: string;
  name: string;
  serviceId: string;
  durationMinutes: number;
  price: number;
  phone: string;
  notes?: string;
  status: "pending" | "approved" | "cancelled" | "booked";
  attendance: AttendanceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MockDayConfig {
  isActive: boolean;
  closedSlots: string[];
}

interface MockStore {
  users: MockUser[];
  appointments: MockAppointment[];
  activeDays: Map<string, MockDayConfig>;
  nextId: number;
  adminEnsured: boolean;
}

const globalForMock = globalThis as typeof globalThis & {
  __mockStore?: MockStore;
};

function createStore(): MockStore {
  return {
    users: [],
    appointments: [],
    activeDays: new Map(),
    nextId: 1,
    adminEnsured: false,
  };
}

export function getMockStore(): MockStore {
  if (!globalForMock.__mockStore) {
    globalForMock.__mockStore = createStore();
  }
  return globalForMock.__mockStore;
}

export function isMockMode(): boolean {
  return process.env.USE_MOCK_DATA === "true";
}

export function newMockId(store: MockStore): string {
  const id = `mock-${store.nextId}`;
  store.nextId += 1;
  return id;
}

export function findMockUserByPhone(phone: string): MockUser | undefined {
  return getMockStore().users.find((u) => u.phone === phone);
}

export function findMockUserById(id: string): MockUser | undefined {
  return getMockStore().users.find((u) => u._id === id);
}

export function createMockUser(input: {
  phone: string;
  passwordHash: string;
  name?: string;
  role?: UserRole;
}): MockUser {
  const store = getMockStore();
  const now = new Date().toISOString();
  const user: MockUser = {
    _id: newMockId(store),
    phone: input.phone,
    passwordHash: input.passwordHash,
    name: input.name,
    role: input.role ?? "user",
    pushSubscriptions: [],
    createdAt: now,
    updatedAt: now,
  };
  store.users.push(user);
  return user;
}

export function ensureMockAdmin() {
  const store = getMockStore();
  if (store.adminEnsured) return;

  const phoneRaw = process.env.ADMIN_PHONE || "09000000000";
  const password = process.env.ADMIN_PASSWORD || "change-me";
  const phone = phoneRaw.replace(/\D/g, "").replace(/^98/, "0");
  const normalized =
    phone.startsWith("09") && phone.length === 11 ? phone : "09000000000";

  let admin = findMockUserByPhone(normalized);
  if (!admin) {
    admin = createMockUser({
      phone: normalized,
      passwordHash: bcrypt.hashSync(password, 8),
      name: "مدیر",
      role: "admin",
    });
  } else {
    admin.role = "admin";
  }

  store.adminEnsured = true;
}

export function isDayActiveInMock(store: MockStore, date: string): boolean {
  const record = store.activeDays.get(date);
  return record?.isActive !== false;
}

export function getMockClosedSlots(store: MockStore, date: string): string[] {
  return store.activeDays.get(date)?.closedSlots ?? [];
}

export function getMockDayConfig(
  store: MockStore,
  date: string,
): MockDayConfig {
  return store.activeDays.get(date) ?? { isActive: true, closedSlots: [] };
}

export function setMockDayConfig(
  store: MockStore,
  date: string,
  config: Partial<MockDayConfig>,
) {
  const current = getMockDayConfig(store, date);
  store.activeDays.set(date, {
    isActive: config.isActive ?? current.isActive,
    closedSlots: config.closedSlots ?? current.closedSlots,
  });
}

export function getMockAppointmentsForDate(
  store: MockStore,
  date: string,
  activeOnly = true,
) {
  return store.appointments.filter((appointment) => {
    if (appointment.date !== date) return false;
    if (!activeOnly) return true;
    return ["pending", "approved", "booked"].includes(appointment.status);
  });
}

export function filterMockAppointments(
  store: MockStore,
  options: {
    date?: string;
    phone?: string;
    userId?: string;
    from?: string;
    to?: string;
    status?: string;
  },
) {
  let results = [...store.appointments];

  if (options.status) {
    const statuses = options.status.includes(",")
      ? options.status.split(",")
      : [options.status];
    results = results.filter((a) => statuses.includes(a.status));
  }

  if (options.date) {
    results = results.filter((a) => a.date === options.date);
  } else {
    if (options.from) {
      results = results.filter((a) => a.date >= options.from!);
    }
    if (options.to) {
      results = results.filter((a) => a.date <= options.to!);
    }
  }

  if (options.phone) {
    results = results.filter((a) => a.phone === options.phone!.trim());
  }

  if (options.userId) {
    results = results.filter((a) => a.userId === options.userId);
  }

  return results.sort((a, b) =>
    a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date),
  );
}
