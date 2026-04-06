import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata = {
  title: "Collato.io",
  description: "Shared workspaces for project knowledge, team updates, task follow-through, and grounded AI answers.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-theme="collato"
      className={`${bodyFont.variable} ${displayFont.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
