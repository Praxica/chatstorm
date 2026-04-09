import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from '@/components/ui/toaster'
import { TitleBar } from '@/components/TitleBar'
import { ClerkProvider } from "@clerk/nextjs";
import { AppDataLoader } from "@/components/AppDataLoader";
import { SignedIn, SignedOut } from "@clerk/nextjs";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Chatstorm",
  description: "Create and manage multi-agent conversations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        variables: { colorPrimary: '#cf5aed' },
      }}
    >
      <html className="h-full">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
        >
          <div className="flex flex-col h-full">
            <TitleBar />
            <AppDataLoader>
              <SignedIn>
                <div className="flex-1 h-full overflow-hidden">
                  {children}
                </div>
              </SignedIn>
              <SignedOut>
                {children}
              </SignedOut>
            </AppDataLoader>
          </div>
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
