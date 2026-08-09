import mongoose, { Schema, models, model, type Model } from "mongoose";

export type NotificationType =
  | "booking_created"
  | "booking_approved"
  | "booking_cancelled"
  | "attendance_set"
  | "general";

export interface INotification {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title: string;
  body: string;
  type: NotificationType;
  read: boolean;
  meta?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: [
        "booking_created",
        "booking_approved",
        "booking_cancelled",
        "attendance_set",
        "general",
      ],
      default: "general",
    },
    read: { type: Boolean, default: false },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

NotificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification: Model<INotification> =
  (models.Notification as Model<INotification>) ||
  model<INotification>("Notification", NotificationSchema);
