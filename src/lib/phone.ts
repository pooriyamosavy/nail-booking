/** Normalize Iranian mobile numbers to 09xxxxxxxxx */
export function normalizePhone(input: string): string | null {
  let phone = input.trim().replace(/[\s\-()]/g, "");

  if (phone.startsWith("+98")) {
    phone = `0${phone.slice(3)}`;
  } else if (phone.startsWith("98") && phone.length === 12) {
    phone = `0${phone.slice(2)}`;
  }

  if (!/^09\d{9}$/.test(phone)) {
    return null;
  }

  return phone;
}

export function isValidPhone(input: string): boolean {
  return normalizePhone(input) !== null;
}
