import { NextRequest, NextResponse } from "next/server";
import {
  forbidden,
  getSessionFromCookies,
  unauthorized,
} from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { isMockMode } from "@/lib/mock-store";
import {
  deleteMockService,
  findMockService,
  updateMockService,
} from "@/lib/services";
import { ServiceOption } from "@/models/ServiceOption";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return unauthorized();
    if (session.role !== "admin") return forbidden();

    const { id } = await params;
    const body = await request.json();
    const { name, price, durationMinutes, isActive, sortOrder, slug } = body as {
      name?: string;
      price?: number;
      durationMinutes?: number;
      isActive?: boolean;
      sortOrder?: number;
      slug?: string;
    };

    if (
      durationMinutes != null &&
      (durationMinutes % 15 !== 0 || durationMinutes < 15)
    ) {
      return NextResponse.json(
        { error: "مدت زمان باید مضرب ۱۵ دقیقه باشد" },
        { status: 400 },
      );
    }

    if (isMockMode()) {
      const existing = findMockService(id);
      if (!existing) {
        return NextResponse.json({ error: "خدمت یافت نشد" }, { status: 404 });
      }
      if (slug && slug !== existing.slug && findMockService(slug)) {
        return NextResponse.json({ error: "این شناسه تکراری است" }, { status: 409 });
      }
      const service = updateMockService(id, {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(price !== undefined ? { price: Number(price) } : {}),
        ...(durationMinutes !== undefined
          ? { durationMinutes: Number(durationMinutes) }
          : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
        ...(slug !== undefined ? { slug: slug.trim() } : {}),
      });
      return NextResponse.json({ service });
    }

    await connectDB();
    const byId = /^[a-f\d]{24}$/i.test(id)
      ? await ServiceOption.findById(id)
      : null;
    const service = byId ?? (await ServiceOption.findOne({ slug: id }));
    if (!service) {
      return NextResponse.json({ error: "خدمت یافت نشد" }, { status: 404 });
    }

    if (name !== undefined) service.name = name.trim();
    if (price !== undefined) service.price = Number(price);
    if (durationMinutes !== undefined) {
      service.durationMinutes = Number(durationMinutes);
    }
    if (isActive !== undefined) service.isActive = isActive;
    if (sortOrder !== undefined) service.sortOrder = Number(sortOrder);
    if (slug !== undefined) service.slug = slug.trim();

    await service.save();

    return NextResponse.json({
      service: {
        _id: service._id.toString(),
        slug: service.slug,
        name: service.name,
        price: service.price,
        durationMinutes: service.durationMinutes,
        isActive: service.isActive,
        sortOrder: service.sortOrder,
      },
    });
  } catch (error) {
    console.error("PATCH /api/services/[id] error:", error);
    return NextResponse.json({ error: "به‌روزرسانی خدمت ناموفق بود" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return unauthorized();
    if (session.role !== "admin") return forbidden();

    const { id } = await params;

    if (isMockMode()) {
      const ok = deleteMockService(id);
      if (!ok) {
        return NextResponse.json({ error: "خدمت یافت نشد" }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }

    await connectDB();
    let result = null;
    if (/^[a-f\d]{24}$/i.test(id)) {
      result = await ServiceOption.findByIdAndDelete(id);
    }
    if (!result) {
      result = await ServiceOption.findOneAndDelete({ slug: id });
    }
    if (!result) {
      return NextResponse.json({ error: "خدمت یافت نشد" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/services/[id] error:", error);
    return NextResponse.json({ error: "حذف خدمت ناموفق بود" }, { status: 500 });
  }
}
