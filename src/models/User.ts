import mongoose, { Schema, models, model, type Model } from "mongoose";

export type UserRole = "user" | "admin";

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: PushSubscriptionKeys;
}

export interface IUser {
  _id: mongoose.Types.ObjectId;
  phone: string;
  passwordHash: string;
  name?: string;
  role: UserRole;
  pushSubscriptions: PushSubscriptionData[];
  createdAt: Date;
  updatedAt: Date;
}

const PushSubscriptionSchema = new Schema<PushSubscriptionData>(
  {
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  { _id: false },
);

const UserSchema = new Schema<IUser>(
  {
    phone: { type: String, required: true, unique: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, trim: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    pushSubscriptions: { type: [PushSubscriptionSchema], default: [] },
  },
  { timestamps: true },
);

export const User: Model<IUser> =
  (models.User as Model<IUser>) || model<IUser>("User", UserSchema);
