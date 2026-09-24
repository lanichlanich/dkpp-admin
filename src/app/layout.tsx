import type { Metadata } from "next";
import { Geist_Mono, Open_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "DKPP-Admin", template: "%s | DKPP-Admin" },
  description: "Administrasi kepegawaian DKPP Kabupaten Indramayu.",
  icons: { icon: "/dkpp-admin-logo.png", apple: "/dkpp-admin-logo.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${openSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">{children}<Toaster richColors position="top-right" /></body>
    </html>
  );
}
