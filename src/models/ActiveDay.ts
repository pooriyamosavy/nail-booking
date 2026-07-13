import mongoose, { Schema, models } from "mongoose";

export interface IActiveDay {
  _id: mongoose.Types.ObjectId;
  date: string;
  isActive: boolean;
  closedSlots: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ActiveDaySchema = new Schema<IActiveDay>(
  {
    date: { type: String, required: true, unique: true, index: true },
    isActive: { type: Boolean, default: true },
    closedSlots: { type: [String], default: [] },
  },
  { timestamps: true },
);

export const ActiveDay =
  models.ActiveDay || mongoose.model<IActiveDay>("ActiveDay", ActiveDaySchema);
