import type { Metadata } from "next";
import "./globals.css";
import Navbar from "../components/Navbar";
import FloatingMessageHub from "../components/FloatingMessageHub";

export const metadata: Metadata = {
  title: "Hackathon Hub",
  description: "해커톤을 쉽게 찾고 참여하는 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <Navbar />
        {children}
        <FloatingMessageHub />
      </body>
    </html>
  );
}