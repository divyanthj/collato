import { Manrope, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import appConfig from "@/config/app";
import { SiteNav } from "@/components/site-nav";

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
      <body>
        <SiteNav />
        {children}
        <Script id="datafast-queue" strategy="beforeInteractive">
          {`
            window.datafast = window.datafast || function() {
              (window.datafast.q = window.datafast.q || []).push(arguments);
            };
          `}
        </Script>
        <Script
          defer
          data-website-id="dfid_9b8jAJNitm5Gbe7xMo4Uy"
          data-domain="collato.io"
          src="https://datafa.st/js/script.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
