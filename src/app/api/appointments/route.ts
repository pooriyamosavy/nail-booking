import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { ActiveDay } from "@/models/ActiveDay";
import { Appointment } from "@/models/Appointment";
import {
  getServiceById,
  isDayOpenByAdmin,
  TIME_SLOTS,
} from "@/lib/constants";
import {
  filterMockAppointments,
  getMockAppointmentsForDate,
  getMockClosedSlots,
  getMockStore,
  isDayActiveInMock,
  isMockMode,
  newMockId,
  type MockAppointment,
} from "@/lib/mock-store";
import {
  expandAppointmentSlots,
  getAvailableStartTimes,
} from "@/lib/scheduling";

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get("date");
    const phone = request.nextUrl.searchParams.get("phone");
    const from = request.nextUrl.searchParams.get("from");
    const status = request.nextUrl.searchParams.get("status");

    if (isMockMode()) {
      const store = getMockStore();
      const appointments = filterMockAppointments(store, {
        date: date ?? undefined,
        phone: phone ?? undefined,
        from: date ? undefined : (from ?? undefined),
        status: status ?? undefined,
      });
      return NextResponse.json(appointments);
    }

    await connectDB();

    const filter: Record<string, unknown> = {};
    if (status) {
      filter.status = status.includes(",")
        ? { $in: status.split(",") }
        : status;
    }
    if (date) {
      filter.date = date;
    } else if (from) {
      filter.date = { $gte: from };
    }
    if (phone) {
      filter.phone = phone.trim();
    }

    const appointments = await Appointment.find(filter)
      .sort({ date: 1, time: 1 })
      .lean();

    return NextResponse.json(appointments);
  } catch (error) {
    console.error("GET /api/appointments error:", error);
    return NextResponse.json(
      { error: "Failed to fetch appointments" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, time, name, serviceId, phone, notes } = body as {
      date?: string;
      time?: string;
      name?: string;
      serviceId?: string;
      phone?: string;
      notes?: string;
    };

    if (!date || !time || !name || !serviceId || !phone) {
      return NextResponse.json(
        { error: "همه فیلدهای الزامی را پر کنید" },
        { status: 400 },
      );
    }

    const service = getServiceById(serviceId);
    if (!service) {
      return NextResponse.json({ error: "خدمت نامعتبر است" }, { status: 400 });
    }

    if (!TIME_SLOTS.includes(time as (typeof TIME_SLOTS)[number])) {
      return NextResponse.json({ error: "ساعت نامعتبر است" }, { status: 400 });
    }

    if (isMockMode()) {
      const store = getMockStore();

      if (!isDayActiveInMock(store, date)) {
        return NextResponse.json(
          { error: "این روز برای رزرو بسته است" },
          { status: 400 },
        );
      }

      const occupiedSlots = new Set<string>();
      for (const slot of getMockClosedSlots(store, date)) {
        occupiedSlots.add(slot);
      }
      for (const appointment of getMockAppointmentsForDate(store, date)) {
        for (const slot of expandAppointmentSlots(
          appointment.time,
          appointment.durationMinutes,
        )) {
          occupiedSlots.add(slot);
        }
      }

      const availableStarts = getAvailableStartTimes(
        service.durationMinutes,
        occupiedSlots,
      );

      if (!availableStarts.includes(time as (typeof TIME_SLOTS)[number])) {
        return NextResponse.json(
          { error: "این بازه زمانی دیگر در دسترس نیست" },
          { status: 409 },
        );
      }

      const now = new Date().toISOString();
      const appointment: MockAppointment = {
        _id: newMockId(store),
        date,
        time,
        name: name.trim(),
        serviceId,
        durationMinutes: service.durationMinutes,
        phone: phone.trim(),
        notes: notes?.trim() || undefined,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      };

      store.appointments.push(appointment);
      return NextResponse.json(appointment, { status: 201 });
    }

    await connectDB();

    const activeDay = await ActiveDay.findOne({ date });
    if (!isDayOpenByAdmin(activeDay?.isActive)) {
      return NextResponse.json(
        { error: "این روز برای رزرو بسته است" },
        { status: 400 },
      );
    }

    const occupiedSlots = new Set<string>();
    for (const slot of activeDay?.closedSlots ?? []) {
      occupiedSlots.add(slot);
    }

    const bookedAppointments = await Appointment.find({
      date,
      status: { $in: ["pending", "approved", "booked"] },
    }).select("time durationMinutes");

    for (const appointment of bookedAppointments) {
      const duration = appointment.durationMinutes ?? 60;
      for (const slot of expandAppointmentSlots(appointment.time, duration)) {
        occupiedSlots.add(slot);
      }
    }

    const availableStarts = getAvailableStartTimes(
      service.durationMinutes,
      occupiedSlots,
    );

    if (!availableStarts.includes(time as (typeof TIME_SLOTS)[number])) {
      return NextResponse.json(
        { error: "این بازه زمانی دیگر در دسترس نیست" },
        { status: 409 },
      );
    }

    const appointment = await Appointment.create({
      date,
      time,
      name: name.trim(),
      serviceId,
      durationMinutes: service.durationMinutes,
      phone: phone.trim(),
      notes: notes?.trim() || undefined,
      status: "pending",
    });

    return NextResponse.json(appointment, { status: 201 });
  } catch (error) {
    console.error("POST /api/appointments error:", error);
    return NextResponse.json(
      { error: "Failed to create appointment" },
      { status: 500 },
    );
  }
}
