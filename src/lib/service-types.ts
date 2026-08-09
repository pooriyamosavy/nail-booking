export type PublicService = {
  _id: string;
  slug: string;
  name: string;
  price: number;
  durationMinutes: number;
  isActive: boolean;
  sortOrder: number;
};

export function formatPrice(price: number): string {
  return `${price.toLocaleString("fa-IR")} تومان`;
}
