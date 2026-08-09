import { connectDB } from "@/lib/mongodb";
import { isMockMode } from "@/lib/mock-store";
import { ServiceOption, type IServiceOption } from "@/models/ServiceOption";
import type { PublicService } from "@/lib/service-types";

export type { PublicService } from "@/lib/service-types";
export { formatPrice } from "@/lib/service-types";

export const DEFAULT_SERVICES = [
  { slug: "classic-manicure", name: "مانیکور کلاسیک", durationMinutes: 60, price: 350000, sortOrder: 1 },
  { slug: "gel-manicure", name: "مانیکور ژلی", durationMinutes: 75, price: 450000, sortOrder: 2 },
  { slug: "acrylic", name: "ناخن اکریلیک", durationMinutes: 120, price: 700000, sortOrder: 3 },
  { slug: "nail-art", name: "نقاشی ناخن", durationMinutes: 90, price: 550000, sortOrder: 4 },
  { slug: "french", name: "فرنچ", durationMinutes: 60, price: 400000, sortOrder: 5 },
  { slug: "pedicure", name: "پدیکور", durationMinutes: 90, price: 500000, sortOrder: 6 },
] as const;

const globalForServices = globalThis as typeof globalThis & {
  __mockServices?: PublicService[];
};

function getMockServicesStore(): PublicService[] {
  if (!globalForServices.__mockServices) {
    globalForServices.__mockServices = DEFAULT_SERVICES.map((s, i) => ({
      _id: `svc-${i + 1}`,
      slug: s.slug,
      name: s.name,
      price: s.price,
      durationMinutes: s.durationMinutes,
      isActive: true,
      sortOrder: s.sortOrder,
    }));
  }
  return globalForServices.__mockServices;
}

export function getMockServices(activeOnly = true): PublicService[] {
  const list = getMockServicesStore();
  return activeOnly ? list.filter((s) => s.isActive) : [...list];
}

export function findMockService(slugOrId: string): PublicService | undefined {
  return getMockServicesStore().find(
    (s) => s.slug === slugOrId || s._id === slugOrId,
  );
}

export function addMockService(
  service: Omit<PublicService, "_id"> & { _id?: string },
): PublicService {
  const list = getMockServicesStore();
  const item: PublicService = {
    _id: service._id ?? `svc-${Date.now()}`,
    slug: service.slug,
    name: service.name,
    price: service.price,
    durationMinutes: service.durationMinutes,
    isActive: service.isActive,
    sortOrder: service.sortOrder,
  };
  list.push(item);
  return item;
}

export function updateMockService(
  slugOrId: string,
  patch: Partial<Omit<PublicService, "_id">>,
): PublicService | null {
  const list = getMockServicesStore();
  const index = list.findIndex(
    (s) => s.slug === slugOrId || s._id === slugOrId,
  );
  if (index === -1) return null;
  list[index] = { ...list[index], ...patch };
  return list[index];
}

export function deleteMockService(slugOrId: string): boolean {
  const list = getMockServicesStore();
  const index = list.findIndex(
    (s) => s.slug === slugOrId || s._id === slugOrId,
  );
  if (index === -1) return false;
  list.splice(index, 1);
  return true;
}

export async function seedServicesIfEmpty() {
  if (isMockMode()) return;

  await connectDB();
  const count = await ServiceOption.countDocuments();
  if (count > 0) return;

  await ServiceOption.insertMany(
    DEFAULT_SERVICES.map((s) => ({
      slug: s.slug,
      name: s.name,
      price: s.price,
      durationMinutes: s.durationMinutes,
      isActive: true,
      sortOrder: s.sortOrder,
    })),
  );
}

export async function listServices(activeOnly = true): Promise<PublicService[]> {
  if (isMockMode()) {
    return getMockServices(activeOnly);
  }

  await seedServicesIfEmpty();
  const filter = activeOnly ? { isActive: true } : {};
  const rows = await ServiceOption.find(filter).sort({ sortOrder: 1, name: 1 }).lean();
  return rows.map(toPublicService);
}

export async function getServiceBySlug(
  slug: string,
  activeOnly = true,
): Promise<PublicService | null> {
  if (isMockMode()) {
    const found = findMockService(slug);
    if (!found) return null;
    if (activeOnly && !found.isActive) return null;
    return found;
  }

  await seedServicesIfEmpty();
  const filter: Record<string, unknown> = { slug };
  if (activeOnly) filter.isActive = true;
  const row = await ServiceOption.findOne(filter).lean();
  return row ? toPublicService(row) : null;
}

function toPublicService(
  row: Pick<
    IServiceOption,
    "slug" | "name" | "price" | "durationMinutes" | "isActive" | "sortOrder"
  > & { _id: { toString(): string } },
): PublicService {
  return {
    _id: row._id.toString(),
    slug: row.slug,
    name: row.name,
    price: row.price,
    durationMinutes: row.durationMinutes,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}
