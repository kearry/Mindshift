import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import Header from "@/components/Header";
import { ThemeProvider } from "@/components/ThemeProvider"; // Import the new ThemeProvider

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
    <html lang="en" suppressHydrationWarning> {/* Add suppressHydrationWarning for next-themes */}
      <body className={inter.className}>
        {/* Wrap SessionProviderWrapper with ThemeProvider */}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange // Optional: disable CSS transitions when changing themes
        >
          <SessionProviderWrapper>
            <Header />
            <main className="container mx-auto p-4">
              {children}
            </main>
          </SessionProviderWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}