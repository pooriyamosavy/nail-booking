import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import Navbar from "@/components/Navbar";
import PwaRegister from "@/components/PwaRegister";
import SessionGuard from "@/components/SessionGuard";
import { PAGE_CONTAINER_CLASS } from "@/lib/constants";
import "./globals.css";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic"],
});

export const metadata: Metadata = {
  title: "رزرو نوبت ناخن",
  description: "رزرو آنلاین نوبت ناخن",
  applicationName: "رزرو نوبت ناخن",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "نوبت ناخن",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#c45c7a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body className={`${vazirmatn.variable} antialiased`}>
        <SessionGuard>
          <Navbar />
          <main className={`${PAGE_CONTAINER_CLASS} py-8`}>{children}</main>
          <PwaRegister />
        </SessionGuard>
      </body>
    </html>
  );
}
