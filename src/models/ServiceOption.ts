import mongoose, { Schema, models, model, type Model } from "mongoose";

export interface IServiceOption {
  _id: mongoose.Types.ObjectId;
  slug: string;
  name: string;
  price: number;
  durationMinutes: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceOptionSchema = new Schema<IServiceOption>(
  {
    slug: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    durationMinutes: { type: Number, required: true, min: 15 },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const ServiceOption: Model<IServiceOption> =
  (models.ServiceOption as Model<IServiceOption>) ||
  model<IServiceOption>("ServiceOption", ServiceOptionSchema);
