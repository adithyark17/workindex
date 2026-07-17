import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { AnalyticsProvider } from "@/components/analytics-provider";

export const metadata: Metadata = {
  title: {
    default: "WorkIndex — India tech employment intelligence",
    template: "%s | WorkIndex",
  },
  description:
    "Evidence-backed intelligence on GCC launches, expansion, and technology hiring in India.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const document = (
    <html lang="en" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full">{children}<AnalyticsProvider /></body>
    </html>
  );
  return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? <ClerkProvider>{document}</ClerkProvider> : document;
}
