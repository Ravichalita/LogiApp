import type { Metadata } from "next";
import { Inter, PT_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/context/auth-context";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import { FloatingActionButton } from "@/components/floating-action-button";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const pt_sans = PT_Sans({
  subsets: ["latin"],
  weight: ['400', '700'],
  variable: "--font-headline",
});

export const metadata: Metadata = {
  title: "CaçambaControl",
  description: "Gerencie seus aluguéis de caçamba com facilidade.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${inter.variable} ${pt_sans.variable} font-sans bg-background`}
      >
        <AuthProvider>
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-grow">{children}</main>
                <div className="h-16 md:hidden" />
                <BottomNav />
                <FloatingActionButton />
            </div>
            <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
