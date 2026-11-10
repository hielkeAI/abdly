import type { Metadata } from "next";
import Image from "next/image";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "AbdlyAI — Build your edge",
  description: "Premium AI tools, a focused community, and a place to build what is next.",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <main>{children}</main>
        <footer className="site-footer"><span className="footer-brand"><Image src="/logo.png" alt="" width={28} height={28} /> AbdlyAI</span><span>Built for the ones building what&apos;s next.</span><span>© {new Date().getFullYear()} AbdlyAI</span></footer>
      </body>
    </html>
  );
}
