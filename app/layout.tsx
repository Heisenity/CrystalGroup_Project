import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crystal Group Check-ins",
  description: "Internal monthly performance review prototype",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
