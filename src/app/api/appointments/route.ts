import { NextRequest, NextResponse } from "next/server";
import {
  unauthorizedClearSession,
} from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { ActiveDay } from "@/models/ActiveDay";
import { Appointment } from "@/models/Appointment";
import { isDayOpenByAdmin, TIME_SLOTS } from "@/lib/constants";
import {
  filterMockAppointments,
  getMockAppointmentsForDate,
  getMockClosedSlots,
  getMockStore,
  isDayActiveInMock,
  isMockMode,
  newMockId,
  type MockAppointment,
  type MockUser,
} from "@/lib/mock-store";
import { notifyAdmins } from "@/lib/notifications";
import { requireAuthUser } from "@/lib/require-user";
import { getServiceBySlug } from "@/lib/services";
import {
  expandAppointmentSlots,
  getAvailableStartTimes,
} from "@/lib/scheduling";
import { User } from "@/models/User";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const date = request.nextUrl.searchParams.get("date");
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");
    const status = request.nextUrl.searchParams.get("status");
    const mine = request.nextUrl.searchParams.get("mine") === "1";
    const userIdParam = request.nextUrl.searchParams.get("userId");

    const isAdmin = session.role === "admin";

    if (!isAdmin && (date || userIdParam) && !mine) {
      // users can only list their own unless mine=1 or month range for profile
    }

    let filterUserId: string | undefined;
    if (!isAdmin || mine) {
      filterUserId = session.userId;
    } else if (userIdParam) {
      filterUserId = userIdParam;
    }

    if (!isAdmin && !filterUserId) {
      filterUserId = session.userId;
    }

    // Admin day view: date without user filter
    if (isAdmin && date && !mine && !userIdParam) {
      filterUserId = undefined;
    }

    if (isMockMode()) {
      const store = getMockStore();
      const appointments = filterMockAppointments(store, {
        date: date ?? undefined,
        from: date ? undefined : (from ?? undefined),
        to: date ? undefined : (to ?? undefined),
        status: status ?? undefined,
        userId: filterUserId,
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
    } else if (from || to) {
      const dateRange: Record<string, string> = {};
      if (from) dateRange.$gte = from;
      if (to) dateRange.$lte = to;
      filter.date = dateRange;
    }
    if (filterUserId) {
      filter.userId = filterUserId;
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
    const auth = await requireAuthUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = await request.json();
    const { date, time, serviceId, notes, name: nameInput } = body as {
      date?: string;
      time?: string;
      serviceId?: string;
      notes?: string;
      name?: string;
    };

    if (!date || !time || !serviceId) {
      return NextResponse.json(
        { error: "خدمت، تاریخ و ساعت الزامی است" },
        { status: 400 },
      );
    }

    const service = await getServiceBySlug(serviceId);
    if (!service) {
      return NextResponse.json({ error: "خدمت نامعتبر است" }, { status: 400 });
    }

    if (!TIME_SLOTS.includes(time as (typeof TIME_SLOTS)[number])) {
      return NextResponse.json({ error: "ساعت نامعتبر است" }, { status: 400 });
    }

    let userName: string | undefined;
    let userPhone = session.phone;

    if (isMockMode()) {
      const user = auth.doc as MockUser;

      if (!user.name) {
        const trimmed = nameInput?.trim();
        if (!trimmed) {
          return NextResponse.json(
            { error: "نام برای اولین رزرو الزامی است" },
            { status: 400 },
          );
        }
        user.name = trimmed;
        user.updatedAt = new Date().toISOString();
      }
      userName = user.name;
      userPhone = user.phone;

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
        userId: user._id,
        date,
        time,
        name: userName!,
        serviceId: service.slug,
        durationMinutes: service.durationMinutes,
        price: service.price,
        phone: userPhone,
        notes: notes?.trim() || undefined,
        status: "pending",
        attendance: "unset",
        createdAt: now,
        updatedAt: now,
      };

      store.appointments.push(appointment);

      await notifyAdmins(
        "نوبت جدید",
        `${userName} برای ${date} ساعت ${time} رزرو کرد`,
        "booking_created",
        { appointmentId: appointment._id },
      );

      return NextResponse.json(appointment, { status: 201 });
    }

    await connectDB();
    const user = await User.findById(auth.user.id);
    if (!user) return unauthorizedClearSession();

    if (!user.name) {
      const trimmed = nameInput?.trim();
      if (!trimmed) {
        return NextResponse.json(
          { error: "نام برای اولین رزرو الزامی است" },
          { status: 400 },
        );
      }
      user.name = trimmed;
      await user.save();
    }
    userName = user.name;
    userPhone = user.phone;

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
      userId: user._id,
      date,
      time,
      name: userName,
      serviceId: service.slug,
      durationMinutes: service.durationMinutes,
      price: service.price,
      phone: userPhone,
      notes: notes?.trim() || undefined,
      status: "pending",
      attendance: "unset",
    });

    await notifyAdmins(
      "نوبت جدید",
      `${userName} برای ${date} ساعت ${time} رزرو کرد`,
      "booking_created",
      { appointmentId: appointment._id.toString() },
    );

    return NextResponse.json(appointment, { status: 201 });
  } catch (error) {
    console.error("POST /api/appointments error:", error);
    return NextResponse.json(
      { error: "Failed to create appointment" },
      { status: 500 },
    );
  }
}
