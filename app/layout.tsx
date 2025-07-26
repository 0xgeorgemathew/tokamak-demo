// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Tokamak DEX Analyzer",
  description: "Analyze DeFi transaction profitability with Tokamak.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={inter.className}>
        {/* Animated starfield background */}
        <div className="fixed inset-0 pointer-events-none z-[-1] opacity-40">
          <div
            className="absolute top-1/4 left-1/4 w-1 h-1 bg-cyan-400 rounded-full animate-ping"
            style={{ animationDelay: "0s", animationDuration: "5s" }}
          />
          <div
            className="absolute top-3/4 right-1/3 w-1 h-1 bg-purple-400 rounded-full animate-ping"
            style={{ animationDelay: "1s", animationDuration: "6s" }}
          />
          <div
            className="absolute bottom-1/4 left-2/3 w-1 h-1 bg-green-400 rounded-full animate-ping"
            style={{ animationDelay: "2s", animationDuration: "4s" }}
          />
        </div>
        <main className="relative z-10">{children}</main>
      </body>
    </html>
  );
}
