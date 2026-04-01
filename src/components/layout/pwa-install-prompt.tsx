"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Share2, Smartphone, X } from "lucide-react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "flowfocus:pwa-install-dismissed:v1";

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isSafariBrowser(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const ua = navigator.userAgent.toLowerCase();
  return ua.includes("safari") && !ua.includes("chrome") && !ua.includes("android");
}

export function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    setInstalled(isStandaloneMode());

    const onBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      setInstallEvent(promptEvent);
    };

    const onAppInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      window.localStorage.removeItem(DISMISS_KEY);
      toast.success("FlowFocus installed. You can launch it like a native app now.");
    };

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const onDisplayModeChange = () => {
      setInstalled(isStandaloneMode());
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    mediaQuery.addEventListener("change", onDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      mediaQuery.removeEventListener("change", onDisplayModeChange);
    };
  }, []);

  const mode = useMemo<"install" | "ios" | null>(() => {
    if (installed) {
      return null;
    }

    if (installEvent && !dismissed) {
      return "install";
    }

    if (!dismissed && isIosDevice() && isSafariBrowser()) {
      return "ios";
    }

    return null;
  }, [dismissed, installEvent, installed]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.localStorage.getItem(DISMISS_KEY) !== null) {
      return;
    }

    if (isStandaloneMode()) {
      return;
    }

    if (isIosDevice() || installEvent) {
      setDismissed(false);
    }
  }, [installEvent]);

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, "1");
    }
    setDismissed(true);
  };

  const handleInstall = async () => {
    if (!installEvent) {
      return;
    }

    setInstalling(true);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") {
        toast.success("Installing FlowFocus…");
      } else {
        toast.message("Install dismissed. You can install FlowFocus later from your browser menu.");
      }
    } finally {
      setInstalling(false);
      setInstallEvent(null);
    }
  };

  if (!mode) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-2xl backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-violet-100 p-2 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
            {mode === "install" ? <Download className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Install FlowFocus</p>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                  {mode === "install"
                    ? "Get a faster, app-like experience with offline support, home-screen launch, and native shortcuts."
                    : "On iPhone or iPad, tap Share then Add to Home Screen to install FlowFocus."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                aria-label="Dismiss install prompt"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {mode === "ios" ? (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                <Share2 className="h-3.5 w-3.5" />
                Safari → Share → Add to Home Screen
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleInstall()}
                  disabled={installing}
                  className="rounded-xl bg-violet-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {installing ? "Opening…" : "Install app"}
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
                >
                  Not now
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
