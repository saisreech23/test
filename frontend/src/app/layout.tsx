import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LogSentry - AI-Powered Log Analysis",
  description: "Upload, analyze, and detect threats in server logs with AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
