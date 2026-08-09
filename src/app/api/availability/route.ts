import { NextRequest, NextResponse } from "next/server";
import {
  forbidden,
  getSessionFromCookies,
  unauthorized,
} from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { ActiveDay } from "@/models/ActiveDay";
import { Appointment } from "@/models/Appointment";
import { isDayOpenByAdmin, TIME_SLOTS, TimeSlot } from "@/lib/constants";
import {
  getMockClosedSlots,
  getMockDayConfig,
  getMockStore,
  isDayActiveInMock,
  isMockMode,
  getMockAppointmentsForDate,
  setMockDayConfig,
} from "@/lib/mock-store";
import {
  expandAppointmentSlots,
  getAvailableStartTimes,
} from "@/lib/scheduling";

function addClosedSlotsToOccupied(
  occupiedSlots: Set<string>,
  closedSlots: string[],
) {
  for (const slot of closedSlots) {
    occupiedSlots.add(slot);
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return unauthorized();

    const date = request.nextUrl.searchParams.get("date");
    if (!date) {
      return NextResponse.json(
        { error: "Date query parameter is required" },
        { status: 400 },
      );
    }

    const durationParam = request.nextUrl.searchParams.get("duration");
    const durationMinutes = durationParam ? Number(durationParam) : 60;

    if (!Number.isFinite(durationMinutes) || durationMinutes % 15 !== 0) {
      return NextResponse.json(
        { error: "Invalid duration" },
        { status: 400 },
      );
    }

    let isActive: boolean;
    let closedSlots: string[] = [];
    const appointmentOccupied = new Set<string>();
    const occupiedSlots = new Set<string>();

    if (isMockMode()) {
      const store = getMockStore();
      isActive = isDayActiveInMock(store, date);
      closedSlots = getMockClosedSlots(store, date);
      const bookedAppointments = getMockAppointmentsForDate(store, date);

      for (const appointment of bookedAppointments) {
        for (const slot of expandAppointmentSlots(
          appointment.time,
          appointment.durationMinutes,
        )) {
          appointmentOccupied.add(slot);
        }
      }
    } else {
      await connectDB();

      const activeDay = await ActiveDay.findOne({ date });
      isActive = isDayOpenByAdmin(activeDay?.isActive);
      closedSlots = activeDay?.closedSlots ?? [];

      const bookedAppointments = await Appointment.find({
        date,
        status: { $in: ["pending", "approved", "booked"] },
      }).select("time durationMinutes");

      for (const appointment of bookedAppointments) {
        const duration = appointment.durationMinutes ?? 60;
        for (const slot of expandAppointmentSlots(appointment.time, duration)) {
          appointmentOccupied.add(slot);
        }
      }
    }

    for (const slot of appointmentOccupied) {
      occupiedSlots.add(slot);
    }
    addClosedSlotsToOccupied(occupiedSlots, closedSlots);

    const bookedSlots = TIME_SLOTS.filter((slot) => appointmentOccupied.has(slot));
    const availableStarts = isActive
      ? getAvailableStartTimes(durationMinutes, occupiedSlots)
      : [];

    return NextResponse.json({
      date,
      isActive,
      durationMinutes,
      availableStarts,
      availableSlots: availableStarts,
      bookedSlots,
      closedSlots,
      occupiedSlots: bookedSlots,
      mock: isMockMode(),
    });
  } catch (error) {
    console.error("GET /api/availability error:", error);
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return unauthorized();
    if (session.role !== "admin") return forbidden();

    const body = await request.json();
    const { date, isActive, closedSlots } = body as {
      date?: string;
      isActive?: boolean;
      closedSlots?: string[];
    };

    if (!date) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }

    if (typeof isActive !== "boolean" && !Array.isArray(closedSlots)) {
      return NextResponse.json(
        { error: "isActive or closedSlots is required" },
        { status: 400 },
      );
    }

    if (Array.isArray(closedSlots)) {
      const invalid = closedSlots.filter(
        (slot) => !TIME_SLOTS.includes(slot as TimeSlot),
      );
      if (invalid.length > 0) {
        return NextResponse.json({ error: "Invalid time slots" }, { status: 400 });
      }
    }

    if (isMockMode()) {
      const store = getMockStore();
      const current = getMockDayConfig(store, date);
      setMockDayConfig(store, date, {
        isActive: typeof isActive === "boolean" ? isActive : current.isActive,
        closedSlots: Array.isArray(closedSlots) ? closedSlots : current.closedSlots,
      });
      const updated = getMockDayConfig(store, date);
      return NextResponse.json({ date, ...updated, mock: true });
    }

    await connectDB();

    const update: Record<string, unknown> = {};
    if (typeof isActive === "boolean") update.isActive = isActive;
    if (Array.isArray(closedSlots)) update.closedSlots = closedSlots;

    const activeDay = await ActiveDay.findOneAndUpdate(
      { date },
      update,
      { upsert: true, new: true },
    );

    return NextResponse.json(activeDay);
  } catch (error) {
    console.error("PUT /api/availability error:", error);
    return NextResponse.json(
      { error: "Failed to update availability" },
      { status: 500 },
    );
  }
}
