"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Bell, X, AlertTriangle, Mail, CheckCircle2, Flame, Calendar, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTaskStore } from "@/store/task-store";
import { useTimezoneCtx } from "@/components/layout/timezone-provider";
import { isOverdue, isToday } from "@/lib/timezone";
import Link from "next/link";

interface Notification {
  id: string;
  type: "overdue" | "email" | "approval" | "streak" | "meeting";
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  href?: string;
  timestamp: Date;
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem("flowfocus_notif_dismissed");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const { tasks, approvalItems } = useTaskStore();
  const { timezone } = useTimezoneCtx();

  // Generate notifications from current state
  const notifications: Notification[] = useMemo(() => {
    const notifs: Notification[] = [];

    // Overdue tasks
    const overdue = tasks.filter(t => !t.isDeleted && !t.completed && t.dueDate && isOverdue(t.dueDate, timezone));
    overdue.slice(0, 5).forEach(t => {
      notifs.push({
        id: `overdue-${t.id}`,
        type: "overdue",
        title: `"${t.title}" is overdue`,
        description: t.dueDate ? `Due: ${t.dueDate.split("T")[0]}` : "Past due",
        icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
        color: "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30",
        href: "/today",
        timestamp: new Date(),
      });
    });

    // Pending approvals
    const pending = approvalItems.filter(a => a.status === "pending");
    pending.slice(0, 3).forEach(a => {
      notifs.push({
        id: `approval-${a.id}`,
        type: "approval",
        title: `Approval pending: ${a.title}`,
        description: a.approver ? `Approver: ${a.approver}` : "Needs your action",
        icon: <CheckCircle2 className="w-4 h-4 text-blue-500" />,
        color: "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30",
        href: "/pm?tab=approvals",
        timestamp: new Date(),
      });
    });

    // Streak reminder (if no tasks completed today — skip on weekends)
    const todayCompleted = tasks.filter(t => t.completedAt && isToday(t.completedAt.split("T")[0], timezone));
    const dayOfWeek = new Date().getDay(); // 0=Sun, 6=Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (!isWeekend && todayCompleted.length === 0 && new Date().getHours() >= 14) {
      notifs.push({
        id: "streak-risk",
        type: "streak",
        title: "Your streak is at risk!",
        description: "Complete a task today to keep your streak going",
        icon: <Flame className="w-4 h-4 text-orange-500" />,
        color: "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30",
        href: "/today",
        timestamp: new Date(),
      });
    }

    return notifs;
  }, [tasks, approvalItems, timezone]);

  const active = notifications.filter(n => !dismissed.has(n.id));
  const unreadCount = active.length;

  const dismiss = useCallback((id: string) => {
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem("flowfocus_notif_dismissed", JSON.stringify([...next]));
      return next;
    });
  }, []);

  const dismissAll = useCallback(() => {
    const all = new Set(notifications.map(n => n.id));
    setDismissed(all);
    localStorage.setItem("flowfocus_notif_dismissed", JSON.stringify([...all]));
  }, [notifications]);

  // Reset dismissed at midnight
  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const ms = midnight.getTime() - now.getTime();
    const timer = setTimeout(() => {
      setDismissed(new Set());
      localStorage.removeItem("flowfocus_notif_dismissed");
    }, ms);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
        title="Notifications"
      >
        <Bell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</h3>
              <div className="flex items-center gap-2">
                {active.length > 0 && (
                  <button onClick={dismissAll} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                    Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {active.length === 0 ? (
                <div className="py-8 text-center">
                  <Bell className="w-8 h-8 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">All caught up! 🎉</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  {active.map(n => (
                    <div key={n.id} className={cn("px-4 py-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors", n.color)}>
                      <div className="mt-0.5 flex-shrink-0">{n.icon}</div>
                      <div className="flex-1 min-w-0">
                        {n.href ? (
                          <Link href={n.href} onClick={() => { dismiss(n.id); setOpen(false); }} className="text-sm font-medium text-gray-900 dark:text-white hover:text-violet-600 transition-colors">
                            {n.title}
                          </Link>
                        ) : (
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{n.title}</p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{n.description}</p>
                      </div>
                      <button onClick={() => dismiss(n.id)} className="text-gray-300 hover:text-gray-500 dark:hover:text-gray-400 flex-shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}