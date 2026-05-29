import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import { AuroraBackground } from "@/components/ui/AuroraBackground";
import { SmoothScroll } from "@/components/ui/SmoothScroll";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CS2 Match Predictor",
  description:
    "Calibrated XGBoost predictions for professional Counter-Strike 2 matches, with Elo ratings, SHAP explanations, and a live results feed.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable} ${mono.variable}`}>
      <body className="font-sans">
        <AuroraBackground />
        <SmoothScroll>{children}</SmoothScroll>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "rgba(14,17,32,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#e2e8f0",
            },
          }}
        />
      </body>
    </html>
  );
}
