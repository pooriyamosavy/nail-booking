import { NextRequest, NextResponse } from "next/server";
import {
  APPOINTMENT_STATUS_LABELS,
  formatPersianDate,
  getServiceById,
  parseDateKey,
} from "@/lib/constants";
import { sendAppointmentsSms } from "@/lib/sms";
import { formatTimeRange } from "@/lib/scheduling";
import { connectDB } from "@/lib/mongodb";
import { Appointment } from "@/models/Appointment";
import {
  filterMockAppointments,
  getMockStore,
  isMockMode,
} from "@/lib/mock-store";

interface AppointmentRow {
  date: string;
  time: string;
  serviceId: string;
  durationMinutes: number;
  status: string;
}

function buildAppointmentsMessage(appointments: AppointmentRow[]): string {
  if (appointments.length === 0) {
    return "نوبتی برای شما ثبت نشده است.";
  }

  const lines = appointments.map((appointment, index) => {
    const service = getServiceById(appointment.serviceId);
    const label = service?.label ?? appointment.serviceId;
    const dateLabel = formatPersianDate(parseDateKey(appointment.date));
    const timeLabel = formatTimeRange(
      appointment.time,
      appointment.durationMinutes ?? 60,
    );
    const status =
      APPOINTMENT_STATUS_LABELS[
        appointment.status as keyof typeof APPOINTMENT_STATUS_LABELS
      ] ?? appointment.status;

    return `${index + 1}. ${label} — ${dateLabel} — ${timeLabel} (${status})`;
  });

  return ["نوبت‌های شما:", ...lines].join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, from } = body as { phone?: string; from?: string };

    if (!phone?.trim()) {
      return NextResponse.json(
        { error: "شماره موبایل الزامی است" },
        { status: 400 },
      );
    }

    let appointments: AppointmentRow[] = [];

    if (isMockMode()) {
      const store = getMockStore();
      appointments = filterMockAppointments(store, {
        phone: phone.trim(),
        from: from ?? undefined,
      });
    } else {
      await connectDB();

      const filter: Record<string, unknown> = {
        phone: phone.trim(),
      };
      if (from) {
        filter.date = { $gte: from };
      }

      appointments = await Appointment.find(filter)
        .sort({ date: 1, time: 1 })
        .select("date time serviceId durationMinutes status")
        .lean();
    }

    const message = buildAppointmentsMessage(appointments);
    const result = sendAppointmentsSms(phone, message);

    return NextResponse.json({
      ...result,
      appointmentCount: appointments.length,
    });
  } catch (error) {
    console.error("POST /api/sms/appointments error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "ارسال پیامک ناموفق بود",
      },
      { status: 500 },
    );
  }
}
