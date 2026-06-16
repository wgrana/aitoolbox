import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Pen Testing Workbench",
  description: "Local-first AI security demos for prompt injection, guardrails, and AI application control boundaries.",
  icons: {
    icon: "/ai-pen-testing-workbench-logo.svg"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
