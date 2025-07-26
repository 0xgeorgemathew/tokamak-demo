import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tokamak DEX Analyzer | 1inch Transaction Profitability",
  description:
    "Analyze DeFi transaction profitability using 1inch APIs with Tokamak reactor-inspired design",
  keywords: [
    "DeFi",
    "1inch",
    "transaction analysis",
    "profitability",
    "blockchain",
    "ethereum",
  ],
  authors: [{ name: "Tokamak Analytics" }],
  viewport: "width=device-width, initial-scale=1",
  themeColor: "#00FFFF",
  openGraph: {
    title: "Tokamak DEX Analyzer",
    description: "Analyze DeFi transaction profitability using 1inch APIs",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tokamak DEX Analyzer",
    description: "Analyze DeFi transaction profitability using 1inch APIs",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={inter.className}>
        <main className="relative min-h-screen">
          {/* Background particles/stars */}
          <div className="fixed inset-0 pointer-events-none z-0">
            <div
              className="absolute top-1/4 left-1/4 w-1 h-1 bg-cyan-400 rounded-full opacity-60 animate-ping"
              style={{ animationDelay: "0s", animationDuration: "4s" }}
            />
            <div
              className="absolute top-3/4 right-1/3 w-1 h-1 bg-purple-400 rounded-full opacity-60 animate-ping"
              style={{ animationDelay: "1s", animationDuration: "5s" }}
            />
            <div
              className="absolute bottom-1/4 left-2/3 w-1 h-1 bg-green-400 rounded-full opacity-60 animate-ping"
              style={{ animationDelay: "2s", animationDuration: "3s" }}
            />
            <div
              className="absolute top-1/2 right-1/4 w-1 h-1 bg-yellow-400 rounded-full opacity-60 animate-ping"
              style={{ animationDelay: "3s", animationDuration: "4.5s" }}
            />
            <div
              className="absolute bottom-1/3 left-1/3 w-1 h-1 bg-pink-400 rounded-full opacity-60 animate-ping"
              style={{ animationDelay: "4s", animationDuration: "3.5s" }}
            />
          </div>

          {/* Content */}
          <div className="relative z-10">{children}</div>

          {/* Footer */}
          <footer className="relative z-10 mt-16 border-t border-white/10 bg-black/20 backdrop-blur-sm">
            <div className="container mx-auto px-4 py-8">
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                  <span className="text-gray-400 text-sm">
                    Powered by 1inch APIs
                  </span>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                </div>
                <p className="text-xs text-gray-500">
                  Tokamak DEX Analyzer - Advanced transaction profitability
                  analysis
                </p>
              </div>
            </div>
          </footer>
        </main>
      </body>
    </html>
  );
}
