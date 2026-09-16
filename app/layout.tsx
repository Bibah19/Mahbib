import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { WEDDING_DETAILS } from "@/lib/wedding-config";

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const couple = `${WEDDING_DETAILS.brideName} & ${WEDDING_DETAILS.groomName}`;

export const metadata: Metadata = {
  title: `${couple} Wedding Invitation`,
  description: `Join ${couple} on ${WEDDING_DETAILS.weddingDate} at ${WEDDING_DETAILS.venue.name}. See the venue on the map, reserve your seat and get directions.`,
  keywords: ["wedding", "wedding invitation", "reserve a seat", "wedding directions", couple],
  openGraph: {
    title: `${couple} Wedding Invitation`,
    description: `Together with their families, ${couple} joyfully invite you to celebrate their wedding on ${WEDDING_DETAILS.weddingDate}.`,
    type: "website",
    locale: "en_NG",
  },
  twitter: {
    card: "summary_large_image",
    title: `${couple} Wedding Invitation`,
    description: `Reserve your seat for the wedding of ${couple} on ${WEDDING_DETAILS.weddingDate}.`,
  },
};

export const viewport: Viewport = {
  themeColor: "#0b2340",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
