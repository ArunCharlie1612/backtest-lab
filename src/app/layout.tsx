import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Backtest Lab — Bar-by-Bar Replay",
  description: "Clean-room Forex, Crypto & Futures bar replay and journaling platform.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-bg text-slate-200 font-mono antialiased">{children}</body>
    </html>
  );
}
