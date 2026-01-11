import "./globals.css";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Nav from "@/components/Nav";
import AIAssistant from "@/components/AIAssistant";
import BackToTop from "@/components/BackToTop";
import { ToastContextProvider } from "@/context/ToastContext";
import { AuthProvider } from "@/context/AuthProvider";

export const metadata: Metadata = {
  metadataBase: new URL("https://aiskillsbootcamp.com"),
  title: "AI Skills Bootcamp",
  description: "Learn high-value AI skills and build real projects.",
  openGraph: {
    title: "AI Skills Bootcamp",
    description: "Learn high-value AI skills and build real projects.",
    url: "https://aiskillsbootcamp.com",
    siteName: "AI Skills Bootcamp",
    images: [
      {
        url: "https://storage.googleapis.com/msgsndr/nzEfDvWm1wGE4UGpfNvM/media/693ffb99ab25946479fa34ba.png",
        width: 1200,
        height: 630,
        alt: "AI Skills Bootcamp",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Skills Bootcamp",
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
      <body className="min-h-screen bg-black text-white" suppressHydrationWarning={true}>
        <AuthProvider>
          <ToastContextProvider>
            {/* Header */}
            <header className="bg-black border-b border-white/10">
              <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
                {/* Logo / Brand */}
                <Link href="/" className="flex min-w-0 items-center gap-3">
                  <Image
                    src="/logo-symbol.png"
                    alt="AI Skills Bootcamp"
                    width={36}
                    height={36}
                    priority
                    className="h-8 w-8 shrink-0 sm:h-9 sm:w-9"
                  />

                  {/* Prevent wrapping + allow graceful truncation if space is extremely tight */}
                  <span className="min-w-0 whitespace-nowrap truncate text-lg font-bold tracking-tight sm:text-xl">
                    <span className="text-lime-400">AI Skills</span>{" "}
                    <span className="text-white">Bootcamp</span>
                  </span>
                </Link>

                {/* Navigation */}
                <div className="shrink-0">
                  <Nav />
                </div>
              </div>
            </header>

            {/* Main Content */}
            <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>

            {/* AI Assistant Chat Bubble */}
            <AIAssistant />
            <BackToTop />
          </ToastContextProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
