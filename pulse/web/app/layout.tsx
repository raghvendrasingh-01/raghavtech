import type { Metadata } from "next";
import { Inter, Sora, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Body / UI font — highly legible, modern.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Display font for big headings — geometric, premium.
const sora = Sora({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono-code",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pulse — Your AI Chief of Staff",
  description:
    "Pulse proactively plans your day, prioritizes your work, and predicts missed deadlines before they happen. Not another to-do list.",
  metadataBase: new URL("https://pulse.app"),
  openGraph: {
    title: "Pulse — Your AI Chief of Staff",
    description:
      "Proactive AI that plans, prioritizes, and saves you from missed deadlines.",
    type: "website",
  },
};

import { ClerkProvider } from "@clerk/nextjs";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const isClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  const content = (
    <html
      lang="en"
      className={`${inter.variable} ${sora.variable} ${jetbrains.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );

  if (isClerk) {
    return <ClerkProvider>{content}</ClerkProvider>;
  }
  return content;
}
