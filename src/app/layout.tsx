import type { Metadata } from "next";
import { ThemeProvider } from "@/components/layout/theme-provider";
import AuthProvider from "@/components/layout/auth-provider";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlowFocus — AI-Powered Todo List",
  description: "Stop managing tasks. Start finishing what matters.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            {children}
          </AuthProvider>
          <Toaster position="bottom-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
