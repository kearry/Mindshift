import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import Header from "@/components/Header"; // Import the Header component

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MindShift",
  description: "AI Debate Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProviderWrapper>
          <Header /> {/* Add the Header component here */}
          <main className="container mx-auto p-4"> {/* Optional main content wrapper */}
            {children}
          </main>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}