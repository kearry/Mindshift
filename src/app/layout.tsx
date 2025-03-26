import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SessionProviderWrapper from "@/components/SessionProviderWrapper"; // Adjust import path if needed

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MindShift", // You can customize this
  description: "AI Debate Platform", // You can customize this
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Wrap the children with the SessionProviderWrapper */}
        <SessionProviderWrapper>
          {children}
        </SessionProviderWrapper>
      </body>
    </html>
  );
}