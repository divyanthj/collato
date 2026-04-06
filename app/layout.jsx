import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import appConfig from "@/config/app";

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata = {
  title: appConfig.appName,
  description: appConfig.appDescription,
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
