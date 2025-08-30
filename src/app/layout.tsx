
import type { Metadata } from "next";
import { Inter, PT_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/context/auth-context";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import { FloatingActionButton } from "@/components/floating-action-button";
import { ThemeProvider } from "@/components/theme-provider";
import { InstallPwaPrompt } from "@/components/install-pwa-prompt";

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
  title: "LogiApp - Gestão de Logistica Integrada",
  description: "Gestão de Logística Integrada",
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
        <meta name="theme-color" content="#18181b" />
        <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'%3E%3Cpath fill='orange' d='M46.69,19.23l-16.87-9.73c-.97-.56-2.17-.56-3.14,0l-8.43,4.87c-.54.31-.51,1.08.04,1.39,0,0,.01,0,.02,0l17.38,9.86c1,.57,1.62,1.63,1.62,2.78v19.65s0,.01,0,.02c0,.66.68,1.1,1.26.76l8.12-4.69c.97-.56,1.57-1.6,1.57-2.72v-19.48c0-1.12-.6-2.16-1.58-2.72ZM56.24,18.81c0-2.02-1.09-3.91-2.84-4.92L31.09,1.01c-1.75-1.01-3.93-1.01-5.68,0L3.1,13.9c-1.75,1.01-2.84,2.9-2.84,4.92v25.76c0,2.02,1.1,3.91,2.85,4.92l22.31,12.88c.88.51,1.86.76,2.84.76.98,0,1.97-.25,2.84-.76l22.31-12.89c1.75-1.01,2.84-2.9,2.84-4.92v-25.76ZM51.88,46.84l-22.31,12.89c-.81.47-1.81.47-2.62,0l-22.31-12.88c-.81-.47-1.31-1.34-1.31-2.27v-25.76c0-.93.49-1.8,1.3-2.27L26.93,3.66c.4-.23.86-.35,1.31-.35.45,0,.91.12,1.31.35l22.31,12.88c.81.47,1.31,1.34,1.31,2.27v25.76c0,.93-.49-1.8-1.3,2.27Z'/%3E%3C/svg%3E" />
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
                  <InstallPwaPrompt />
              </div>
              <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
