export interface MockAppointment {
  _id: string;
  date: string;
  time: string;
  name: string;
  serviceId: string;
  durationMinutes: number;
  phone: string;
  notes?: string;
  status: "pending" | "approved" | "cancelled" | "booked";
  createdAt: string;
  updatedAt: string;
}

export interface MockDayConfig {
  isActive: boolean;
  closedSlots: string[];
}

interface MockStore {
  appointments: MockAppointment[];
  activeDays: Map<string, MockDayConfig>;
  nextId: number;
}

const globalForMock = globalThis as typeof globalThis & {
  __mockStore?: MockStore;
};

function createStore(): MockStore {
  return {
    appointments: [],
    activeDays: new Map(),
    nextId: 1,
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
    from?: string;
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
  } else if (options.from) {
    results = results.filter((a) => a.date >= options.from!);
  }

  if (options.phone) {
    results = results.filter((a) => a.phone === options.phone!.trim());
  }

  return results.sort((a, b) =>
    a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date),
  );
}
