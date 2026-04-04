import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { DataProvider } from "@/components/layout/data-provider";
import { OfflineStatusBar } from "@/components/layout/offline-status-bar";
import { PWAInstallPrompt } from "@/components/layout/pwa-install-prompt";
import { PWAShareTargetListener } from "@/components/layout/pwa-share-target-listener";
import { PWANotificationListener } from "@/components/layout/pwa-notification-listener";
import { DueTaskReminderCheck } from "@/components/layout/due-task-reminder-check";
import { FridayWidget } from "@/components/friday/friday-widget";
import { TimezoneProvider } from "@/components/layout/timezone-provider";
import { FocusTimerProvider } from "@/components/features/focus-timer-context";
import { FocusTimerWidget } from "@/components/features/focus-timer-widget";
import { QuickCaptureWrapper } from "@/components/features/quick-capture-wrapper";
import { CommandPalette } from "@/components/features/command-palette";
import { KeyboardShortcutsProvider } from "@/components/features/keyboard-shortcuts";
import { MobileFAB } from "@/components/features/mobile-fab";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return (
    <DataProvider>
      <TimezoneProvider>
        <FocusTimerProvider>
          <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
            <Sidebar user={session.user} />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <OfflineStatusBar />
              <main className="flex-1 overflow-auto min-w-0 pt-0 lg:pt-0">
                <div className="lg:hidden h-14" />{/* spacer for mobile hamburger */}
                {children}
              </main>
            </div>
          </div>
          <FocusTimerWidget />
          <FridayWidget />
          <QuickCaptureWrapper />
          <PWAShareTargetListener />
          <PWAInstallPrompt />
          <CommandPalette />
          <KeyboardShortcutsProvider />
          <MobileFAB />
          <PWANotificationListener />
          <DueTaskReminderCheck />
        </FocusTimerProvider>
      </TimezoneProvider>
    </DataProvider>
  );
}
