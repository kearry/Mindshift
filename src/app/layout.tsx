import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import Header from "@/components/Header";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LLMSettingsProvider } from "@/components/LLMSettingsContext";

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
    <html lang="en" suppressHydrationWarning>
      {/* Add base dark mode styles to body */}
      <body className={`${inter.className} bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 transition-colors duration-200`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LLMSettingsProvider>
            <SessionProviderWrapper>
              <Header />
              {/* Remove container/padding from main if you want full-width bg */}
              <main className="container mx-auto p-4">
                {children}
              </main>
            </SessionProviderWrapper>
          </LLMSettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}