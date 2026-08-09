import { NextRequest, NextResponse } from "next/server";
import {
  forbidden,
  getSessionFromCookies,
  unauthorized,
} from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Appointment, type AttendanceStatus } from "@/models/Appointment";
import { createNotification } from "@/lib/notifications";
import { getMockStore, isMockMode } from "@/lib/mock-store";

const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  unset: "نامشخص",
  present: "حاضر",
  absent: "غایب",
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return unauthorized();
    if (session.role !== "admin") return forbidden();

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { status, attendance } = body as {
      status?: "approved" | "cancelled";
      attendance?: AttendanceStatus;
    };

    if (!status && !attendance) {
      return NextResponse.json(
        { error: "status یا attendance لازم است" },
        { status: 400 },
      );
    }

    if (status && !["approved", "cancelled"].includes(status)) {
      return NextResponse.json(
        { error: "status must be approved or cancelled" },
        { status: 400 },
      );
    }

    if (
      attendance &&
      !["unset", "present", "absent"].includes(attendance)
    ) {
      return NextResponse.json(
        { error: "attendance نامعتبر است" },
        { status: 400 },
      );
    }

    if (isMockMode()) {
      const store = getMockStore();
      const index = store.appointments.findIndex((a) => a._id === id);

      if (index === -1) {
        return NextResponse.json(
          { error: "Appointment not found" },
          { status: 404 },
        );
      }

      const prev = store.appointments[index];
      store.appointments[index] = {
        ...prev,
        ...(status ? { status } : {}),
        ...(attendance ? { attendance } : {}),
        updatedAt: new Date().toISOString(),
      };

      const updated = store.appointments[index];

      if (updated.userId && status === "approved") {
        await createNotification({
          userId: updated.userId,
          title: "نوبت تأیید شد",
          body: `نوبت شما در ${updated.date} ساعت ${updated.time} تأیید شد.`,
          type: "booking_approved",
          meta: { appointmentId: updated._id },
        });
      }
      if (updated.userId && status === "cancelled") {
        await createNotification({
          userId: updated.userId,
          title: "نوبت لغو شد",
          body: `نوبت شما در ${updated.date} ساعت ${updated.time} لغو شد.`,
          type: "booking_cancelled",
          meta: { appointmentId: updated._id },
        });
      }
      if (updated.userId && attendance) {
        await createNotification({
          userId: updated.userId,
          title: "وضعیت حضور به‌روز شد",
          body: `وضعیت حضور نوبت ${updated.date}: ${ATTENDANCE_LABELS[attendance]}`,
          type: "attendance_set",
          meta: { appointmentId: updated._id, attendance },
        });
      }

      return NextResponse.json(updated);
    }

    await connectDB();

    const update: Record<string, unknown> = {};
    if (status) update.status = status;
    if (attendance) update.attendance = attendance;

    const appointment = await Appointment.findByIdAndUpdate(id, update, {
      new: true,
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 },
      );
    }

    const userId = appointment.userId?.toString();
    if (userId && status === "approved") {
      await createNotification({
        userId,
        title: "نوبت تأیید شد",
        body: `نوبت شما در ${appointment.date} ساعت ${appointment.time} تأیید شد.`,
        type: "booking_approved",
        meta: { appointmentId: id },
      });
    }
    if (userId && status === "cancelled") {
      await createNotification({
        userId,
        title: "نوبت لغو شد",
        body: `نوبت شما در ${appointment.date} ساعت ${appointment.time} لغو شد.`,
        type: "booking_cancelled",
        meta: { appointmentId: id },
      });
    }
    if (userId && attendance) {
      await createNotification({
        userId,
        title: "وضعیت حضور به‌روز شد",
        body: `وضعیت حضور نوبت ${appointment.date}: ${ATTENDANCE_LABELS[attendance]}`,
        type: "attendance_set",
        meta: { appointmentId: id, attendance },
      });
    }

    return NextResponse.json(appointment);
  } catch (error) {
    console.error("PATCH /api/appointments/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update appointment" },
      { status: 500 },
    );
  }
}
