import webpush from "web-push";
import { connectDB } from "@/lib/mongodb";
import { isMockMode } from "@/lib/mock-store";
import {
  Notification,
  type NotificationType,
} from "@/models/Notification";
import { User } from "@/models/User";

export interface CreateNotificationInput {
  userId: string;
  title: string;
  body: string;
  type?: NotificationType;
  meta?: Record<string, unknown>;
}

const globalForNotif = globalThis as typeof globalThis & {
  __mockNotifications?: Array<{
    _id: string;
    userId: string;
    title: string;
    body: string;
    type: NotificationType;
    read: boolean;
    meta?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  }>;
  __mockNotifId?: number;
};

function getMockNotifications() {
  if (!globalForNotif.__mockNotifications) {
    globalForNotif.__mockNotifications = [];
    globalForNotif.__mockNotifId = 1;
  }
  return globalForNotif.__mockNotifications;
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

async function sendWebPush(
  userId: string,
  title: string,
  body: string,
  meta?: Record<string, unknown>,
) {
  if (!configureWebPush()) return;

  try {
    await connectDB();
    const user = await User.findById(userId).select("pushSubscriptions");
    if (!user?.pushSubscriptions?.length) return;

    const payload = JSON.stringify({ title, body, meta });
    const remaining = [];

    for (const sub of user.pushSubscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
          },
          payload,
        );
        remaining.push(sub);
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status !== 404 && status !== 410) {
          remaining.push(sub);
          console.warn("Web push failed:", err);
        }
      }
    }

    if (remaining.length !== user.pushSubscriptions.length) {
      user.pushSubscriptions = remaining;
      await user.save();
    }
  } catch (err) {
    console.warn("Web push error:", err);
  }
}

export async function createNotification(input: CreateNotificationInput) {
  const type = input.type ?? "general";

  if (isMockMode()) {
    const list = getMockNotifications();
    const id = `notif-${globalForNotif.__mockNotifId ?? 1}`;
    globalForNotif.__mockNotifId = (globalForNotif.__mockNotifId ?? 1) + 1;
    const now = new Date().toISOString();
    const item = {
      _id: id,
      userId: input.userId,
      title: input.title,
      body: input.body,
      type,
      read: false,
      meta: input.meta,
      createdAt: now,
      updatedAt: now,
    };
    list.unshift(item);
    return item;
  }

  await connectDB();
  const doc = await Notification.create({
    userId: input.userId,
    title: input.title,
    body: input.body,
    type,
    meta: input.meta,
  });

  void sendWebPush(input.userId, input.title, input.body, input.meta);

  return doc.toObject();
}

export async function notifyAdmins(
  title: string,
  body: string,
  type: NotificationType = "booking_created",
  meta?: Record<string, unknown>,
) {
  if (isMockMode()) {
    const { ensureMockAdmin, getMockStore } = await import("@/lib/mock-store");
    ensureMockAdmin();
    const admins = getMockStore().users.filter((u) => u.role === "admin");
    await Promise.all(
      admins.map((admin) =>
        createNotification({
          userId: admin._id,
          title,
          body,
          type,
          meta,
        }),
      ),
    );
    return;
  }

  await connectDB();
  const admins = await User.find({ role: "admin" }).select("_id");
  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin._id.toString(),
        title,
        body,
        type,
        meta,
      }),
    ),
  );
}

export async function listNotificationsForUser(userId: string, limit = 50) {
  if (isMockMode()) {
    return getMockNotifications()
      .filter((n) => n.userId === userId)
      .slice(0, limit);
  }

  await connectDB();
  return Notification.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

export async function unreadCountForUser(userId: string) {
  if (isMockMode()) {
    return getMockNotifications().filter((n) => n.userId === userId && !n.read)
      .length;
  }

  await connectDB();
  return Notification.countDocuments({ userId, read: false });
}

export async function markNotificationRead(userId: string, id: string) {
  if (isMockMode()) {
    const item = getMockNotifications().find(
      (n) => n._id === id && n.userId === userId,
    );
    if (item) item.read = true;
    return item ?? null;
  }

  await connectDB();
  return Notification.findOneAndUpdate(
    { _id: id, userId },
    { read: true },
    { new: true },
  ).lean();
}

export async function markAllNotificationsRead(userId: string) {
  if (isMockMode()) {
    for (const n of getMockNotifications()) {
      if (n.userId === userId) n.read = true;
    }
    return;
  }

  await connectDB();
  await Notification.updateMany({ userId, read: false }, { read: true });
}

export { getMockNotifications };
