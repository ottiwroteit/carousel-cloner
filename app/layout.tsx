import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Carousel Cloner",
  description: "Local-first carousel research and caption generation"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
