"use client";
import { useState, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Settings, User, Palette, Shield, Moon, Sun, Monitor, Plug, ExternalLink, Globe, Sparkles, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import MicrosoftConnectPanel from "@/components/microsoft/microsoft-connect-panel";
import { AIMemoryTab } from "@/components/features/ai-memory-tab";
import { TIMEZONE_OPTIONS, getTimezoneOffset } from "@/lib/timezone";
import { apiFetch } from "@/lib/api";
import { useTimezoneCtx } from "@/components/layout/timezone-provider";
import { PWANotificationSettings } from "@/components/features/pwa-notification-settings";

type Tab = "profile" | "appearance" | "timezone" | "notifications" | "integrations" | "danger" | "pm" | "ai";

function SettingsPageInner() {
  const { data: session, update } = useSession();
  const { theme, setTheme } = useTheme();
  const searchParams = useSearchParams();
  const { setTimezone: setGlobalTimezone } = useTimezoneCtx();
  const [activeTab, setActiveTab] = useState<Tab>(
    (searchParams.get("tab") as Tab) ?? "profile"
  );
  const [name, setName] = useState(session?.user?.name || "");
  const [isLoading, setIsLoading] = useState(false);
  const [timezone, setTimezone] = useState("UTC");
  const [isTzLoading, setIsTzLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  // Load timezone from server
  useEffect(() => {
    apiFetch("/api/user/timezone")
      .then(r => r.json())
      .then((d: { timezone: string }) => { if (d.timezone) setTimezone(d.timezone); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (session?.user?.name) setName(session.user.name);
  }, [session]);

  useEffect(() => {
    const tab = searchParams.get("tab") as Tab;
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      await update({ name });
      toast.success("Profile updated!");
    } catch { toast.error("Failed to update profile"); }
    finally { setIsLoading(false); }
  };

  const handleSaveTimezone = async (tz: string) => {
    setIsTzLoading(true);
    try {
      setTimezone(tz);
      localStorage.setItem("flowfocus_timezone", tz);
      const res = await apiFetch("/api/user/timezone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: tz }),
      });
      if (!res.ok) throw new Error("Failed");
      setGlobalTimezone(tz); // update context immediately
      toast.success("Timezone updated!");
    } catch { toast.error("Failed to update timezone"); }
    finally { setIsTzLoading(false); }
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "timezone", label: "Timezone", icon: Globe },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "integrations", label: "Integrations", icon: Plug },
    { id: "pm", label: "PM", icon: Globe },
    { id: "ai", label: "AI Memory", icon: Sparkles },
    { id: "danger", label: "Danger Zone", icon: Shield },
  ];

  const themeOptions = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-violet-500" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === id
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {activeTab === "profile" && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-violet-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Profile</h2>
          </div>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-2xl font-bold text-violet-700 dark:text-violet-300">
              {name?.[0]?.toUpperCase() || "U"}
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">{session?.user?.name}</div>
              <div className="text-sm text-gray-400">{session?.user?.email}</div>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Display Name</label>
              <input
                value={name} onChange={e => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:text-white"
              />
            </div>
            <button
              onClick={handleSaveName} disabled={isLoading || !name.trim() || name === session?.user?.name}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
            >
              {isLoading ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      )}

      {/* Appearance tab */}
      {activeTab === "appearance" && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-4 h-4 text-violet-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Appearance</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                  theme === value
                    ? "border-violet-500 bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300"
                    : "border-gray-100 dark:border-gray-800 text-gray-500 hover:border-gray-200 dark:hover:border-gray-700"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Timezone tab */}
      {activeTab === "timezone" && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-4 h-4 text-violet-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Timezone</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
            All dates, due times, &quot;Today&quot; / &quot;Overdue&quot; labels and email scan windows will use this timezone.
          </p>

          {/* Current timezone info */}
          <div className="mb-4 p-3 bg-violet-50 dark:bg-violet-950/30 rounded-xl border border-violet-100 dark:border-violet-800/30 flex items-center gap-3">
            <Globe className="w-4 h-4 text-violet-500 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-violet-800 dark:text-violet-200 truncate">{timezone}</div>
              <div className="text-xs text-violet-500">
                Current offset: <span className="font-semibold">{getTimezoneOffset(timezone)}</span>
                {" · "}
                Local time now: <span className="font-semibold">
                  {new Date().toLocaleTimeString("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: true })}
                </span>
              </div>
            </div>
          </div>

          {/* Timezone select */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select your timezone</label>
            <select
              value={timezone}
              onChange={e => handleSaveTimezone(e.target.value)}
              disabled={isTzLoading}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50 cursor-pointer"
            >
              {TIMEZONE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {isTzLoading && (
              <p className="text-xs text-violet-500 animate-pulse">Saving timezone…</p>
            )}
          </div>

          {/* Help text */}
          <div className="mt-5 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p className="font-medium text-gray-600 dark:text-gray-300">What this affects:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Today view — which tasks count as &quot;today&quot;</li>
              <li>Overdue detection — tasks past midnight in your timezone</li>
              <li>Upcoming view — day column headers and date grouping</li>
              <li>Dashboard greeting — morning / afternoon / evening</li>
              <li>Email scan window — the daily digest uses your local midnight</li>
            </ul>
          </div>
        </div>
      )}

      {/* Notifications tab */}
      {activeTab === "notifications" && <PWANotificationSettings />}

      {/* Integrations tab */}
      {activeTab === "integrations" && (
        <div className="space-y-6">
          {/* Microsoft Integration */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
            <MicrosoftConnectPanel />
          </div>
          {/* ClickUp Integration — dedicated hub */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-[#7B68EE]/20 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-[#7B68EE]/10 flex items-center justify-center">
                <svg viewBox="0 0 32 32" className="w-5 h-5" fill="none">
                  <path d="M4.53 21.4L8.2 18.4c1.95 2.3 3.9 3.46 7.8 3.46s5.85-1.16 7.8-3.46l3.67 3c-2.73 3.2-6.4 4.87-11.47 4.87S7.26 24.6 4.53 21.4z" fill="#7B68EE"/>
                  <path d="M4 11.2l3.78 2.87C9.9 11.5 12.7 10.1 16 10.1s6.1 1.4 8.22 3.97L28 11.2C25.13 7.7 20.9 5.67 16 5.67S6.87 7.7 4 11.2z" fill="#FF79C6"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">ClickUp Integration</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Multi-workspace import &amp; AI reports</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Manage all your ClickUp workspace connections, import tasks per-space into FlowFocus projects, and generate AI-powered workspace reports.
            </p>
            <Link
              href="/clickup"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#7B68EE] hover:bg-[#6B5ADF] text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Open ClickUp Hub
            </Link>
          </div>
        </div>
      )}

      {/* PM tab */}
      {activeTab === "pm" && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-violet-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Project Manager tools</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Use the PM Workspace to manage risks, approvals, scope changes, decision logs, meeting notes, follow-ups, and AI status drafts.</p>
          <Link href="/pm" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors">
            Open PM Workspace
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* AI Memory tab */}
      {activeTab === "ai" && <AIMemoryTab />}

      {/* Danger zone tab */}
      {activeTab === "danger" && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-red-100 dark:border-red-900/50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-red-500" />
            <h2 className="font-semibold text-red-700 dark:text-red-400">Danger Zone</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Deleting your account will permanently remove all your tasks, projects, and data. This action cannot be undone.
          </p>
          <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Type <span className="font-mono font-bold text-red-500">DELETE</span> to confirm</p>
            <input
              value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="w-full px-3.5 py-2.5 rounded-xl border border-red-200 dark:border-red-800/50 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-red-500 dark:text-white"
            />
            <button
              disabled={deleteConfirm !== "DELETE"}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white rounded-xl text-sm font-medium transition-colors"
              onClick={() => toast.error("Account deletion requires server-side confirmation. Contact support.")}
            >
              Delete my account
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Loading settings…</div>}>
      <SettingsPageInner />
    </Suspense>
  );
}
