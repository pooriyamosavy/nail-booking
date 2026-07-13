interface OtpRecord {
  code: string;
  expiresAt: number;
}

const globalForSms = globalThis as typeof globalThis & {
  __otpStore?: Map<string, OtpRecord>;
  __smsLog?: Array<{ phone: string; message: string; sentAt: string }>;
};

function getOtpStore(): Map<string, OtpRecord> {
  if (!globalForSms.__otpStore) {
    globalForSms.__otpStore = new Map();
  }
  return globalForSms.__otpStore;
}

function getSmsLog() {
  if (!globalForSms.__smsLog) {
    globalForSms.__smsLog = [];
  }
  return globalForSms.__smsLog;
}

function normalizePhone(phone: string): string {
  return phone.trim().replace(/\s+/g, "");
}

function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function sendOtp(phone: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    throw new Error("شماره موبایل نامعتبر است");
  }

  const code = generateOtpCode();
  const expiresAt = Date.now() + 5 * 60 * 1000;

  getOtpStore().set(normalized, { code, expiresAt });

  const message = `کد تأیید نوبت‌دهی: ${code}`;
  getSmsLog().push({
    phone: normalized,
    message,
    sentAt: new Date().toISOString(),
  });

  return {
    phone: normalized,
    message,
    mock: true,
    expiresInSeconds: 300,
    ...(process.env.NODE_ENV === "development" ? { debugCode: code } : {}),
  };
}

export function verifyOtp(phone: string, code: string): boolean {
  const normalized = normalizePhone(phone);
  const record = getOtpStore().get(normalized);

  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    getOtpStore().delete(normalized);
    return false;
  }

  const valid = record.code === code.trim();
  if (valid) {
    getOtpStore().delete(normalized);
  }

  return valid;
}

export function sendAppointmentsSms(phone: string, message: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    throw new Error("شماره موبایل نامعتبر است");
  }

  getSmsLog().push({
    phone: normalized,
    message,
    sentAt: new Date().toISOString(),
  });

  return {
    phone: normalized,
    message,
    mock: true,
    sentAt: new Date().toISOString(),
  };
}
