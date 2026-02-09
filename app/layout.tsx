import "./globals.css";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Nav from "@/components/Nav";
import Header from "@/components/Header";
import AIAssistant from "@/components/AIAssistant";
import Footer from "@/components/Footer";
import BackToTop from "@/components/BackToTop";
import { ToastContextProvider } from "@/context/ToastContext";
import { AuthProvider } from "@/context/AuthProvider";

export const metadata: Metadata = {
  metadataBase: new URL("https://aiskills.studio"),
  title: "AI Skills Studio",
  description: "Learn high-value AI skills and build real projects.",
  openGraph: {
    title: "AI Skills Studio",
    description: "Learn high-value AI skills and build real projects.",
    url: "https://aiskills.studio",
    siteName: "AI Skills Studio",
    images: [
      {
        url: "https://storage.googleapis.com/msgsndr/nzEfDvWm1wGE4UGpfNvM/media/693ffb99ab25946479fa34ba.png",
        width: 1200,
        height: 630,
        alt: "AI Skills Studio",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Skills Studio",
    description: "Learn high-value AI skills and build real projects.",
    images: ["https://storage.googleapis.com/msgsndr/nzEfDvWm1wGE4UGpfNvM/media/693ffb99ab25946479fa34ba.png"],
  },
};
export const viewport = {
  themeColor: "black",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-[100dvh] bg-black text-white overflow-x-hidden" suppressHydrationWarning={true}>
        <AuthProvider>
          <ToastContextProvider>
            {/* Header */}
            <Header />

            {/* Main Content */}
            <main className="mx-auto w-full max-w-6xl px-4 pb-8 pt-24">{children}</main>

            {/* AI Assistant Chat Bubble */}
            <AIAssistant />
            <BackToTop />
            <Footer />
          </ToastContextProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
