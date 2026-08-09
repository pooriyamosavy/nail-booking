import mongoose, { Schema, models, model, type Model } from "mongoose";

export type AppointmentStatus = "pending" | "approved" | "cancelled" | "booked";
export type AttendanceStatus = "unset" | "present" | "absent";

export interface IAppointment {
  _id: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  date: string;
  time: string;
  name: string;
  serviceId: string;
  durationMinutes: number;
  price: number;
  phone: string;
  notes?: string;
  status: AppointmentStatus;
  attendance: AttendanceStatus;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    date: { type: String, required: true, index: true },
    time: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    serviceId: { type: String, required: true, trim: true },
    durationMinutes: { type: Number, required: true, min: 15 },
    price: { type: Number, required: true, min: 0, default: 0 },
    phone: { type: String, required: true, trim: true },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "cancelled", "booked"],
      default: "pending",
    },
    attendance: {
      type: String,
      enum: ["unset", "present", "absent"],
      default: "unset",
    },
  },
  { timestamps: true },
);

AppointmentSchema.index({ date: 1, time: 1, status: 1 });
AppointmentSchema.index({ phone: 1, date: 1 });
AppointmentSchema.index({ userId: 1, date: 1 });

export const Appointment: Model<IAppointment> =
  (models.Appointment as Model<IAppointment>) ||
  model<IAppointment>("Appointment", AppointmentSchema);
