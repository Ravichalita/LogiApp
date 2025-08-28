import type { Metadata } from "next";
import { Inter, PT_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/context/auth-context";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import { FloatingActionButton } from "@/components/floating-action-button";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ 
  subsets: ["latin"], 
  variable: "--font-sans",
  display: 'swap',
});
const pt_sans = PT_Sans({
  subsets: ["latin"],
  weight: ['400', '700'],
  variable: "--font-headline",
  display: 'swap',
});

export const metadata: Metadata = {
  title: "LogiApp",
  description: "Gestão de Logística",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#000000" />
      </head>
      <body
        className={`${inter.variable} ${pt_sans.variable} bg-background`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
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
        </ThemeProvider>
      </body>
    </html>
  );
}
