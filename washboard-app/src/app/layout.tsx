import type { Metadata } from "next";
import "./globals.css";
import GoatCounterAnalytics from '@/components/GoatCounterAnalytics';

export const metadata: Metadata = {
  title: "Washboard",
  description: "Car wash queue management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <GoatCounterAnalytics />
      </body>
    </html>
  );
}
