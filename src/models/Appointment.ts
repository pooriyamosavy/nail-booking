import mongoose, { Schema, models } from "mongoose";

export type AppointmentStatus = "pending" | "approved" | "cancelled" | "booked";

export interface IAppointment {
  _id: mongoose.Types.ObjectId;
  date: string;
  time: string;
  name: string;
  serviceId: string;
  durationMinutes: number;
  phone: string;
  notes?: string;
  status: AppointmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    date: { type: String, required: true, index: true },
    time: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    serviceId: { type: String, required: true, trim: true },
    durationMinutes: { type: Number, required: true, min: 15 },
    phone: { type: String, required: true, trim: true },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "cancelled", "booked"],
      default: "pending",
    },
  },
  { timestamps: true },
);

AppointmentSchema.index({ date: 1, time: 1, status: 1 });
AppointmentSchema.index({ phone: 1, date: 1 });

export const Appointment =
  models.Appointment ||
  mongoose.model<IAppointment>("Appointment", AppointmentSchema);
