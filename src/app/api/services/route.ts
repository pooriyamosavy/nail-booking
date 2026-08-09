import { NextRequest, NextResponse } from "next/server";
import {
  forbidden,
  getSessionFromCookies,
  unauthorized,
} from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { isMockMode } from "@/lib/mock-store";
import {
  addMockService,
  findMockService,
  getMockServices,
  listServices,
  seedServicesIfEmpty,
} from "@/lib/services";
import { ServiceOption } from "@/models/ServiceOption";

function slugify(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u0600-\u06FF-]/g, "");
  return base.slice(0, 64) || `service-${Date.now()}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return unauthorized();

    const all = request.nextUrl.searchParams.get("all") === "1";
    if (all && session.role !== "admin") {
      return forbidden();
    }

    const services = await listServices(!all);
    return NextResponse.json({ services });
  } catch (error) {
    console.error("GET /api/services error:", error);
    return NextResponse.json({ error: "خطا در دریافت خدمات" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return unauthorized();
    if (session.role !== "admin") return forbidden();

    const body = await request.json();
    const { name, price, durationMinutes, slug, isActive, sortOrder } = body as {
      name?: string;
      price?: number;
      durationMinutes?: number;
      slug?: string;
      isActive?: boolean;
      sortOrder?: number;
    };

    if (!name?.trim() || price == null || !durationMinutes) {
      return NextResponse.json(
        { error: "نام، قیمت و مدت زمان الزامی است" },
        { status: 400 },
      );
    }

    if (durationMinutes % 15 !== 0 || durationMinutes < 15) {
      return NextResponse.json(
        { error: "مدت زمان باید مضرب ۱۵ دقیقه باشد" },
        { status: 400 },
      );
    }

    const finalSlug = (slug?.trim() || slugify(name)).slice(0, 64);

    if (isMockMode()) {
      if (findMockService(finalSlug)) {
        return NextResponse.json({ error: "این شناسه تکراری است" }, { status: 409 });
      }
      const service = addMockService({
        slug: finalSlug,
        name: name.trim(),
        price: Number(price),
        durationMinutes: Number(durationMinutes),
        isActive: isActive !== false,
        sortOrder: sortOrder ?? getMockServices(false).length + 1,
      });
      return NextResponse.json({ service }, { status: 201 });
    }

    await seedServicesIfEmpty();
    await connectDB();

    const existing = await ServiceOption.findOne({ slug: finalSlug });
    if (existing) {
      return NextResponse.json({ error: "این شناسه تکراری است" }, { status: 409 });
    }

    const service = await ServiceOption.create({
      slug: finalSlug,
      name: name.trim(),
      price: Number(price),
      durationMinutes: Number(durationMinutes),
      isActive: isActive !== false,
      sortOrder: sortOrder ?? 0,
    });

    return NextResponse.json(
      {
        service: {
          _id: service._id.toString(),
          slug: service.slug,
          name: service.name,
          price: service.price,
          durationMinutes: service.durationMinutes,
          isActive: service.isActive,
          sortOrder: service.sortOrder,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/services error:", error);
    return NextResponse.json({ error: "ایجاد خدمت ناموفق بود" }, { status: 500 });
  }
}
