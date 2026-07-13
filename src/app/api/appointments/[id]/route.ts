import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Appointment } from "@/models/Appointment";

function unauthorized() {
  return NextResponse.json({ error: "رمز عبور مدیر نادرست است" }, { status: 401 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminPassword = request.headers.get("x-admin-password");
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return unauthorized();
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { status } = body as { status?: "approved" | "cancelled" };

    if (!status || !["approved", "cancelled"].includes(status)) {
      return NextResponse.json(
        { error: "status must be approved or cancelled" },
        { status: 400 },
      );
    }

    if (process.env.USE_MOCK_DATA === "true") {
      const { getMockStore } = await import("@/lib/mock-store");
      const store = getMockStore();
      const index = store.appointments.findIndex((a) => a._id === id);

      if (index === -1) {
        return NextResponse.json(
          { error: "Appointment not found" },
          { status: 404 },
        );
      }

      store.appointments[index] = {
        ...store.appointments[index],
        status,
        updatedAt: new Date().toISOString(),
      };

      return NextResponse.json(store.appointments[index]);
    }

    await connectDB();

    const appointment = await Appointment.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    ).lean();

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 },
      );
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
