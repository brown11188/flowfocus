import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/layout/theme-provider";
import AuthProvider from "@/components/layout/auth-provider";
import { PWAProvider } from "@/components/layout/pwa-provider";
import { Toaster } from "sonner";
import "./globals.css";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "FlowFocus — AI-Powered Todo List",
  description: "Stop managing tasks. Start finishing what matters.",
  manifest: `${BASE_PATH}/manifest.json`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FlowFocus",
  },
  icons: {
    icon: [
      { url: `${BASE_PATH}/icon.svg`, type: "image/svg+xml" },
      { url: `${BASE_PATH}/icon-maskable.svg`, type: "image/svg+xml", rel: "mask-icon" },
    ],
    apple: [{ url: `${BASE_PATH}/icon.svg` }],
    shortcut: [{ url: `${BASE_PATH}/icon.svg` }],
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <PWAProvider />
            {children}
          </AuthProvider>
          <Toaster position="bottom-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
