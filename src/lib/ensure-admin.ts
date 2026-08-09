import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { normalizePhone } from "@/lib/phone";
import { User } from "@/models/User";

let ensured = false;

/** Ensure an admin user exists from ADMIN_PHONE + ADMIN_PASSWORD env vars. */
export async function ensureAdminUser() {
  if (ensured) return;
  if (process.env.USE_MOCK_DATA === "true") {
    ensured = true;
    return;
  }

  const phoneRaw = process.env.ADMIN_PHONE;
  const password = process.env.ADMIN_PASSWORD;
  if (!phoneRaw || !password) {
    ensured = true;
    return;
  }

  const phone = normalizePhone(phoneRaw);
  if (!phone) {
    console.warn("ADMIN_PHONE is invalid; skipping admin seed");
    ensured = true;
    return;
  }

  await connectDB();

  const existing = await User.findOne({ phone });
  if (existing) {
    if (existing.role !== "admin") {
      existing.role = "admin";
      await existing.save();
    }
    ensured = true;
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({
    phone,
    passwordHash,
    name: "مدیر",
    role: "admin",
  });

  ensured = true;
}
