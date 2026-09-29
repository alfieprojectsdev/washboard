import type { Metadata } from "next";
import "./globals.css";
import GoatCounterAnalytics from '@/components/GoatCounterAnalytics';
import FeedbackButton from '@/components/FeedbackButton';

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
        {/* Room to scroll page content clear of the floating Feedback button. */}
        <div aria-hidden="true" className="h-16" />
        <FeedbackButton />
        <GoatCounterAnalytics />
      </body>
    </html>
  );
}
