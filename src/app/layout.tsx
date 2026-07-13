import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import Navbar from "@/components/Navbar";
import { PAGE_CONTAINER_CLASS } from "@/lib/constants";
import "./globals.css";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic"],
});

export const metadata: Metadata = {
  title: "رزرو نوبت ناخن",
  description: "رزرو آنلاین نوبت ناخن",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body className={`${vazirmatn.variable} antialiased`}>
        <Navbar />
        <main className={`${PAGE_CONTAINER_CLASS} py-8`}>{children}</main>
      </body>
    </html>
  );
}
