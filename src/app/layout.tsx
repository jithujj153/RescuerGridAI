import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RescueGrid AI — Crisis Response Copilot",
  description:
    "Turn chaotic crisis signals into structured, verified, life-saving field actions. Powered by Google Gemini, Maps, and Cloud.",
  keywords: [
    "crisis response",
    "emergency management",
    "disaster relief",
    "AI copilot",
    "evacuation planning",
    "incident analysis",
  ],
  authors: [{ name: "RescueGrid AI Team" }],
  openGraph: {
    title: "RescueGrid AI — Crisis Response Copilot",
    description:
      "The fastest way to turn chaos into life-saving field action.",
    type: "website",
    locale: "en_US",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#06080f",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
