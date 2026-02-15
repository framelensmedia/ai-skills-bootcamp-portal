import "./globals.css";
import Script from "next/script";
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
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  metadataBase: new URL("https://aiskills.studio"),
  title: "Launch your business with AI | AI Skills Studio",
  description: "Learn high-value AI skills and build real projects.",
  openGraph: {
    title: "Launch your business with AI",
    description: "Learn high-value AI skills and build real projects.",
    url: "https://aiskills.studio",
    siteName: "AI Skills Studio",
    images: [
      {
        url: "/default-meta-image.png",
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
    title: "Launch your business with AI",
    description: "Learn high-value AI skills and build real projects.",
    images: ["/default-meta-image.png"],
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
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        {/* Google Tag Manager */}
        <Script id="gtm-script" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-NW32VVF7');`}
        </Script>
        {/* End Google Tag Manager */}
      </head>
      <body className="min-h-[100dvh] bg-black text-white overflow-x-hidden" suppressHydrationWarning={true}>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-NW32VVF7"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false}>
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
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
